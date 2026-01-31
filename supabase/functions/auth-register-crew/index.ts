import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { validateSmUsername, normalizeSmUsername } from '../_shared/validation.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, full_name, sm_username } = await req.json()

    if (!email || !password || !full_name || !sm_username) {
      return new Response(
        JSON.stringify({ error: 'Alle felt er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate sm_username
    const usernameValidation = validateSmUsername(sm_username)
    if (!usernameValidation.valid) {
      return new Response(
        JSON.stringify({ error: usernameValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedUsername = normalizeSmUsername(sm_username)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if invite exists and is valid
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('crew_invites')
      .select('*')
      .eq('email', email.toLowerCase())
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: 'Ingen gyldig invitasjon funnet for denne e-postadressen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if sm_username is already taken
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('sm_username')
      .eq('sm_username', normalizedUsername)
      .single()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'Dette SpicyMatch brukernavnet er allerede i bruk. Velg et annet.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true,
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke opprette bruker: ' + authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        role: 'crew',
        sm_username: normalizedUsername,
        full_name: full_name,
      })

    if (profileError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'Kunne ikke opprette profil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark invite as used
    await supabaseAdmin
      .from('crew_invites')
      .update({
        used_at: new Date().toISOString(),
        used_by: authData.user.id,
      })
      .eq('id', invite.id)

    // Log the registration
    await supabaseAdmin.from('audit_log').insert({
      actor_user_id: authData.user.id,
      action: 'crew_registered',
      entity_type: 'user',
      entity_id: authData.user.id,
      meta: { invite_id: invite.id }
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Bruker opprettet. Du kan nå logge inn.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'En feil oppstod' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
