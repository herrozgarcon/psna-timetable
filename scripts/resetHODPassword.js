
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const resetHODPassword = async () => {
    const email = 'hod.cse@psnacet.edu.in';
    const newPassword = 'hodcse';

    console.log(`Resetting password for ${email} to '${newPassword}' (hashed)...`);

    // Generate a valid bcrypt hash
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);

    console.log('Generated Hash:', hashedPassword);

    const { error } = await supabase
        .from('hod_accounts')
        .update({ password: hashedPassword })
        .eq('email', email);

    if (error) {
        console.error('Error updating password:', error);
    } else {
        console.log('Success! Password has been reset and hashed.');
        console.log('You can now login with:');
        console.log(`Email: ${email}`);
        console.log(`Password: ${newPassword}`);
    }
};

resetHODPassword();
