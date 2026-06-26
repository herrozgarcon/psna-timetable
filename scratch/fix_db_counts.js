import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabase() {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('semester', 'SEMESTER V');

  if (error) {
    console.error("Error fetching subjects:", error);
    return;
  }

  console.log(`Updating Saturday counts for Semester V subjects...`);

  for (const sub of subjects) {
    let newSatCount = 0;

    // Based on the syllabus:
    // Theory subjects CS2C11, CS2512, CS2513, CS2C14, and Electives CS2V31, CS2V23 have exactly 1 Saturday hour.
    // Labs and mandatory courses have 0 Saturday hours.
    if (
      ['CS2C11', 'CS2512', 'CS2513', 'CS2C14', 'CS2V31', 'CS2V23'].includes(sub.code) &&
      sub.type !== 'Lab' && !sub.name.toUpperCase().includes('LAB')
    ) {
      newSatCount = 1;
    } else {
      newSatCount = 0;
    }

    console.log(`Subject: ${sub.code} (${sub.name}) | Old SatCount: ${sub.satCount} -> New SatCount: ${newSatCount}`);

    const { error: updateError } = await supabase
      .from('subjects')
      .update({ satCount: newSatCount })
      .eq('id', sub.id);

    if (updateError) {
      console.error(`Failed to update ${sub.code}:`, updateError);
    }
  }

  console.log("Database update complete! Please refresh your website to see the corrected counts.");
}

fixDatabase();
