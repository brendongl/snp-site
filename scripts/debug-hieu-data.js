const XLSX = require('xlsx');
const path = require('path');

const salaryDir = 'G:\\My Drive\\Accounting\\Salary\\2025';
const file = 'payslip-HIEU -Jan025.xlsx';
const filePath = path.join(salaryDir, file);

console.log(`Debugging ${file}...\n`);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['YearToDate'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const headers = data[4];
console.log('Headers:', headers.filter(h => h).join(' | '));
console.log('\n');

// Find the "Other Hourly Pay" column
let otherHourlyPayIdx = -1;
headers.forEach((header, idx) => {
  if (header && header.includes('Other Hourly Pay')) {
    otherHourlyPayIdx = idx;
  }
});

console.log(`Other Hourly Pay column index: ${otherHourlyPayIdx}\n`);

// Show first 10 data rows
console.log('First 10 data rows:\n');
for (let i = 6; i < Math.min(16, data.length); i++) {
  const row = data[i];
  if (!row[0]) break;  // Stop at first empty row

  console.log(`Row ${i}:`);
  console.log(`  PAY DATE: ${row[0]}`);
  console.log(`  Standard Hours: ${row[4]}`);
  console.log(`  Overtime Hours: ${row[7]}`);
  console.log(`  Holiday Hours: ${row[10]}`);
  console.log(`  Weekend Hours: ${row[13]}`);
  console.log(`  Weekend Overtime Hours: ${row[16]}`);
  if (otherHourlyPayIdx >= 0) {
    console.log(`  Other Hourly Pay: ${row[otherHourlyPayIdx]}`);
  }
  console.log('');
}

// Calculate totals for each column
let standardHours = 0;
let otherHourlyPay = 0;

for (let rowIdx = 6; rowIdx < data.length; rowIdx++) {
  const row = data[rowIdx];
  if (!row[0]) continue;

  const firstCol = String(row[0]).toLowerCase();
  if (firstCol.includes('total') || firstCol.includes('ytd')) continue;

  if (row[4] && typeof row[4] === 'number') standardHours += row[4];
  if (otherHourlyPayIdx >= 0 && row[otherHourlyPayIdx] && typeof row[otherHourlyPayIdx] === 'number') {
    otherHourlyPay += row[otherHourlyPayIdx];
  }
}

console.log('\nTotals:');
console.log(`  Standard Hours: ${standardHours.toFixed(2)}`);
console.log(`  Other Hourly Pay: ${otherHourlyPay.toFixed(2)}`);
