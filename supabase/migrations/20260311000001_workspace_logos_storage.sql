-- Migration: bucket workspace-logos + policies
-- Armazena logos de workspace por founder
-- Cada user só acessa/escreve na sua própria pasta (user_id/)

-- Cria o bucket como público (logos são exibidos sem autenticação)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'workspace-logos',
    'workspace-logos',
    true,
    2097152, -- 2 MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: leitura pública (logos precisam ser acessíveis sem auth)
DROP POLICY IF EXISTS "workspace-logos: public read" ON storage.objects;
CREATE POLICY "workspace-logos: public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'workspace-logos');

-- Policy: upload autenticado apenas na própria pasta (user_id/*)
DROP POLICY IF EXISTS "workspace-logos: owner upload" ON storage.objects;
CREATE POLICY "workspace-logos: owner upload"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'workspace-logos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: atualização autenticada apenas na própria pasta
DROP POLICY IF EXISTS "workspace-logos: owner update" ON storage.objects;
CREATE POLICY "workspace-logos: owner update"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'workspace-logos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: deleção autenticada apenas na própria pasta
DROP POLICY IF EXISTS "workspace-logos: owner delete" ON storage.objects;
CREATE POLICY "workspace-logos: owner delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'workspace-logos'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
