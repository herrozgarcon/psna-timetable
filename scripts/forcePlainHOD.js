
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const forcePlainHOD = async () => {
    const email = 'hod.cse@psnacet.edu.in';
    const newPassword = 'hodcse';

    console.log(`Forcing password for ${email} to PLAIN TEXT '${newPassword}'...`);

    const { error } = await supabase
        .from('hod_accounts')
        .update({ password: newPassword })
        .eq('email', email);

    if (error) {
        console.error('Error updating password:', error);
    } else {
        console.log('Success! Password has been reset to PLAIN TEXT.');
        console.log('You can now login with:');
        console.log(`Email: ${email}`);
        console.log(`Password: ${newPassword}`);
    }
};

forcePlainHOD();
