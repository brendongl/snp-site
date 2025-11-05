const XLSX = require('xlsx');
const path = require('path');

const salaryDir = 'G:\\My Drive\\Accounting\\Salary\\2025';
const file = 'payslip-MINH -Jan025.xlsx';
const filePath = path.join(salaryDir, file);

console.log(`Debugging ${file}...\n`);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['YearToDate'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Total rows: ${data.length}\n`);

// Show rows 4-10 (header and first few data rows)
console.log('Rows 4-10:\n');
for (let i = 4; i < Math.min(10, data.length); i++) {
  const row = data[i];
  console.log(`Row ${i}:`);
  console.log(`  PAY DATE: ${row[0]}`);
  console.log(`  Standard Hours: ${row[4]}`);
  console.log(`  Overtime Hours: ${row[7]}`);
  console.log(`  Holiday Hours: ${row[10]}`);
  console.log('');
}

// Show last few rows (might have totals)
console.log('\nLast 5 rows:\n');
for (let i = Math.max(data.length - 5, 5); i < data.length; i++) {
  const row = data[i];
  console.log(`Row ${i}:`);
  console.log(`  PAY DATE: ${row[0]}`);
  console.log(`  Standard Hours: ${row[4]}`);
  console.log(`  Overtime Hours: ${row[7]}`);
  console.log(`  Holiday Hours: ${row[10]}`);
  console.log('');
}
