
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// NOTE: For migration scripts that write data bypassing RLS or updating system fields, 
// using the SERVICE_ROLE_KEY is often preferred, but here we will try with the ANON key 
// since we likely have open permissions for now. If this fails, we need the SERVICE_ROLE_KEY.
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migratePasswords = async () => {
    console.log('Starting password migration...');

    // 1. Migrate Admin Accounts
    console.log('Fetching admins...');
    const { data: admins, error: adminError } = await supabase.from('admins').select('*');

    if (adminError) {
        console.error('Error fetching admins:', adminError);
    } else {
        let adminCount = 0;
        for (const admin of admins) {
            // Check if password is NOT already hashed
            if (!admin.password.startsWith('$2')) {
                const hashedPassword = bcrypt.hashSync(admin.password, 10);
                const { error: updateError } = await supabase
                    .from('admins')
                    .update({ password: hashedPassword })
                    .eq('id', admin.id);

                if (updateError) {
                    console.error(`Failed to update admin ${admin.email}:`, updateError);
                } else {
                    console.log(`Migrated admin: ${admin.email}`);
                    adminCount++;
                }
            }
        }
        console.log(`Finished migrating ${adminCount} admin accounts.`);
    }

    // 2. Migrate Faculty Accounts
    console.log('Fetching faculty accounts...');
    const { data: faculty, error: facultyError } = await supabase.from('faculty_accounts').select('*');

    if (facultyError) {
        console.error('Error fetching faculty accounts:', facultyError);
    } else {
        let facultyCount = 0;
        for (const acc of faculty) {
            // Check if password is NOT already hashed
            if (acc.password && !acc.password.startsWith('$2')) {
                const hashedPassword = bcrypt.hashSync(acc.password, 10);
                const { error: updateError } = await supabase
                    .from('faculty_accounts')
                    .update({ password: hashedPassword })
                    .eq('id', acc.id);

                if (updateError) {
                    console.error(`Failed to update faculty ${acc.email}:`, updateError);
                } else {
                    // console.log(`Migrated faculty: ${acc.email}`); // Too noisy for many accounts
                    facultyCount++;
                }
            }
        }
        console.log(`Finished migrating ${facultyCount} faculty accounts.`);
    }

    console.log('Migration complete.');
};

migratePasswords();
