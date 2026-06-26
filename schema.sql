
-- SUPABASE SCHEMA DUMP
-- PSNA TIMETABLES DATABASE STRUCTURE

-- 1. TEACHERS
create table if not exists teachers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  dept text,
  "subjectCode" text, -- Note: quoted because of camelCase in some versions, sticking to text for now
  section text,
  max_hours integer default 15,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table teachers enable row level security;
create policy "Public Read Teachers" on teachers for select using (true);
create policy "Admin All Teachers" on teachers for all using (true);

-- 2. SUBJECTS
create table if not exists subjects (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  name text not null,
  semester text,
  dept text,
  credit integer default 3,
  "satCount" integer default 0,
  type text default 'Theory', -- Theory, Lab, Elective
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table subjects enable row level security;
create policy "Public Read Subjects" on subjects for select using (true);
create policy "Admin All Subjects" on subjects for all using (true);

-- 3. SCHEDULES (Stores the grid data as JSON)
create table if not exists schedules (
  id uuid default gen_random_uuid() primary key,
  semester text not null,
  section text not null,
  data jsonb not null, -- The entire grid structure
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(semester, section)
);
alter table schedules enable row level security;
create policy "Public Read Schedules" on schedules for select using (true);
create policy "Admin All Schedules" on schedules for all using (true);

-- 4. FACULTY ACCOUNTS (For Login)
create table if not exists faculty_accounts (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password text not null, -- Stores bcrypt hash
  name text,
  dept text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table faculty_accounts enable row level security;
create policy "Public Read Faculty Accounts" on faculty_accounts for select using (true);
create policy "Admin All Faculty Accounts" on faculty_accounts for all using (true);

-- 5. ADMINS (Super Users)
create table if not exists admins (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password text not null, -- Stores bcrypt hash
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table admins enable row level security;
create policy "Public Read Admins" on admins for all using (true); -- Modified to allow login check

-- 6. APP SETTINGS (Global Config like Time Slots)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);
alter table app_settings enable row level security;
create policy "Public Read Settings" on app_settings for select using (true);
create policy "Admin All Settings" on app_settings for all using (true);

-- INITIAL SEED DATA (Examples)
-- insert into admins (email, password, name) values ('admin@psnacet.edu.in', '$2a$10$...', 'Super Admin');
