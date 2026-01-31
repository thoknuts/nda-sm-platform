import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Brukernavn og passord er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Normalize username to lowercase
    const normalizedUsername = username.trim().toLowerCase()

    // Lookup username -> email from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('sm_username', normalizedUsername)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig brukernavn eller passord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)

    if (userError || !userData.user?.email) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig brukernavn eller passord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a client for signing in
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

    // Sign in with email and password
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: userData.user.email,
      password: password,
    })

    if (authError) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig brukernavn eller passord' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the login
    await supabaseAdmin.from('audit_log').insert({
      actor_user_id: authData.user.id,
      action: 'login',
      entity_type: 'user',
      entity_id: authData.user.id,
      meta: { method: 'username' }
    })

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
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
