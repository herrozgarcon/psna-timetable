
-- Run this in your Supabase SQL Editor to fix the missing column issue

ALTER TABLE faculty_accounts 
ADD COLUMN IF NOT EXISTS can_generate BOOLEAN DEFAULT FALSE;

-- Ensure RLS policies allow inserts (in case they were not applied)
ALTER TABLE faculty_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'faculty_accounts' AND policyname = 'Public Full Access Faculty'
    ) THEN
        CREATE POLICY "Public Full Access Faculty" ON faculty_accounts FOR ALL USING (true);
    END IF;
END
$$;
