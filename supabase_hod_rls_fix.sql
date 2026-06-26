
-- FIX RLS POLICIES FOR HOD ACCOUNTS
-- Run this to allow the login page to see the HOD user

ALTER TABLE hod_accounts ENABLE ROW LEVEL SECURITY;

-- Drop generic policy if exists
DROP POLICY IF EXISTS "Public Read HODs" ON hod_accounts;
DROP POLICY IF EXISTS "Public Access HODs" ON hod_accounts;

-- Create a permissive policy for SELECT
CREATE POLICY "Public Read HODs"
ON hod_accounts
FOR SELECT
USING (true);

-- Allow Insert/Update for authenticated users (optional, for admin usage later)
CREATE POLICY "Admin All HODs"
ON hod_accounts
FOR ALL
USING (true)
WITH CHECK (true);
