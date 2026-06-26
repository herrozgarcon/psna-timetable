-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Teachers Table
create table if not exists teachers (
  id text primary key,
  name text,
  dept text,
  semester text,
  "subjectCode" text, -- Quoted to preserve case if needed, but better to use snake_case. 
                      -- However, app uses subjectCode. I'll use snake_case in DB and map it, 
                      -- or just use JSONB to avoid mapping issues. 
                      -- Let's use JSONB or matching column names. 
                      -- Matching column names with quotes is easiest for 'insert(object)'.
  "subjectName" text,
  section text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Subjects Table
create table if not exists subjects (
  id text primary key,
  code text,
  name text,
  semester text,
  credit int,
  type text,
  "satCount" int,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Schedules Table
create table if not exists schedules (
  semester text primary key,
  data jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Faculty Accounts Table
create table if not exists faculty_accounts (
  id text primary key,
  name text,
  email text,
  password text,
  dept text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- App Settings (TimeSlots, Constraints, Department, etc.)
create table if not exists app_settings (
  key text primary key,
  value jsonb
);

-- Policies (Make everything public for this demo since we are replicating local storage behavior)
alter table teachers enable row level security;
alter table subjects enable row level security;
alter table schedules enable row level security;
alter table faculty_accounts enable row level security;
alter table app_settings enable row level security;

create policy "Public Access Teachers" on teachers for all using (true);
create policy "Public Access Subjects" on subjects for all using (true);
create policy "Public Access Schedules" on schedules for all using (true);
create policy "Public Access Faculty" on faculty_accounts for all using (true);
create policy "Public Access Settings" on app_settings for all using (true);
