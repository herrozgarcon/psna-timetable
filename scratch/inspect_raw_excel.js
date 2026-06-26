import XLSX from 'xlsx';

const wb = XLSX.readFile('sample_timetable_data.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
const rows = [];
for (let R = 0; R <= range.e.r; ++R) {
    const row = [];
    for (let C = 0; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
        row.push(cell ? cell.v : '');
    }
    rows.push(row);
}

console.log("--- All Rows of sample_timetable_data.xlsx ---");
rows.forEach((row, i) => {
    if (row.some(c => String(c).includes("CS2C11") || String(c).includes("Semester V") || String(c).includes("SEMESTER V"))) {
        console.log(`Row ${i}:`, JSON.stringify(row));
    }
});
