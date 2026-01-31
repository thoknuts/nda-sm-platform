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

    const { bucket, path } = await req.json()

    if (!bucket || !path) {
      return new Response(
        JSON.stringify({ error: 'Bucket og path er påkrevd' }),
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

    // Check if user is admin or crew
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['admin', 'crew'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Kun admin eller crew kan hente signerte URLer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For crew, verify access to the event (extract event_id from path)
    if (profile.role === 'crew') {
      const eventId = path.split('/')[0]
      if (eventId) {
        const { data: access } = await supabaseAdmin
          .from('crew_event_access')
          .select('id')
          .eq('crew_user_id', user.id)
          .eq('event_id', eventId)
          .single()

        if (!access) {
          return new Response(
            JSON.stringify({ error: 'Du har ikke tilgang til dette eventet' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (urlError || !signedUrl) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke generere signert URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ url: signedUrl.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'En feil oppstod' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
