import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { validateSmUsername, normalizeSmUsername, validatePhone, normalizePhone } from '../_shared/validation.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const kioskToken = req.headers.get('x-kiosk-token')
    if (!kioskToken) {
      return new Response(
        JSON.stringify({ error: 'Kiosk-token mangler' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { sm_username, phone, event_id, step } = await req.json()

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: 'event_id er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify kiosk token
    const encoder = new TextEncoder()
    const data = encoder.encode(kioskToken)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('kiosk_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('event_id', event_id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig eller utløpt kiosk-sesjon' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 1: Verify sm_username is on the guestlist
    if (step === 'verify_username' || (!step && sm_username && !phone)) {
      if (!sm_username) {
        return new Response(
          JSON.stringify({ error: 'SpicyMatch brukernavn er påkrevd' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const usernameValidation = validateSmUsername(sm_username)
      if (!usernameValidation.valid) {
        return new Response(
          JSON.stringify({ error: usernameValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const normalizedUsername = normalizeSmUsername(sm_username)

      // Check if sm_username exists in event_guests (can have multiple entries)
      const { data: eventGuests, error: eventGuestError } = await supabaseAdmin
        .from('event_guests')
        .select('id, sm_username')
        .eq('event_id', event_id)
        .eq('sm_username', normalizedUsername)
        .limit(1)

      if (eventGuestError || !eventGuests || eventGuests.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Dette SpicyMatch brukernavnet er ikke på gjestelisten for dette eventet',
            on_guestlist: false
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          on_guestlist: true,
          sm_username: normalizedUsername
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 2: Lookup by phone for autofill (after sm_username is verified)
    if (step === 'lookup_phone' || (!step && sm_username && phone)) {
      if (!sm_username || !phone) {
        return new Response(
          JSON.stringify({ error: 'SpicyMatch brukernavn og mobilnummer er påkrevd' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const usernameValidation = validateSmUsername(sm_username)
      if (!usernameValidation.valid) {
        return new Response(
          JSON.stringify({ error: usernameValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const phoneValidation = validatePhone(phone)
      if (!phoneValidation.valid) {
        return new Response(
          JSON.stringify({ error: phoneValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const normalizedUsername = normalizeSmUsername(sm_username)
      const normalizedPhone = normalizePhone(phone)

      // Check if this phone number is already used by another guest on THIS event
      const { data: existingEventGuestWithPhone } = await supabaseAdmin
        .from('event_guests')
        .select('id, sm_username')
        .eq('event_id', event_id)
        .eq('phone', normalizedPhone)
        .neq('sm_username', normalizedUsername)
        .limit(1)

      if (existingEventGuestWithPhone && existingEventGuestWithPhone.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Dette mobilnummeret er allerede registrert på dette eventet. Du må legge inn ditt personlige mobilnummer.',
            phone_already_used: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if guest exists in guests table by phone (for autofill)
      const { data: existingGuest } = await supabaseAdmin
        .from('guests')
        .select('*')
        .eq('phone', normalizedPhone)
        .maybeSingle()

      // Check if event_guests has matching sm_username AND phone
      const { data: eventGuests } = await supabaseAdmin
        .from('event_guests')
        .select('*')
        .eq('event_id', event_id)
        .eq('sm_username', normalizedUsername)
        .eq('phone', normalizedPhone)
        .limit(1)

      const eventGuest = eventGuests?.[0]

      // Only autofill if phone matches in either guests or event_guests
      const shouldAutofill = !!existingGuest || !!eventGuest

      const prefillData = {
        found: true,
        sm_username: normalizedUsername,
        sm_username_locked: true,
        phone: normalizedPhone,
        first_name: shouldAutofill ? (existingGuest?.first_name || eventGuest?.first_name || '') : '',
        last_name: shouldAutofill ? (existingGuest?.last_name || eventGuest?.last_name || '') : '',
        email: shouldAutofill ? (existingGuest?.email || eventGuest?.email || '') : '',
        location: shouldAutofill ? (existingGuest?.location || '') : '',
        guest_exists: !!existingGuest,
        prefill_source: existingGuest ? 'previous_registration' : (eventGuest ? 'guestlist' : 'none'),
      }

      return new Response(
        JSON.stringify(prefillData),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ugyldig forespørsel' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'En feil oppstod' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
