import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Helper to sanitize text for PDF (remove newlines and control characters)
function sanitizeText(text: string | null | undefined): string {
  if (!text) return '-'
  return text.replace(/[\n\r\t\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim() || '-'
}

// Dynamic import for pdf-lib to handle potential loading issues
let PDFDocument: any, rgb: any, StandardFonts: any

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Lazy load pdf-lib
    if (!PDFDocument) {
      const pdfLib = await import('https://esm.sh/pdf-lib@1.17.1')
      PDFDocument = pdfLib.PDFDocument
      rgb = pdfLib.rgb
      StandardFonts = pdfLib.StandardFonts
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Ikke autorisert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { signature_id } = await req.json()

    if (!signature_id) {
      return new Response(
        JSON.stringify({ error: 'Signatur ID er påkrevd' }),
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
        JSON.stringify({ error: 'Kun admin eller crew kan generere PDF' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get signature with related data
    const { data: signature, error: sigError } = await supabaseAdmin
      .from('nda_signatures')
      .select(`
        *,
        events:event_id (id, name, event_date),
        guests:guest_id (id, phone, first_name, last_name, sm_username, email, location)
      `)
      .eq('id', signature_id)
      .single()

    if (sigError || !signature) {
      return new Response(
        JSON.stringify({ error: 'Signatur ikke funnet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check crew access to event
    if (profile.role === 'crew') {
      const { data: access } = await supabaseAdmin
        .from('crew_event_access')
        .select('id')
        .eq('crew_user_id', user.id)
        .eq('event_id', signature.event_id)
        .single()

      if (!access) {
        return new Response(
          JSON.stringify({ error: 'Du har ikke tilgang til dette eventet' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if PDF already exists
    if (signature.pdf_storage_path) {
      const { data: signedUrl } = await supabaseAdmin.storage
        .from('pdfs')
        .createSignedUrl(signature.pdf_storage_path, 3600)

      if (signedUrl) {
        return new Response(
          JSON.stringify({ url: signedUrl.signedUrl, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get signature image
    const { data: signatureImage } = await supabaseAdmin.storage
      .from('signatures')
      .download(signature.signature_storage_path)

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const { width, height } = page.getSize()
    let y = height - 50

    // Header
    page.drawText('TAUSHETSERKLÆRING / NDA', {
      x: 50,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.48, 0.02, 0.47), // #7B0577
    })
    y -= 30

    // Event info
    const event = signature.events as any
    page.drawText(`Event: ${sanitizeText(event.name)}`, { x: 50, y, size: 12, font: fontBold })
    y -= 20
    page.drawText(`Dato: ${sanitizeText(event.event_date)}`, { x: 50, y, size: 10, font })
    y -= 30

    // Guest info
    const guest = signature.guests as any
    page.drawText('Personopplysninger:', { x: 50, y, size: 12, font: fontBold })
    y -= 18
    page.drawText(`Navn: ${sanitizeText(guest.first_name)} ${sanitizeText(guest.last_name)}`, { x: 50, y, size: 10, font })
    y -= 15
    page.drawText(`SpicyMatch brukernavn: ${sanitizeText(guest.sm_username)}`, { x: 50, y, size: 10, font })
    y -= 15
    page.drawText(`Mobil: ${sanitizeText(guest.phone)}`, { x: 50, y, size: 10, font })
    y -= 15
    page.drawText(`E-post: ${sanitizeText(guest.email)}`, { x: 50, y, size: 10, font })
    y -= 15
    page.drawText(`Sted: ${sanitizeText(guest.location)}`, { x: 50, y, size: 10, font })
    y -= 30

    // NDA text
    page.drawText('NDA-tekst:', { x: 50, y, size: 12, font: fontBold })
    y -= 18

    // Split NDA text into paragraphs (double newlines or single newlines)
    const rawNdaText = signature.nda_text_snapshot || ''
    const paragraphs = rawNdaText.split(/\n\s*\n|\n/).filter((p: string) => p.trim())
    const maxWidth = width - 100
    const fontSize = 9

    for (const paragraph of paragraphs) {
      // Sanitize paragraph text (remove control chars but keep as single paragraph)
      const cleanParagraph = paragraph.replace(/[\r\t\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim()
      if (!cleanParagraph) continue

      const words = cleanParagraph.split(' ')
      let line = ''

      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)
        if (textWidth > maxWidth) {
          page.drawText(line, { x: 50, y, size: fontSize, font })
          y -= 12
          line = word
          if (y < 200) break // Leave room for signature
        } else {
          line = testLine
        }
      }
      if (line && y >= 200) {
        page.drawText(line, { x: 50, y, size: fontSize, font })
        y -= 12
      }
      // Add extra space between paragraphs
      y -= 8
      if (y < 200) break
    }

    // Confirmations
    y -= 10
    page.drawText('Bekreftelser:', { x: 50, y, size: 12, font: fontBold })
    y -= 18
    page.drawText(`[X] Lest og forstatt: ${signature.read_confirmed ? 'Ja' : 'Nei'}`, { x: 50, y, size: 10, font })
    y -= 15
    page.drawText(`[X] Personvern akseptert: ${signature.privacy_accepted ? 'Ja' : 'Nei'} (versjon ${signature.privacy_version})`, { x: 50, y, size: 10, font })
    y -= 30

    // Signature image
    if (signatureImage) {
      try {
        const imageBytes = await signatureImage.arrayBuffer()
        const pngImage = await pdfDoc.embedPng(new Uint8Array(imageBytes))
        const imgDims = pngImage.scale(0.5)
        page.drawImage(pngImage, {
          x: 50,
          y: y - imgDims.height,
          width: Math.min(imgDims.width, 200),
          height: Math.min(imgDims.height, 80),
        })
        y -= Math.min(imgDims.height, 80) + 20
      } catch (e) {
        // Skip if image embedding fails
      }
    }

    // Timestamps
    y -= 10
    page.drawText(`Signert: ${new Date(signature.signed_at).toLocaleString('no-NO')}`, { x: 50, y, size: 10, font })
    y -= 15
    if (signature.verified_at) {
      page.drawText(`Verifisert: ${new Date(signature.verified_at).toLocaleString('no-NO')}`, { x: 50, y, size: 10, font })
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // Calculate SHA256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const pdfHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Store PDF
    const pdfPath = `${signature.event_id}/Taushetserklering-sign-${guest.first_name}-${guest.last_name}-${signature.event_id}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(pdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke lagre PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update signature record with PDF path and hash
    await supabaseAdmin
      .from('nda_signatures')
      .update({
        pdf_storage_path: pdfPath,
        pdf_sha256: pdfHash
      })
      .eq('id', signature_id)

    // Get signed URL
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('pdfs')
      .createSignedUrl(pdfPath, 3600)

    // Log the action
    await supabaseAdmin.from('audit_log').insert({
      actor_user_id: user.id,
      action: 'pdf_generated',
      entity_type: 'nda_signature',
      entity_id: signature_id,
      meta: { pdf_hash: pdfHash }
    })

    return new Response(
      JSON.stringify({ url: signedUrl?.signedUrl, cached: false, hash: pdfHash }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('PDF generation error:', error)
    return new Response(
      JSON.stringify({ error: 'En feil oppstod ved PDF-generering', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
