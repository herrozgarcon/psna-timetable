const XLSX = require('xlsx');
const fs = require('fs');

const filePaths = [
    '../engg - EVEN V2 2025-26-WITH SATFF NAME.xlsx',
    'sample_timetable_data.xlsx'
];

filePaths.forEach(fp => {
    if (fs.existsSync(fp)) {
        console.log(`Scanning file: ${fp}`);
        const buf = fs.readFileSync(fp);
        const wb = XLSX.read(buf, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Print first 20 rows to find headers
        for (let i = 0; i < Math.min(data.length, 20); i++) {
            console.log(`Row ${i}:`, JSON.stringify(data[i]));
        }
    } else {
        console.log(`File not found: ${fp}`);
    }
});
