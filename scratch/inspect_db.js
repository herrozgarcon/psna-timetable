import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*');

  if (error) {
    console.error("Error fetching subjects:", error);
    return;
  }

  console.log(`\n--- All Subjects in Database (${subjects.length} total) ---`);
  subjects.forEach(s => {
    console.log(`ID: ${s.id} | Code: ${s.code} | Name: ${s.name} | Credit: ${s.credit} | SatCount: ${s.satCount} | Type: ${s.type} | Sem: ${s.semester}`);
  });
}

inspect();
