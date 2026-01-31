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

    const { 
      event_id,
      sm_username,
      phone,
      first_name,
      last_name,
      email,
      location,
      language,
      read_confirmed,
      privacy_accepted,
      signature_png_base64
    } = await req.json()

    // Validate required fields
    if (!event_id || !sm_username || !phone || !first_name || !last_name || !language || !signature_png_base64) {
      return new Response(
        JSON.stringify({ error: 'Mangler påkrevde felt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!read_confirmed || !privacy_accepted) {
      return new Response(
        JSON.stringify({ error: 'Du må bekrefte at du har lest NDA og aksepterer personvernerklæringen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate inputs
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

    // Find event_guests entry by sm_username
    const { data: eventGuest, error: eventGuestError } = await supabaseAdmin
      .from('event_guests')
      .select('*')
      .eq('event_id', event_id)
      .eq('sm_username', normalizedUsername)
      .single()

    if (eventGuestError || !eventGuest) {
      return new Response(
        JSON.stringify({ error: 'Du er ikke på gjestelisten for dette eventet' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle phone matching/change
    let guestId: string
    let phoneChanged = false
    const { data: existingGuestByPhone } = await supabaseAdmin
      .from('guests')
      .select('*')
      .eq('phone', normalizedPhone)
      .single()

    if (eventGuest.phone && eventGuest.phone !== normalizedPhone) {
      // Phone is different from guestlist - check if new phone is globally unique
      if (existingGuestByPhone) {
        return new Response(
          JSON.stringify({ error: 'Dette mobilnummeret er allerede registrert på en annen gjest' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      phoneChanged = true
    }

    // Get event details
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event ikke funnet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get app config for privacy text
    const { data: appConfig, error: configError } = await supabaseAdmin
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .single()

    if (configError || !appConfig) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke hente app-konfigurasjon' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine NDA and privacy text based on language
    const ndaText = language === 'no' ? event.nda_text_no : event.nda_text_en
    const privacyText = language === 'no' ? appConfig.privacy_text_no : appConfig.privacy_text_en

    // Upsert guest
    if (existingGuestByPhone) {
      // Update existing guest
      guestId = existingGuestByPhone.id
      await supabaseAdmin
        .from('guests')
        .update({
          first_name,
          last_name,
          sm_username: normalizedUsername,
          email: email || null,
          location: location || null,
        })
        .eq('id', guestId)
    } else if (phoneChanged && eventGuest.phone) {
      // Find guest by old phone and update
      const { data: oldGuest } = await supabaseAdmin
        .from('guests')
        .select('*')
        .eq('phone', eventGuest.phone)
        .single()

      if (oldGuest) {
        guestId = oldGuest.id
        // Log phone change
        await supabaseAdmin.from('guests_phone_history').insert({
          guest_id: guestId,
          old_phone: eventGuest.phone,
          new_phone: normalizedPhone,
          changed_via: 'kiosk'
        })
        // Update guest with new phone
        await supabaseAdmin
          .from('guests')
          .update({
            phone: normalizedPhone,
            first_name,
            last_name,
            sm_username: normalizedUsername,
            email: email || null,
            location: location || null,
          })
          .eq('id', guestId)
        // Update event_guests phone
        await supabaseAdmin
          .from('event_guests')
          .update({ phone: normalizedPhone })
          .eq('id', eventGuest.id)
      } else {
        // Create new guest
        const { data: newGuest, error: newGuestError } = await supabaseAdmin
          .from('guests')
          .insert({
            phone: normalizedPhone,
            first_name,
            last_name,
            sm_username: normalizedUsername,
            email: email || null,
            location: location || null,
          })
          .select()
          .single()

        if (newGuestError || !newGuest) {
          return new Response(
            JSON.stringify({ error: 'Kunne ikke opprette gjest' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        guestId = newGuest.id
      }
    } else {
      // Create new guest
      const { data: newGuest, error: newGuestError } = await supabaseAdmin
        .from('guests')
        .insert({
          phone: normalizedPhone,
          first_name,
          last_name,
          sm_username: normalizedUsername,
          email: email || null,
          location: location || null,
        })
        .select()
        .single()

      if (newGuestError || !newGuest) {
        return new Response(
          JSON.stringify({ error: 'Kunne ikke opprette gjest' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      guestId = newGuest.id
    }

    // Store signature PNG in storage
    const signatureBytes = Uint8Array.from(atob(signature_png_base64), c => c.charCodeAt(0))
    const signaturePath = `${event_id}/${guestId}_${Date.now()}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('signatures')
      .upload(signaturePath, signatureBytes, {
        contentType: 'image/png',
        upsert: false
      })

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke lagre signatur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if signature already exists for this event+guest
    const { data: existingSignature } = await supabaseAdmin
      .from('nda_signatures')
      .select('id')
      .eq('event_id', event_id)
      .eq('guest_id', guestId)
      .single()

    if (existingSignature) {
      return new Response(
        JSON.stringify({ error: 'Du har allerede signert NDA for dette eventet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create NDA signature record
    const { data: signature, error: signatureError } = await supabaseAdmin
      .from('nda_signatures')
      .insert({
        event_id,
        guest_id: guestId,
        language,
        nda_text_snapshot: ndaText,
        read_confirmed: true,
        privacy_accepted: true,
        privacy_text_snapshot: privacyText,
        privacy_version: appConfig.privacy_version,
        signature_storage_path: signaturePath,
      })
      .select()
      .single()

    if (signatureError || !signature) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke lagre signatur-record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update event_guests status
    await supabaseAdmin
      .from('event_guests')
      .update({ status: 'signed_pending_verification' })
      .eq('id', eventGuest.id)

    // Log the signature
    await supabaseAdmin.from('audit_log').insert({
      action: 'nda_signed',
      entity_type: 'nda_signature',
      entity_id: signature.id,
      meta: { event_id, guest_id: guestId, language }
    })

    return new Response(
      JSON.stringify({
        success: true,
        signature_id: signature.id,
        message: 'Signert – venter på ID-kontroll'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'En feil oppstod' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
