
-- 1. TEACHERS
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Teachers" ON teachers;
DROP POLICY IF EXISTS "Public Read Teachers" ON teachers; -- Cleanup old
DROP POLICY IF EXISTS "Admin All Teachers" ON teachers; -- Cleanup old
CREATE POLICY "Public Full Access Teachers" ON teachers FOR ALL USING (true);

-- 2. SUBJECTS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Subjects" ON subjects;
DROP POLICY IF EXISTS "Public Read Subjects" ON subjects;
DROP POLICY IF EXISTS "Admin All Subjects" ON subjects;
CREATE POLICY "Public Full Access Subjects" ON subjects FOR ALL USING (true);

-- 3. SCHEDULES
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Schedules" ON schedules;
DROP POLICY IF EXISTS "Public Read Schedules" ON schedules;
DROP POLICY IF EXISTS "Admin All Schedules" ON schedules;
CREATE POLICY "Public Full Access Schedules" ON schedules FOR ALL USING (true);

-- 4. FACULTY ACCOUNTS
ALTER TABLE faculty_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Faculty" ON faculty_accounts;
DROP POLICY IF EXISTS "Public Read Faculty Accounts" ON faculty_accounts;
DROP POLICY IF EXISTS "Admin All Faculty Accounts" ON faculty_accounts;
CREATE POLICY "Public Full Access Faculty" ON faculty_accounts FOR ALL USING (true);

-- 5. ADMINS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Admins" ON admins;
DROP POLICY IF EXISTS "Public Read Admins" ON admins;
CREATE POLICY "Public Full Access Admins" ON admins FOR ALL USING (true);

-- 6. APP SETTINGS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Settings" ON app_settings;
DROP POLICY IF EXISTS "Public Read Settings" ON app_settings;
DROP POLICY IF EXISTS "Admin All Settings" ON app_settings;
CREATE POLICY "Public Full Access Settings" ON app_settings FOR ALL USING (true);
