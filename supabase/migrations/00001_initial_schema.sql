-- SM NDA Sign Database Schema
-- Initial migration

-- UUID generation uses built-in gen_random_uuid()

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'crew');
CREATE TYPE event_guest_status AS ENUM ('invited', 'signed_pending_verification', 'verified');
CREATE TYPE language AS ENUM ('no', 'en');
CREATE TYPE phone_change_via AS ENUM ('kiosk', 'admin');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    sm_username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    pin_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sm_username_format CHECK (
        sm_username ~ '^[a-z][a-z0-9._-]{2,31}$' AND
        sm_username !~ '\.\.' AND
        sm_username !~ '--' AND
        sm_username !~ '__' AND
        sm_username !~ '[._-]$'
    ),
    CONSTRAINT sm_username_reserved CHECK (
        sm_username NOT IN ('admin', 'crew', 'guest', 'root', 'system', 'support', 'kiosk', 'test', 'null', 'staff', 'event', 'security')
    )
);

-- Guests table
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    sm_username TEXT,
    email TEXT,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT phone_format CHECK (phone ~ '^[0-9]{8,15}$')
);

-- Guests phone history
CREATE TABLE guests_phone_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    old_phone TEXT NOT NULL,
    new_phone TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_via phone_change_via NOT NULL
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    event_date DATE NOT NULL,
    nda_text_no TEXT NOT NULL,
    nda_text_en TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event guests (guestlist per event)
CREATE TABLE event_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sm_username TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    status event_guest_status NOT NULL DEFAULT 'invited',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT event_guests_phone_unique UNIQUE (event_id, phone),
    CONSTRAINT sm_username_format CHECK (
        sm_username ~ '^[a-z][a-z0-9._-]{2,31}$' AND
        sm_username !~ '\.\.' AND
        sm_username !~ '--' AND
        sm_username !~ '__' AND
        sm_username !~ '[._-]$'
    )
);

-- Crew event access
CREATE TABLE crew_event_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    crew_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, crew_user_id)
);

-- Crew invites
CREATE TABLE crew_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App config (single row)
CREATE TABLE app_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    privacy_text_no TEXT NOT NULL DEFAULT '',
    privacy_text_en TEXT NOT NULL DEFAULT '',
    privacy_version INTEGER NOT NULL DEFAULT 1,
    auto_lock_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_lock_minutes INTEGER NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default app config
INSERT INTO app_config (id, privacy_text_no, privacy_text_en) VALUES (
    1,
    'Vi behandler dine personopplysninger i henhold til GDPR. Dine data lagres sikkert i 10 år.',
    'We process your personal data in accordance with GDPR. Your data is stored securely for 10 years.'
);

-- NDA signatures
CREATE TABLE nda_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    language language NOT NULL,
    nda_text_snapshot TEXT NOT NULL,
    nda_text_version INTEGER NOT NULL DEFAULT 1,
    read_confirmed BOOLEAN NOT NULL,
    privacy_accepted BOOLEAN NOT NULL,
    privacy_text_snapshot TEXT NOT NULL,
    privacy_version INTEGER NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature_storage_path TEXT NOT NULL,
    pdf_storage_path TEXT,
    pdf_sha256 TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, guest_id)
);

-- Kiosk sessions
CREATE TABLE kiosk_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    crew_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_guests_phone ON guests(phone);
CREATE INDEX idx_guests_sm_username ON guests(sm_username);
CREATE INDEX idx_event_guests_event_id ON event_guests(event_id);
CREATE INDEX idx_event_guests_sm_username ON event_guests(sm_username);
CREATE INDEX idx_event_guests_phone ON event_guests(phone);
CREATE INDEX idx_event_guests_lookup ON event_guests(event_id, sm_username, phone);
CREATE INDEX idx_nda_signatures_event_id ON nda_signatures(event_id);
CREATE INDEX idx_nda_signatures_guest_id ON nda_signatures(guest_id);
CREATE INDEX idx_nda_signatures_pending ON nda_signatures(event_id, verified_at) WHERE verified_at IS NULL;
CREATE INDEX idx_kiosk_sessions_token ON kiosk_sessions(token_hash);
CREATE INDEX idx_kiosk_sessions_active ON kiosk_sessions(event_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_guests_updated_at BEFORE UPDATE ON event_guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nda_signatures_updated_at BEFORE UPDATE ON nda_signatures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
