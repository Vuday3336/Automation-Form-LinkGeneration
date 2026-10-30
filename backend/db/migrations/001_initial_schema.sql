-- 001_initial_schema.sql
-- Creates every table HospitalForm AI needs. Applied by `npm run migrate`.
-- Naming: database columns use snake_case; the API converts them to camelCase.

-- ─── Hospitals ───────────────────────────────────────────────────────────────
create table hospitals (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name        text not null check (length(name) between 2 and 200),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index hospitals_name_lower_key on hospitals (lower(name));

-- ─── Users ───────────────────────────────────────────────────────────────────
create table users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(name) between 2 and 120),
  email          text not null,
  password_hash  text not null,
  role           text not null check (role in ('super_admin', 'hospital_admin', 'staff', 'viewer')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Emails are unique regardless of upper/lower case.
create unique index users_email_lower_key on users (lower(email));

-- Which hospitals each user may see ("hospitalAccess"). A join table instead of an
-- array, so the database itself guarantees every entry points to a real hospital.
create table user_hospital_access (
  user_id      uuid not null references users (id) on delete cascade,
  hospital_id  uuid not null references hospitals (id) on delete cascade,
  primary key (user_id, hospital_id)
);
create index user_hospital_access_hospital_idx on user_hospital_access (hospital_id);

-- ─── Submissions ─────────────────────────────────────────────────────────────
create table submissions (
  id                      uuid primary key default gen_random_uuid(),  -- internal, never shown in URLs
  submission_id           text not null unique,                        -- public, e.g. HF-20261030-7K3QX9PA
  source                  text not null default 'google_form',
  source_response_id      text not null,
  hospital_id             uuid references hospitals (id) on delete restrict,  -- null = not matched yet
  hospital_name           text not null,                               -- as typed in the form
  department              text,
  submission_type         text,
  submitted_at            timestamptz not null,
  -- Sensitive fields are encrypted by the backend (AES-256-GCM) BEFORE they reach the database.
  -- Even someone reading the raw table (or a backup) only sees ciphertext.
  patient_name_encrypted  text,
  form_data_encrypted     text not null,
  status                  text not null default 'Pending'
                          check (status in ('Pending', 'Under Review', 'Approved', 'Rejected', 'Completed')),
  secure_token_hash       text unique,                                 -- SHA-256 of the link token, never the token
  link_expires_at         timestamptz,
  link_revoked_at         timestamptz,
  archived_at             timestamptz,                                 -- soft delete: hidden, never destroyed
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Duplicate protection: the same Google response can only ever be stored once.
  constraint submissions_source_response_key unique (source, source_response_id)
);
create index submissions_hospital_created_idx on submissions (hospital_id, created_at desc);
create index submissions_status_idx on submissions (status);
create index submissions_department_idx on submissions (department);
create index submissions_created_idx on submissions (created_at desc);

-- ─── Audit log ───────────────────────────────────────────────────────────────
create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users (id) on delete set null,  -- null = system / integration
  action         text not null,
  submission_id  text,                                            -- public submission ID
  metadata       jsonb not null default '{}'::jsonb,              -- never patient or medical details
  created_at     timestamptz not null default now()
);
create index audit_logs_submission_idx on audit_logs (submission_id, created_at desc);
create index audit_logs_user_idx on audit_logs (user_id, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);

-- ─── Keep updated_at current automatically ───────────────────────────────────
create function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger hospitals_set_updated_at before update on hospitals
  for each row execute function set_updated_at();
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();
create trigger submissions_set_updated_at before update on submissions
  for each row execute function set_updated_at();

-- ─── Lock down Supabase's public API ─────────────────────────────────────────
-- Supabase automatically exposes every table through its REST API to the "anon" and
-- "authenticated" roles. Our Express backend is the only gatekeeper, so we turn on
-- Row Level Security with NO policies (= nobody gets rows through that API) and also
-- revoke the privileges outright. The backend connects as the database owner, which
-- isn't affected.
alter table hospitals enable row level security;
alter table users enable row level security;
alter table user_hospital_access enable row level security;
alter table submissions enable row level security;
alter table audit_logs enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on hospitals, users, user_hospital_access, submissions, audit_logs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on hospitals, users, user_hospital_access, submissions, audit_logs from authenticated;
  end if;
end
$$;
