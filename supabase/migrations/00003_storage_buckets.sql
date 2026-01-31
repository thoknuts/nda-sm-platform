-- Storage buckets for SM NDA Sign
-- Buckets are private - access via signed URLs only

-- Create signatures bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'signatures',
    'signatures',
    false,
    5242880, -- 5MB
    ARRAY['image/png']
);

-- Create pdfs bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pdfs',
    'pdfs',
    false,
    10485760, -- 10MB
    ARRAY['application/pdf']
);

-- Storage policies for signatures bucket
CREATE POLICY "Service role can insert signatures"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Service role can read signatures"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'signatures');

CREATE POLICY "Admin can read signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'signatures' AND
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Crew can read signatures for assigned events"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'signatures' AND
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN crew_event_access cea ON cea.crew_user_id = p.user_id
        JOIN nda_signatures ns ON ns.event_id = cea.event_id
        WHERE p.user_id = auth.uid() 
        AND p.role = 'crew'
        AND ns.signature_storage_path = name
    )
);

-- No delete/update for signatures (append-only for 10 year retention)
-- Storage policies for pdfs bucket
CREATE POLICY "Service role can insert pdfs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Service role can read pdfs"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'pdfs');

CREATE POLICY "Admin can read pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'pdfs' AND
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Crew can read pdfs for assigned events"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'pdfs' AND
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN crew_event_access cea ON cea.crew_user_id = p.user_id
        JOIN nda_signatures ns ON ns.event_id = cea.event_id
        WHERE p.user_id = auth.uid() 
        AND p.role = 'crew'
        AND ns.pdf_storage_path = name
    )
);

-- No delete/update for pdfs (append-only for 10 year retention)
