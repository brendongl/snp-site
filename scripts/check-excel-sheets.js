const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const salaryDir = 'G:\\My Drive\\Accounting\\Salary\\2025';
const files = fs.readdirSync(salaryDir).filter(f =>
  f.startsWith('payslip') && f.endsWith('.xlsx') && !f.startsWith('~$')
);

console.log('Checking sheet names in Excel files...\n');

// Check first 3 files
for (const file of files.slice(0, 3)) {
  const filePath = path.join(salaryDir, file);
  console.log(`File: ${file}`);

  try {
    const workbook = XLSX.readFile(filePath);
    console.log('  Sheets:', workbook.SheetNames.join(', '));
    console.log('');
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }
}
