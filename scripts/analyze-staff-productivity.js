const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Normalize Vietnamese characters to ASCII equivalents
function removeVietnameseDiacritics(str) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/đ/g, 'd').replace(/Đ/g, 'D'); // Handle đ/Đ specifically
}

// Fuzzy match function
function fuzzyMatch(name1, name2) {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Try matching first name only
  const first1 = n1.split(' ')[0];
  const first2 = n2.split(' ')[0];
  if (first1 === first2) return true;

  return false;
}

async function main() {
  try {
    console.log('📊 Analyzing staff productivity...\n');

    // 1. Get staff knowledge from database (exclude Brendon Gan-Le)
    const staffKnowledgeQuery = `
      SELECT
        s.id,
        s.staff_name,
        s.nickname,
        COUNT(DISTINCT sk.game_id) as games_learned
      FROM staff_list s
      LEFT JOIN staff_knowledge sk ON s.id = sk.staff_member_id
      WHERE s.staff_name != 'Brendon Gan-Le'
      GROUP BY s.id, s.staff_name, s.nickname
      ORDER BY games_learned DESC
    `;

    const { rows: staffData } = await pool.query(staffKnowledgeQuery);
    console.log(`Found ${staffData.length} staff members in database\n`);

    // 2. Read all payslip files
    const salaryDir = 'G:\\My Drive\\Accounting\\Salary\\2025';
    const files = fs.readdirSync(salaryDir).filter(f =>
      f.startsWith('payslip') && f.endsWith('.xlsx') && !f.startsWith('~$')
    );

    console.log(`Found ${files.length} payslip files\n`);

    const staffHours = {};

    // 3. Process each Excel file
    for (const file of files) {
      const filePath = path.join(salaryDir, file);
      console.log(`Reading ${file}...`);

      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = 'YearToDate';

        if (!workbook.SheetNames.includes(sheetName)) {
          console.log(`  ⚠️  No YearToDate sheet found, skipping`);
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (data.length < 5) {
          console.log(`  ⚠️  Sheet is empty or too short, skipping`);
          continue;
        }

        // Headers are in row 4 (index 4)
        const headers = data[4];
        const hoursColumns = [];

        headers.forEach((header, idx) => {
          if (header && typeof header === 'string') {
            const lowerHeader = header.toLowerCase();
            // Include columns with "hours" or "hour" but exclude payment columns (containing "pay" or "rate")
            if ((lowerHeader.includes('hours') || lowerHeader.includes('hour')) &&
                !lowerHeader.includes('pay') &&
                !lowerHeader.includes('rate')) {
              hoursColumns.push({ name: header, index: idx });
            }
          }
        });

        console.log(`  Found ${hoursColumns.length} hour columns:`, hoursColumns.map(c => c.name).join(', '));

        // Extract staff name from E2 (row 1, column E = index 4)
        const staffFullName = data[1] && data[1][4] ? String(data[1][4]).trim() : null;

        if (!staffFullName) {
          console.log(`  ⚠️  Could not extract employee name from E2`);
          continue;
        }

        console.log(`  Employee name: ${staffFullName}`);

        // Find the Year-To-Date totals row instead of summing manually
        let totalHours = 0;
        const hourBreakdown = {};
        let ytdRow = null;

        // Look for the Year-To-Date row
        for (let rowIdx = 6; rowIdx < data.length; rowIdx++) {
          const row = data[rowIdx];
          if (!row[0]) continue;

          const firstCol = String(row[0]).toLowerCase();
          if (firstCol.includes('year-to-date') || firstCol.includes('ytd')) {
            ytdRow = row;
            break;
          }
        }

        if (ytdRow) {
          // Use the YTD row values
          hoursColumns.forEach(col => {
            const value = ytdRow[col.index];
            if (value && typeof value === 'number') {
              totalHours += value;
              hourBreakdown[col.name] = value;
            }
          });
        } else {
          console.log(`  ⚠️  No Year-To-Date row found, will sum manually`);
          // Fallback: sum all data rows
          for (let rowIdx = 6; rowIdx < data.length; rowIdx++) {
            const row = data[rowIdx];
            if (!row[0]) continue;

            const firstCol = String(row[0]).toLowerCase();
            if (firstCol.includes('total')) continue;

            hoursColumns.forEach(col => {
              const value = row[col.index];
              if (value && typeof value === 'number') {
                totalHours += value;
                hourBreakdown[col.name] = (hourBreakdown[col.name] || 0) + value;
              }
            });
          }
        }

        staffHours[staffFullName] = {
          totalHours,
          breakdown: hourBreakdown,
          filename: file
        };

        console.log(`  ✅ ${staffFullName}: ${totalHours.toFixed(2)} total hours`);

      } catch (err) {
        console.log(`  ❌ Error reading file: ${err.message}`);
      }
    }

    console.log('\n📈 Matching with database...\n');

    // 4. Match and calculate statistics
    const stats = [];

    for (const dbStaff of staffData) {
      let matchedHours = null;
      let matchedName = null;

      // Try to find matching hours data with improved matching
      // Priority 1: Exact match on staff_name (case-insensitive, ignoring spaces, punctuation, and diacritics)
      const normalizeStr = (str) => removeVietnameseDiacritics(str).toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedDbName = normalizeStr(dbStaff.staff_name);

      for (const [excelName, hoursData] of Object.entries(staffHours)) {
        if (normalizeStr(excelName) === normalizedDbName) {
          matchedHours = hoursData;
          matchedName = excelName;
          break;
        }
      }

      // Priority 2: Exact nickname match (case-insensitive)
      if (!matchedHours && dbStaff.nickname) {
        for (const [excelName, hoursData] of Object.entries(staffHours)) {
          // Check if nickname appears in Excel name (in parentheses or standalone)
          if (excelName.toLowerCase().includes(dbStaff.nickname.toLowerCase())) {
            matchedHours = hoursData;
            matchedName = excelName;
            break;
          }
        }
      }

      // Priority 3: Fuzzy match on nickname or full name (fallback)
      if (!matchedHours) {
        for (const [excelName, hoursData] of Object.entries(staffHours)) {
          if (fuzzyMatch(dbStaff.staff_name, excelName) ||
              (dbStaff.nickname && fuzzyMatch(dbStaff.nickname, excelName))) {
            matchedHours = hoursData;
            matchedName = excelName;
            break;
          }
        }
      }

      const totalHours = matchedHours ? matchedHours.totalHours : 0;
      const gamesLearned = parseInt(dbStaff.games_learned);
      const gamesPerHour = totalHours > 0 ? gamesLearned / totalHours : 0;

      stats.push({
        name: dbStaff.staff_name,
        nickname: dbStaff.nickname,
        excelName: matchedName,
        totalHours: totalHours,
        gamesLearned: gamesLearned,
        gamesPerHour: gamesPerHour,
        matched: !!matchedHours,
        hourBreakdown: matchedHours ? matchedHours.breakdown : {}
      });

      console.log(`${dbStaff.staff_name} (${dbStaff.nickname || 'N/A'})`);
      console.log(`  Excel: ${matchedName || 'NOT MATCHED'}`);
      console.log(`  Hours: ${totalHours.toFixed(2)}`);
      console.log(`  Games: ${gamesLearned}`);
      console.log(`  Games/Hour: ${gamesPerHour.toFixed(4)}`);
      console.log('');
    }

    // 5. Generate HTML report
    console.log('📄 Generating HTML report...\n');

    const html = generateHTML(stats);
    const outputPath = path.join(__dirname, '../staff-productivity-report.html');
    fs.writeFileSync(outputPath, html);

    console.log(`✅ Report saved to: ${outputPath}`);

    await pool.end();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function generateHTML(stats) {
  // Sort by games per hour (productivity)
  const sortedByProductivity = [...stats]
    .filter(s => s.totalHours > 0)
    .sort((a, b) => b.gamesPerHour - a.gamesPerHour);

  // Sort by total games learned
  const sortedByGames = [...stats]
    .sort((a, b) => b.gamesLearned - a.gamesLearned);

  // Sort by total hours worked
  const sortedByHours = [...stats]
    .filter(s => s.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff Productivity Report - Sip & Play</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      color: white;
      font-size: 2.5rem;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }

    .subtitle {
      text-align: center;
      color: rgba(255,255,255,0.9);
      font-size: 1.1rem;
      margin-bottom: 40px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .summary-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }

    .summary-card .label {
      color: #666;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    h2 {
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }

    .staff-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .staff-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 10px;
      padding: 20px;
      color: white;
      position: relative;
      overflow: hidden;
    }

    .staff-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 100px;
      height: 100px;
      background: rgba(255,255,255,0.1);
      border-radius: 50%;
      transform: translate(30%, -30%);
    }

    .staff-card.unmatched {
      background: linear-gradient(135deg, #999 0%, #666 100%);
      opacity: 0.7;
    }

    .staff-card .name {
      font-size: 1.3rem;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .staff-card .staff-name {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-bottom: 15px;
    }

    .staff-card .stats {
      margin-top: 15px;
    }

    .staff-card .stat-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.95rem;
    }

    .staff-card .stat-label {
      opacity: 0.9;
    }

    .staff-card .stat-value {
      font-weight: bold;
    }

    .staff-card .productivity {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,0.3);
      font-size: 1.1rem;
      font-weight: bold;
      text-align: center;
    }

    .chart-container {
      position: relative;
      height: 400px;
      margin: 30px 0;
    }

    .unmatched-note {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
      color: #856404;
    }

    .rank-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255,255,255,0.3);
      color: white;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: bold;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    th {
      background: #667eea;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }

    tr:hover {
      background: #f5f5f5;
    }

    .rank-1 { background: #ffd700; color: #333; }
    .rank-2 { background: #c0c0c0; color: #333; }
    .rank-3 { background: #cd7f32; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Staff Productivity Report</h1>
    <p class="subtitle">Sip & Play Board Game Knowledge vs. Work Hours Analysis</p>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Total Staff</div>
        <div class="value">${stats.length}</div>
      </div>
      <div class="summary-card">
        <div class="label">Matched Records</div>
        <div class="value">${stats.filter(s => s.matched).length}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Hours</div>
        <div class="value">${stats.reduce((sum, s) => sum + s.totalHours, 0).toFixed(0)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Games Learned</div>
        <div class="value">${stats.reduce((sum, s) => sum + s.gamesLearned, 0)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Avg Games/Hour</div>
        <div class="value">${(stats.filter(s => s.totalHours > 0).reduce((sum, s) => sum + s.gamesPerHour, 0) / stats.filter(s => s.totalHours > 0).length).toFixed(3)}</div>
      </div>
    </div>

    <div class="section">
      <h2>🏆 Top Performers by Learning Efficiency (Games per Hour)</h2>
      <div class="chart-container">
        <canvas id="productivityChart"></canvas>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Hours Worked</th>
            <th>Games Learned</th>
            <th>Games/Hour</th>
          </tr>
        </thead>
        <tbody>
          ${sortedByProductivity.slice(0, 10).map((s, idx) => `
            <tr class="${idx < 3 ? 'rank-' + (idx + 1) : ''}">
              <td><strong>${idx + 1}</strong></td>
              <td>${s.name}${s.nickname ? ` (${s.nickname})` : ''}</td>
              <td>${s.totalHours.toFixed(2)}</td>
              <td>${s.gamesLearned}</td>
              <td><strong>${s.gamesPerHour.toFixed(4)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>📚 Most Games Learned (Total Knowledge)</h2>
      <div class="chart-container">
        <canvas id="gamesLearnedChart"></canvas>
      </div>
    </div>

    <div class="section">
      <h2>⏰ Most Hours Worked</h2>
      <div class="chart-container">
        <canvas id="hoursWorkedChart"></canvas>
      </div>
    </div>

    <div class="section">
      <h2>👥 Individual Staff Cards</h2>
      <div class="staff-grid">
        ${sortedByProductivity.map((s, idx) => `
          <div class="staff-card ${!s.matched ? 'unmatched' : ''}">
            ${s.matched && idx < 3 ? `<div class="rank-badge">#${idx + 1}</div>` : ''}
            <div class="name">${s.name}</div>
            ${s.nickname ? `<div class="staff-name">Nickname: ${s.nickname}</div>` : ''}
            ${s.excelName ? `<div class="staff-name">Excel: ${s.excelName}</div>` : ''}
            <div class="stats">
              <div class="stat-row">
                <span class="stat-label">Hours Worked:</span>
                <span class="stat-value">${s.totalHours.toFixed(2)}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Games Learned:</span>
                <span class="stat-value">${s.gamesLearned}</span>
              </div>
              ${s.totalHours > 0 ? `
                <div class="productivity">
                  ${s.gamesPerHour.toFixed(4)} games/hour
                </div>
              ` : '<div class="productivity">No hours data</div>'}
            </div>
          </div>
        `).join('')}
      </div>

      ${stats.filter(s => !s.matched).length > 0 ? `
        <div class="unmatched-note">
          <strong>⚠️ Note:</strong> ${stats.filter(s => !s.matched).length} staff members could not be matched with payslip data.
          This may be due to name mismatches between the database and Excel files.
        </div>
      ` : ''}
    </div>
  </div>

  <script>
    const stats = ${JSON.stringify(sortedByProductivity)};
    const sortedByGames = ${JSON.stringify(sortedByGames)};
    const sortedByHours = ${JSON.stringify(sortedByHours)};

    // Productivity Chart
    new Chart(document.getElementById('productivityChart'), {
      type: 'bar',
      data: {
        labels: stats.slice(0, 10).map(s => s.name),
        datasets: [{
          label: 'Games per Hour',
          data: stats.slice(0, 10).map(s => s.gamesPerHour),
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Learning Efficiency - Higher is Better',
            font: { size: 16 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Games per Hour' }
          }
        }
      }
    });

    // Games Learned Chart
    new Chart(document.getElementById('gamesLearnedChart'), {
      type: 'bar',
      data: {
        labels: sortedByGames.slice(0, 10).map(s => s.name),
        datasets: [{
          label: 'Games Learned',
          data: sortedByGames.slice(0, 10).map(s => s.gamesLearned),
          backgroundColor: 'rgba(118, 75, 162, 0.8)',
          borderColor: 'rgba(118, 75, 162, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Total Board Games Known',
            font: { size: 16 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Number of Games' }
          }
        }
      }
    });

    // Hours Worked Chart
    new Chart(document.getElementById('hoursWorkedChart'), {
      type: 'bar',
      data: {
        labels: sortedByHours.slice(0, 10).map(s => s.name),
        datasets: [{
          label: 'Hours Worked',
          data: sortedByHours.slice(0, 10).map(s => s.totalHours),
          backgroundColor: 'rgba(255, 159, 64, 0.8)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Total Hours Worked (2025 YTD)',
            font: { size: 16 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Hours' }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

main();
