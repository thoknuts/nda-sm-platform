import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Ikke autorisert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event_id } = await req.json()

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: 'Event ID er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is crew, organizer or admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile || !['crew', 'organizer', 'admin'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Kun crew, organizer eller admin kan starte kiosk' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check access based on role
    if (profile.role === 'crew') {
      // Crew needs explicit event access
      const { data: access, error: accessError } = await supabaseAdmin
        .from('crew_event_access')
        .select('id')
        .eq('crew_user_id', user.id)
        .eq('event_id', event_id)
        .single()

      if (accessError || !access) {
        return new Response(
          JSON.stringify({ error: 'Du har ikke tilgang til dette eventet' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (profile.role === 'organizer') {
      // Organizer can only access events they created
      const { data: eventCheck, error: eventCheckError } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('id', event_id)
        .eq('created_by', user.id)
        .single()

      if (eventCheckError || !eventCheck) {
        return new Response(
          JSON.stringify({ error: 'Du har ikke tilgang til dette eventet' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    // Admin has access to all events

    // Verify event exists
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event ikke funnet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate kiosk token (random 64 char hex string)
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const kioskToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')

    // Hash the token for storage
    const encoder = new TextEncoder()
    const data = encoder.encode(kioskToken)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Set expiry to 12 hours from now
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

    // Create kiosk session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('kiosk_sessions')
      .insert({
        event_id: event_id,
        crew_user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (sessionError) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke opprette kiosk-sesjon' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the action
    await supabaseAdmin.from('audit_log').insert({
      actor_user_id: user.id,
      action: 'kiosk_session_started',
      entity_type: 'kiosk_session',
      entity_id: session.id,
      meta: { event_id, event_name: event.name }
    })

    return new Response(
      JSON.stringify({
        kiosk_token: kioskToken,
        session_id: session.id,
        event_id: event.id,
        event_name: event.name,
        expires_at: expiresAt,
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
