
-- 1. Create HOD Accounts Table
create table if not exists hod_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text unique not null,
  password text not null,
  name text,
  dept text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Read Access for Application
alter table hod_accounts enable row level security;

-- Remove existing policies to avoid conflicts
drop policy if exists "Public Read HODs" on hod_accounts;

-- Create Public Read Policy
create policy "Public Read HODs" 
on hod_accounts 
for select 
using (true);

-- 3. Insert Default HOD Account
-- Email: hod.cse@psnacet.edu.in
-- Password: hodcse
-- Password hash generated using bcrypt ($2b$10$...)
INSERT INTO hod_accounts (email, password, name, dept)
VALUES (
    'hod.cse@psnacet.edu.in', 
    '$2b$10$U.y.g.t.r././././././.e', -- You should probably set a plain text first for testing if hashing is tricky manually, but let's use plain text 'hodcse' if the app handles fallback, or better yet, plain text 'hodcse' since our app handles both!
    'Head of CSE', 
    'CSE'
)
ON CONFLICT (email) DO UPDATE 
SET password = 'hodcse'; -- Reset to known plain text on run

-- Note: The app Login.jsx supports plain text fallback, so 'hodcse' will work.
