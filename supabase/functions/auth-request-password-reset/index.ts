import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { identifier } = await req.json()

    if (!identifier) {
      return new Response(
        JSON.stringify({ error: 'Brukernavn eller e-post er påkrevd' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    let email: string | null = null

    // Check if identifier is an email
    if (identifier.includes('@')) {
      email = identifier.toLowerCase()
    } else {
      // Lookup username -> email
      const normalizedUsername = identifier.trim().toLowerCase()
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('sm_username', normalizedUsername)
        .single()

      if (profile) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
        email = userData?.user?.email || null
      }
    }

    // Always return success to prevent user enumeration
    if (!email) {
      return new Response(
        JSON.stringify({ success: true, message: 'Hvis kontoen finnes, vil du motta en e-post med instruksjoner.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send password reset email
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${Deno.env.get('SITE_URL') || supabaseUrl.replace('.supabase.co', '.vercel.app')}/update-password`,
    })

    if (resetError) {
      console.error('Password reset error:', resetError)
    }

    // Log the action (without revealing if user exists)
    await supabaseAdmin.from('audit_log').insert({
      action: 'password_reset_requested',
      entity_type: 'user',
      meta: { identifier_hash: await hashString(identifier) }
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Hvis kontoen finnes, vil du motta en e-post med instruksjoner.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'En feil oppstod' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
