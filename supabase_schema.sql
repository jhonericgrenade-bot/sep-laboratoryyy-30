-- ScholarTrack / Scholarship Monitoring System
-- Paste this entire file into Supabase: SQL Editor > New query > Run
-- GWA policy used here: lower is better (1.00 is highest, 5.00 is lowest).

create extension if not exists pgcrypto;

-- 1) User profile linked to Supabase Authentication users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'scholar' check (role in ('admin', 'staff', 'scholar')),
  created_at timestamptz not null default now()
);

-- Make a profile automatically whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'New User'),
    coalesce(new.raw_user_meta_data ->> 'role', 'scholar')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) Scholarship policy/rules. Each scholar must point to one active program.
create table if not exists public.scholarship_programs (
  id uuid primary key default gen_random_uuid(),
  program_name text not null unique,
  required_gwa numeric(3,2) not null check (required_gwa between 1.00 and 5.00),
  min_units integer not null check (min_units >= 0),
  allow_failing_grade boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) Scholarship recipients
create table if not exists public.scholars (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique check (length(trim(student_id)) > 0),
  full_name text not null check (length(trim(full_name)) > 0),
  degree_program text not null,
  year_level text not null,
  scholarship_id uuid not null references public.scholarship_programs(id) on update cascade,
  status text not null default 'Active' check (status in (
    'Active', 'Pending Submission', 'For Verification', 'Compliant',
    'With Deficiency', 'Probationary', 'For Renewal', 'Renewed', 'Disqualified'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Every semester's submitted academic record
create table if not exists public.grade_submissions (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references public.scholars(id) on delete cascade,
  academic_year text not null check (length(trim(academic_year)) > 0),
  semester text not null check (semester in ('1st Semester', '2nd Semester', 'Summer')),
  gwa numeric(3,2) not null check (gwa between 1.00 and 5.00),
  units_enrolled integer not null check (units_enrolled >= 0),
  failed_subjects integer not null default 0 check (failed_subjects >= 0),
  incomplete_subjects integer not null default 0 check (incomplete_subjects >= 0),
  submission_status text not null default 'Pending' check (submission_status in ('Pending', 'Verified', 'Returned')),
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  evaluation_status text check (evaluation_status in ('Compliant', 'With Deficiency')),
  evaluation_reason text,
  unique (scholar_id, academic_year, semester)
);

-- Useful indexes for dashboard/search operations
create index if not exists scholars_status_idx on public.scholars(status);
create index if not exists scholars_scholarship_idx on public.scholars(scholarship_id);
create index if not exists grade_submissions_status_idx on public.grade_submissions(submission_status);
create index if not exists grade_submissions_scholar_idx on public.grade_submissions(scholar_id);

-- Keep scholars.updated_at correct whenever their record changes.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scholars_updated_at on public.scholars;
create trigger scholars_updated_at before update on public.scholars
for each row execute procedure public.set_updated_at();

-- Evaluation is allowed only after verification. It also updates the scholar's current status.
create or replace function public.verify_and_evaluate_submission(p_submission_id uuid)
returns public.grade_submissions
language plpgsql
security definer set search_path = public
as $$
declare
  v_submission public.grade_submissions;
  v_program public.scholarship_programs;
  v_reasons text[] := '{}';
  v_result text;
begin
  -- Only a signed-in Staff or Admin may run this action.
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  ) then
    raise exception 'Only authorized staff may verify submissions';
  end if;

  select gs.* into v_submission
  from public.grade_submissions gs
  where gs.id = p_submission_id
  for update;

  if not found then raise exception 'Grade submission not found'; end if;

  select sp.* into v_program
  from public.scholars s
  join public.scholarship_programs sp on sp.id = s.scholarship_id
  where s.id = v_submission.scholar_id;

  if not found then raise exception 'Scholarship program not found'; end if;
  if v_submission.submission_status <> 'Pending' then
    raise exception 'Only Pending submissions can be verified';
  end if;

  if v_submission.gwa > v_program.required_gwa then
    v_reasons := array_append(v_reasons, format('GWA %s exceeds required GWA %s', v_submission.gwa, v_program.required_gwa));
  end if;
  if v_submission.units_enrolled < v_program.min_units then
    v_reasons := array_append(v_reasons, format('%s enrolled units is below the required %s', v_submission.units_enrolled, v_program.min_units));
  end if;
  if not v_program.allow_failing_grade and v_submission.failed_subjects > 0 then
    v_reasons := array_append(v_reasons, 'Failing grades are not allowed by this scholarship');
  end if;
  if v_submission.incomplete_subjects > 0 then
    v_reasons := array_append(v_reasons, 'Incomplete subjects must be cleared');
  end if;

  v_result := case when coalesce(array_length(v_reasons, 1), 0) = 0 then 'Compliant' else 'With Deficiency' end;

  update public.grade_submissions
  set submission_status = 'Verified', verified_by = auth.uid(), verified_at = now(),
      evaluation_status = v_result, evaluation_reason = case when v_result = 'Compliant' then 'All academic requirements were satisfied.' else array_to_string(v_reasons, '; ') end
  where id = p_submission_id
  returning * into v_submission;

  update public.scholars set status = v_result where id = v_submission.scholar_id;
  return v_submission;
end;
$$;

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.scholarship_programs enable row level security;
alter table public.scholars enable row level security;
alter table public.grade_submissions enable row level security;

-- For the classroom prototype, all signed-in users can read data.
-- Create/update of records is restricted to Staff/Admin; verification is enforced by the RPC above.
create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'));
$$;

drop policy if exists "authenticated read profiles" on public.profiles;
drop policy if exists "staff manage profiles" on public.profiles;
create policy "authenticated read profiles" on public.profiles for select to authenticated using (true);
create policy "staff manage profiles" on public.profiles for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "authenticated read programs" on public.scholarship_programs;
drop policy if exists "staff manage programs" on public.scholarship_programs;
create policy "authenticated read programs" on public.scholarship_programs for select to authenticated using (true);
create policy "staff manage programs" on public.scholarship_programs for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "authenticated read scholars" on public.scholars;
drop policy if exists "staff manage scholars" on public.scholars;
create policy "authenticated read scholars" on public.scholars for select to authenticated using (true);
create policy "staff manage scholars" on public.scholars for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "authenticated read submissions" on public.grade_submissions;
drop policy if exists "staff create submissions" on public.grade_submissions;
create policy "authenticated read submissions" on public.grade_submissions for select to authenticated using (true);
create policy "staff create submissions" on public.grade_submissions for insert to authenticated with check (public.is_staff_or_admin());

-- Sample data. Run after creating a Staff/Admin account and profile.
insert into public.scholarship_programs (program_name, required_gwa, min_units, allow_failing_grade)
values
  ('University Merit Scholarship', 1.75, 18, false),
  ('Government Academic Grant', 2.25, 15, false),
  ('Private Partner Scholarship', 2.50, 12, true)
on conflict (program_name) do nothing;

insert into public.scholars (student_id, full_name, degree_program, year_level, scholarship_id, status)
select '2026-0001', 'Maria Santos', 'BS Information Technology', '3rd Year', id, 'Active'
from public.scholarship_programs where program_name = 'University Merit Scholarship'
on conflict (student_id) do nothing;

-- AFTER you register in Supabase Auth, promote your user to admin in SQL Editor:
-- update public.profiles set role = 'admin' where id = 'PASTE-YOUR-AUTH-USER-UUID-HERE';
