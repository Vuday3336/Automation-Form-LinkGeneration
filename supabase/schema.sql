-- HospitalForm demo: everything the database needs.
-- Run once in Supabase → SQL Editor (already applied to the project).

-- One row per Google Form response.
create table if not exists public.form_submissions (
  id            bigint generated always as identity primary key,
  -- Random 64-character token used in the link. Unguessable, so links can't be enumerated.
  token         text not null unique
                default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  -- Identifies the sheet row, so a re-run of the trigger can't create a duplicate.
  response_key  text unique,
  form_title    text,
  answers       jsonb not null,          -- [{ "question": "...", "answer": "..." }, ...]
  created_at    timestamptz not null default now()
);

-- Nobody reads or writes the table directly with the public key.
-- Access only goes through the two functions below.
alter table public.form_submissions enable row level security;
revoke all on public.form_submissions from anon, authenticated;

-- Called by Google Apps Script: saves the answers and returns the link token.
-- Sending the same response_key again returns the existing token instead of a duplicate row.
create or replace function public.create_submission(p_answers jsonb, p_response_key text, p_form_title text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'answers must be a non-empty array';
  end if;
  if octet_length(p_answers::text) > 100000 then
    raise exception 'answers are too large';
  end if;

  insert into public.form_submissions (answers, response_key, form_title)
  values (p_answers, p_response_key, left(p_form_title, 300))
  on conflict (response_key) do update set response_key = excluded.response_key
  returning token into v_token;

  return v_token;
end;
$$;

-- Called by the viewer page: returns one submission for a token (null if unknown).
create or replace function public.get_submission(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('form_title', form_title, 'answers', answers, 'created_at', created_at)
  from public.form_submissions
  where token = p_token;
$$;

revoke execute on function public.create_submission(jsonb, text, text) from public;
revoke execute on function public.get_submission(text) from public;
grant execute on function public.create_submission(jsonb, text, text) to anon;
grant execute on function public.get_submission(text) to anon;
