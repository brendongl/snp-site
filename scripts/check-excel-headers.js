const XLSX = require('xlsx');
const path = require('path');

const salaryDir = 'G:\\My Drive\\Accounting\\Salary\\2025';
const file = 'payslip-MINH -Jan025.xlsx';
const filePath = path.join(salaryDir, file);

console.log(`Checking headers in ${file}...\n`);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['YearToDate'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('First 5 rows:\n');
for (let i = 0; i < Math.min(5, data.length); i++) {
  console.log(`Row ${i}:`, data[i]);
  console.log('');
}

if (data.length > 0) {
  console.log('\nHeaders (Row 0):');
  data[0].forEach((header, idx) => {
    console.log(`  [${idx}] ${header}`);
  });
}
