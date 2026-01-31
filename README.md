# SM NDA Sign (Kiosk)

En produksjonsklar webapp for NDA-signering ved eventer med kiosk-modus, touch-signatur og PDF-generering.

## Funksjoner

- **Kiosk-modus**: Crew logger inn og starter registrering for et event
- **Gjestesignering**: Touch-vennlig signatur på iPad uten innlogging
- **ID-attestering**: Crew verifiserer gjestens identitet
- **Admin-dashboard**: Administrer eventer, gjestelister, crew og signeringer
- **PDF-generering**: Server-side PDF med SHA256-hash
- **Flerspråk**: Norsk og engelsk
- **Offline-støtte**: Signeringer lagres lokalt ved nettverksproblemer

## Oppsett

### 1. Supabase

1. Opprett et nytt prosjekt på [supabase.com](https://supabase.com)
2. Gå til **SQL Editor** og kjør migrasjonene i rekkefølge:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_rls_policies.sql`
   - `supabase/migrations/00003_storage_buckets.sql`
3. Gå til **Settings > API** og kopier:
   - Project URL
   - anon/public key
   - service_role key (for Edge Functions)

### 2. Edge Functions

Deploy Edge Functions til Supabase:

```bash
# Installer Supabase CLI
npm install -g supabase

# Logg inn
supabase login

# Link til prosjektet
supabase link --project-ref YOUR_PROJECT_REF

# Deploy alle functions
supabase functions deploy auth-username-login
supabase functions deploy auth-register-crew
supabase functions deploy auth-request-password-reset
supabase functions deploy kiosk-start-session
supabase functions deploy guest-lookup-and-prefill
supabase functions deploy guest-submit-signature
supabase functions deploy generate-nda-pdf
supabase functions deploy get-signed-url
```

### 3. Miljøvariabler

Opprett `.env` fil i prosjektmappen:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Opprett Admin-bruker

1. Gå til Supabase **Authentication > Users**
2. Klikk "Add user" og opprett en bruker med e-post/passord
3. Kjør denne SQL-en for å gi admin-rolle:

```sql
INSERT INTO profiles (user_id, role, sm_username, full_name)
VALUES (
  'USER_ID_FRA_AUTH', 
  'admin', 
  'admin.brukernavn', 
  'Admin Navn'
);
```

### 5. Lokal utvikling

```bash
npm install
npm run dev
```

### 6. Deploy til Vercel

1. Push koden til GitHub
2. Importer prosjektet i [Vercel](https://vercel.com)
3. Legg til miljøvariabler:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

## CSV-format for gjesteliste

```csv
sm_username,first_name,last_name,phone,email
ola.nordmann,Ola,Nordmann,4746427042,ola@example.com
kari.hansen,Kari,Hansen,4798765432,kari@example.com
```

## Roller

| Rolle | Tilgang |
|-------|---------|
| **Admin** | Alt: eventer, gjestelister, crew, signeringer, innstillinger |
| **Crew** | Tildelte eventer, kiosk-modus, attestering |
| **Guest** | Kun signering via aktiv kiosk-sesjon |

## Sikkerhet

- RLS (Row Level Security) på alle tabeller
- Gjeste-operasjoner går via Edge Functions med service role
- Kiosk-token valideres server-side
- Storage buckets er private (kun signed URLs)
- Ingen sletting av signaturer/PDF (10 års retention)

## Teknisk stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **PDF**: pdf-lib (server-side)
- **Deploy**: Vercel
