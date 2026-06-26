require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixSubjects() {
    const { data: subjects, error } = await supabase.from('subjects').select('*');
    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    console.log(`Found ${subjects.length} subjects.`);
    let fixedCount = 0;

    for (const sub of subjects) {
        // Only fix if credit is greater than 0, and credit equals satCount
        // OR if total is unreasonably high, e.g., credit + satCount > 6
        // Let's print out what we see
        const c = parseInt(sub.credit) || 0;
        const s = parseInt(sub.satCount) || 0;

        if (c > 0 && c === s) {
            console.log(`Fixing ${sub.code} (${sub.name}): credit=${c}, satCount=${s}`);
            
            // Assume the user meant `c` as the TOTAL hours.
            // A typical 5-credit course is 4 + 1 or 5 + 0.
            // A typical 4-credit course is 3 + 1 or 4 + 0.
            // A typical 3-credit course is 2 + 1 or 3 + 0.
            // Let's use: if C >= 3, satCount = 1, else satCount = 0.
            const total = c;
            const newSat = total >= 3 ? 1 : 0;
            const newCredit = total - newSat;

            const { error: updateError } = await supabase
                .from('subjects')
                .update({ credit: newCredit, satCount: newSat })
                .eq('id', sub.id);

            if (updateError) {
                console.error(`Error updating ${sub.code}:`, updateError);
            } else {
                console.log(` -> Updated ${sub.code} to credit=${newCredit}, satCount=${newSat}`);
                fixedCount++;
            }
        } else if (c > 0 && s > 0 && (c + s) > 8) {
            console.log(`Suspicious: ${sub.code} (${sub.name}): credit=${c}, satCount=${s}`);
        }
    }
    console.log(`Fixed ${fixedCount} subjects.`);
}

fixSubjects();
