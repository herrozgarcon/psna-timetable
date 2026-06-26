
-- Run this in your Supabase SQL Editor

-- Create Admins Table
create table if not exists admins (
  id text primary key,
  email text unique not null,
  password text not null, -- Store plain for now to match current simple auth, or bcrypt hash if we upgrade
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Policy
alter table admins enable row level security;
create policy "Public Access Admins" on admins for all using (true);

-- Insert Default Admin (You can change this password later in the table)
insert into admins (id, email, password, name)
values (uuid_generate_v4(), 'admin@psnacet.edu.in', 'admin', 'System Admin')
on conflict (email) do nothing;
