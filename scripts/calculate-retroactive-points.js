const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function calculateRetroactivePoints() {
  console.log('===  RETROACTIVE POINTS CALCULATION (DRY RUN) ===\n');

  const pointsBreakdown = {};

  // Helper to add points
  function addPoints(staffId, staffName, category, points, description) {
    if (!pointsBreakdown[staffId]) {
      pointsBreakdown[staffId] = {
        name: staffName,
        total: 0,
        breakdown: {
          playLogs: { points: 0, count: 0, details: [] },
          knowledge: { points: 0, count: 0, details: [] },
          knowledgeChanges: { points: 0, count: 0, details: [] },
          teaching: { points: 0, count: 0, details: [] },
          photos: { points: 0, count: 0, details: [] },
          contentChecks: { points: 0, count: 0, details: [] }
        }
      };
    }

    pointsBreakdown[staffId].breakdown[category].points += points;
    pointsBreakdown[staffId].breakdown[category].count++;
    pointsBreakdown[staffId].breakdown[category].details.push(description);
    pointsBreakdown[staffId].total += points;
  }

  // 1. PLAY LOGS (100 points each)
  console.log('📊 Calculating Play Log Points...');
  const playLogs = await pool.query(`
    SELECT pl.staff_list_id, sl.staff_name, COUNT(*) as count
    FROM play_logs pl
    JOIN staff_list sl ON pl.staff_list_id = sl.id
    GROUP BY pl.staff_list_id, sl.staff_name
  `);

  playLogs.rows.forEach(row => {
    const points = row.count * 100;
    addPoints(row.staff_list_id, row.staff_name, 'playLogs', points,
      `${row.count} play logs × 100 = ${points} points`);
  });

  // 2. KNOWLEDGE RECORDS (Level-based points)
  console.log('🧠 Calculating Knowledge Points...');
  const knowledgeRecords = await pool.query(`
    SELECT
      sk.staff_member_id,
      sl.staff_name,
      sk.confidence_level,
      g.name as game_name,
      g.complexity
    FROM staff_knowledge sk
    JOIN staff_list sl ON CAST(sk.staff_member_id AS uuid) = sl.id
    LEFT JOIN games g ON sk.game_id = g.id
  `);

  // Point multipliers by level
  const levelMultipliers = {
    1: 100,  // Beginner
    2: 200,  // Intermediate
    3: 300,  // Expert
    4: 500   // Instructor
  };

  knowledgeRecords.rows.forEach(row => {
    const level = row.confidence_level || 1;
    const complexity = row.complexity || 1;
    const multiplier = levelMultipliers[level] || 100;
    const points = multiplier * complexity;

    const levelName = { 1: 'Beginner', 2: 'Intermediate', 3: 'Expert', 4: 'Instructor' }[level];

    addPoints(row.staff_member_id, row.staff_name, 'knowledge', points,
      `${row.game_name} (${levelName}, complexity ${complexity}) = ${points} points`);
  });

  // 3. KNOWLEDGE LEVEL CHANGES (100 × complexity)
  console.log('📚 Calculating Knowledge Level Change Points...');
  const knowledgeChanges = await pool.query(`
    SELECT
      cl.staff_id,
      cl.staff_member,
      cl.entity_name,
      cl.metadata
    FROM changelog cl
    WHERE cl.category = 'staff_knowledge'
      AND cl.event_type = 'updated'
      AND cl.metadata IS NOT NULL
  `);

  for (const row of knowledgeChanges.rows) {
    if (row.metadata && row.metadata.changes) {
      const knowledgeLevelChange = row.metadata.changes.find(c => c.field === 'knowledge_level');
      if (knowledgeLevelChange) {
        const oldLevel = knowledgeLevelChange.oldValue;
        const newLevel = knowledgeLevelChange.newValue;

        // Check if it's a progression to Expert or Instructor
        if ((oldLevel === 'Beginner' || oldLevel === 'Intermediate') &&
            (newLevel === 'Expert' || newLevel === 'Instructor')) {

          // Get game complexity
          const gameComplexity = await pool.query(`
            SELECT g.complexity
            FROM games g
            WHERE g.name = $1
          `, [row.entity_name]);

          const complexity = gameComplexity.rows[0]?.complexity || 1;
          const points = 100 * complexity;

          addPoints(row.staff_id, row.staff_member, 'knowledgeChanges', points,
            `${row.entity_name} (${oldLevel}→${newLevel}, complexity ${complexity}) = ${points} points`);
        }
      }
    }
  }

  // 4. TEACHING CREDITS (1000 × complexity × students) - ONLY for teaching OTHERS
  console.log('🎓 Calculating Teaching Points (teaching others only)...');
  const teachings = await pool.query(`
    SELECT
      sk.taught_by,
      sk.staff_member_id as student_id,
      g.name as game_name,
      g.complexity,
      sl1.staff_name as teacher_name,
      sl2.staff_name as student_name
    FROM staff_knowledge sk
    JOIN games g ON sk.game_id = g.id
    LEFT JOIN staff_list sl1 ON (
      CASE
        WHEN sk.taught_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN CAST(sk.taught_by AS uuid) = sl1.id
        ELSE FALSE
      END
    )
    LEFT JOIN staff_list sl2 ON CAST(sk.staff_member_id AS uuid) = sl2.id
    WHERE sk.taught_by IS NOT NULL
  `);

  const teachingGroups = {};

  teachings.rows.forEach(row => {
    const teacherId = row.taught_by;
    const studentId = row.student_id;
    const complexity = row.complexity || 1;

    // SKIP self-taught (teacher = student, teacher is "Myself", or teacher_name is null from LEFT JOIN)
    const isSelfTaught = teacherId === studentId || teacherId.toLowerCase() === 'myself' || !row.teacher_name;

    if (!isSelfTaught) {
      // Teaching others - group by teacher and game
      const key = `${teacherId}_${row.game_name}`;
      if (!teachingGroups[key]) {
        teachingGroups[key] = {
          teacherId,
          teacherName: row.teacher_name,
          gameName: row.game_name,
          complexity,
          students: []
        };
      }
      teachingGroups[key].students.push(row.student_name);
    }
  });

  // Award points for teaching groups
  Object.values(teachingGroups).forEach(group => {
    const points = 1000 * group.complexity * group.students.length;
    addPoints(group.teacherId, group.teacherName, 'teaching', points,
      `${group.gameName} (complexity ${group.complexity}, ${group.students.length} students: ${group.students.join(', ')}) = ${points} points`);
  });

  // 5. PHOTOS (1000 per image)
  console.log('📸 Calculating Photo Upload Points...');
  const photos = await pool.query(`
    SELECT
      cl.staff_id,
      cl.staff_member,
      COUNT(*) as count
    FROM changelog cl
    WHERE cl.event_type = 'photo_added'
    GROUP BY cl.staff_id, cl.staff_member
  `);

  photos.rows.forEach(row => {
    const points = row.count * 1000;
    addPoints(row.staff_id, row.staff_member, 'photos', points,
      `${row.count} photos × 1000 = ${points} points`);
  });

  // 6. CONTENT CHECKS (1000 × complexity)
  console.log('✅ Calculating Content Check Points...');
  const contentChecks = await pool.query(`
    SELECT
      cc.inspector_id,
      sl.staff_name,
      g.complexity,
      g.name as game_name,
      COUNT(*) as count
    FROM content_checks cc
    JOIN staff_list sl ON cc.inspector_id = sl.id
    LEFT JOIN games g ON cc.game_id = g.id
    WHERE cc.inspector_id IS NOT NULL
    GROUP BY cc.inspector_id, sl.staff_name, g.complexity, g.name
    ORDER BY sl.staff_name, g.name
  `);

  contentChecks.rows.forEach(row => {
    const complexity = row.complexity || 1;
    const points = 1000 * complexity * row.count;
    addPoints(row.inspector_id, row.staff_name, 'contentChecks', points,
      `${row.game_name} (complexity ${complexity}, ${row.count} checks) = ${points} points`);
  });

  // Print Results
  console.log('\n\n========================================');
  console.log('       POINTS SUMMARY BY STAFF');
  console.log('========================================\n');

  const sortedStaff = Object.entries(pointsBreakdown)
    .sort((a, b) => b[1].total - a[1].total);

  sortedStaff.forEach(([staffId, data], index) => {
    console.log(`\n${index + 1}. ${data.name.toUpperCase()}`);
    console.log(`   Total Points: ${data.total.toLocaleString()}`);
    console.log(`   ─────────────────────────────────────`);

    // Play Logs
    if (data.breakdown.playLogs.count > 0) {
      const logCount = data.breakdown.playLogs.points / 100;
      console.log(`   📊 Play Logs: ${data.breakdown.playLogs.points.toLocaleString()} points`);
      console.log(`      (${logCount} logs)`);
    }

    // Knowledge Records
    if (data.breakdown.knowledge.count > 0) {
      console.log(`   🧠 Game Knowledge: ${data.breakdown.knowledge.points.toLocaleString()} points`);
      console.log(`      (${data.breakdown.knowledge.count} games known)`);
    }

    // Knowledge Changes
    if (data.breakdown.knowledgeChanges.count > 0) {
      console.log(`   📚 Knowledge Upgrades: ${data.breakdown.knowledgeChanges.points.toLocaleString()} points`);
      console.log(`      (${data.breakdown.knowledgeChanges.count} progressions)`);
      data.breakdown.knowledgeChanges.details.slice(0, 3).forEach(d => {
        console.log(`      - ${d}`);
      });
      if (data.breakdown.knowledgeChanges.details.length > 3) {
        console.log(`      ... and ${data.breakdown.knowledgeChanges.details.length - 3} more`);
      }
    }

    // Teaching
    if (data.breakdown.teaching.count > 0) {
      console.log(`   🎓 Teaching: ${data.breakdown.teaching.points.toLocaleString()} points`);
      console.log(`      (${data.breakdown.teaching.count} teaching instances)`);
      data.breakdown.teaching.details.slice(0, 3).forEach(d => {
        console.log(`      - ${d}`);
      });
      if (data.breakdown.teaching.details.length > 3) {
        console.log(`      ... and ${data.breakdown.teaching.details.length - 3} more`);
      }
    }

    // Photos
    if (data.breakdown.photos.count > 0) {
      const photoCount = data.breakdown.photos.points / 1000;
      console.log(`   📸 Photos: ${data.breakdown.photos.points.toLocaleString()} points`);
      console.log(`      (${photoCount} photos uploaded)`);
    }

    // Content Checks
    if (data.breakdown.contentChecks.count > 0) {
      console.log(`   ✅ Content Checks: ${data.breakdown.contentChecks.points.toLocaleString()} points`);
      console.log(`      (${data.breakdown.contentChecks.count} unique game checks)`);
    }
  });

  console.log('\n\n========================================');
  console.log('         CATEGORY TOTALS');
  console.log('========================================\n');

  let categoryTotals = {
    playLogs: 0,
    knowledge: 0,
    knowledgeChanges: 0,
    teaching: 0,
    photos: 0,
    contentChecks: 0
  };

  Object.values(pointsBreakdown).forEach(staff => {
    Object.keys(categoryTotals).forEach(category => {
      categoryTotals[category] += staff.breakdown[category].points;
    });
  });

  console.log(`📊 Play Logs:         ${categoryTotals.playLogs.toLocaleString()} points`);
  console.log(`🧠 Game Knowledge:    ${categoryTotals.knowledge.toLocaleString()} points`);
  console.log(`📚 Knowledge Upgrades: ${categoryTotals.knowledgeChanges.toLocaleString()} points`);
  console.log(`🎓 Teaching:          ${categoryTotals.teaching.toLocaleString()} points`);
  console.log(`📸 Photos:            ${categoryTotals.photos.toLocaleString()} points`);
  console.log(`✅ Content Checks:    ${categoryTotals.contentChecks.toLocaleString()} points`);
  console.log(`\nGRAND TOTAL:          ${Object.values(categoryTotals).reduce((a,b) => a+b, 0).toLocaleString()} points`);

  await pool.end();
}

calculateRetroactivePoints().catch(console.error);
