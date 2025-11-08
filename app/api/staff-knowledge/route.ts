import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { logKnowledgeCreated, logKnowledgeDeleted, logKnowledgeUpdated } from '@/lib/services/changelog-service';
import { awardPoints } from '@/lib/services/points-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = DatabaseService.initialize();
    const url = new URL(request.url);
    const allGames = url.searchParams.get('allGames') === 'true';

    // If requesting all games list for knowledge gap analysis
    if (allGames) {
      const gamesResult = await db.pool.query(`
        SELECT DISTINCT name
        FROM games
        WHERE name IS NOT NULL
        ORDER BY name
      `);

      const games = gamesResult.rows.map(row => row.name);
      return NextResponse.json({ games });
    }

    // Fetch all staff knowledge records with game names and staff names via JOIN
    console.log('Fetching staff knowledge with names from PostgreSQL...');
    const result = await db.pool.query(`
      SELECT
        sk.id,
        sk.staff_member_id,
        sk.game_id,
        sk.confidence_level,
        sk.can_teach,
        sk.taught_by,
        sk.notes,
        sk.created_at,
        sk.updated_at,
        g.name AS game_name,
        sl.staff_name AS staff_name
      FROM staff_knowledge sk
      LEFT JOIN games g ON sk.game_id = g.id
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.id
      ORDER BY sk.created_at DESC
    `);

    // Map confidence level numbers to strings
    const confidenceLevelMap: { [key: number]: string } = {
      1: 'Beginner',
      2: 'Intermediate',
      3: 'Expert',
      4: 'Instructor',
    };

    const knowledge = result.rows.map((row) => ({
      id: row.id,
      staffMemberId: row.staff_member_id, // For filtering by ID
      staffMember: row.staff_name || 'Unknown Staff', // For display
      gameName: row.game_name || 'Unknown Game',
      confidenceLevel: confidenceLevelMap[row.confidence_level] || 'Beginner',
      canTeach: row.can_teach || false,
      notes: row.notes || '',
      taughtBy: row.taught_by || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    console.log(`✅ Fetched ${knowledge.length} staff knowledge records with names from PostgreSQL`);

    return NextResponse.json({ knowledge });
  } catch (error) {
    console.error('❌ Staff knowledge API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch staff knowledge';
    return NextResponse.json(
      { error: `Failed to fetch staff knowledge: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const {
      gameId,
      staffId,
      confidenceLevel,
      taughtBy,
      notes,
    } = await request.json();

    // Validate required fields
    if (!gameId || !staffId || !confidenceLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, staffId, confidenceLevel' },
        { status: 400 }
      );
    }

    // Map confidence level string to number
    const confidenceLevelMap: { [key: string]: number } = {
      'Beginner': 1,
      'Intermediate': 2,
      'Expert': 3,
      'Instructor': 4,
    };
    const confidenceLevelNum = confidenceLevelMap[confidenceLevel] || 1;

    // Create knowledge entry
    console.log(`[staff-knowledge POST] Creating knowledge: game=${gameId}, staff=${staffId}`);

    const knowledge = await db.staffKnowledge.createKnowledge({
      staffMemberId: staffId,
      gameId,
      confidenceLevel: confidenceLevelNum,
      canTeach: confidenceLevel === 'Expert' || confidenceLevel === 'Instructor',
      taughtBy: taughtBy || null,
      notes: notes || null,
    });

    console.log(`✅ Knowledge entry created: ${knowledge.id}`);

    // Get game and staff details for changelog
    try {
      const gameResult = await db.pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
      const staffResult = await db.pool.query('SELECT staff_name FROM staff_list WHERE id = $1', [staffId]);

      if (gameResult.rows.length > 0 && staffResult.rows.length > 0) {
        const gameName = gameResult.rows[0].name;
        const staffName = staffResult.rows[0].staff_name;

        await logKnowledgeCreated(
          knowledge.id,
          gameName,
          staffName,
          staffId,
          confidenceLevel,
          knowledge.canTeach
        );
      }
    } catch (changelogError) {
      console.error('Failed to log knowledge creation to changelog:', changelogError);
    }

    return NextResponse.json(
      {
        success: true,
        knowledgeId: knowledge.id,
        knowledge,
        message: 'Knowledge entry created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Error creating knowledge entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create knowledge entry';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Get knowledge details before deleting for changelog and point refund
    let gameName = 'Unknown Game';
    let staffName = 'Unknown Staff';
    let staffId = '';
    let gameId = '';

    const knowledgeDetails = await db.pool.query(`
      SELECT
        g.name as game_name,
        g.id as game_id,
        sl.staff_name,
        sk.staff_member_id,
        sk.confidence_level,
        g.complexity
      FROM staff_knowledge sk
      LEFT JOIN games g ON sk.game_id = g.id
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.id
      WHERE sk.id = $1
    `, [recordId]);

    if (knowledgeDetails.rows.length === 0) {
      return NextResponse.json(
        { error: 'Knowledge entry not found' },
        { status: 404 }
      );
    }

    const knowledge = knowledgeDetails.rows[0];
    gameName = knowledge.game_name || gameName;
    staffName = knowledge.staff_name || staffName;
    staffId = knowledge.staff_member_id || staffId;
    gameId = knowledge.game_id || '';

    // Calculate points to refund by checking changelog for all awards related to this staff+game
    let pointsToRefund = 0;
    try {
      const pointsResult = await db.pool.query(`
        SELECT COALESCE(SUM(points_awarded), 0) as total_points
        FROM changelog
        WHERE staff_id = $1
          AND entity_id = $2
          AND point_category IN ('knowledge_add', 'knowledge_upgrade')
      `, [staffId, gameId]);

      pointsToRefund = -(parseInt(pointsResult.rows[0].total_points) || 0);
    } catch (error) {
      console.error('Failed to calculate points to refund:', error);
    }

    // Log deletion to changelog with negative points
    if (pointsToRefund !== 0) {
      try {
        const seqResult = await db.pool.query("SELECT nextval('changelog_id_seq') as next_id");
        const changelogId = seqResult.rows[0].next_id;

        await db.pool.query(`
          INSERT INTO changelog (
            id,
            event_type,
            category,
            staff_id,
            entity_id,
            entity_name,
            points_awarded,
            point_category,
            description,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          changelogId,
          'deleted',
          'staff_knowledge',
          staffId,
          gameId,
          gameName,
          pointsToRefund,
          'knowledge_add', // Use knowledge_add as the base category
          `Knowledge entry deleted for ${gameName}`
        ]);

        // Subtract points from staff member
        await db.pool.query(`
          UPDATE staff_list
          SET points = points + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [pointsToRefund, staffId]);

        console.log(`✅ Refunded ${pointsToRefund} points to ${staffName}`);
      } catch (refundError) {
        console.error('Failed to log deletion or refund points:', refundError);
      }
    }

    // Delete record from PostgreSQL
    console.log(`[staff-knowledge DELETE] Deleting knowledge entry: ${recordId}`);
    await db.staffKnowledge.deleteKnowledge(recordId);

    console.log(`✅ Knowledge entry deleted successfully: ${recordId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Knowledge entry deleted successfully' + (pointsToRefund !== 0 ? ' and points refunded' : ''),
        pointsRefunded: Math.abs(pointsToRefund),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error deleting knowledge entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete knowledge entry';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');
    const { confidenceLevel, canTeach, notes } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Get current knowledge details before updating (for changelog and points)
    const currentKnowledgeResult = await db.pool.query(`
      SELECT
        sk.confidence_level,
        sk.staff_member_id,
        sk.game_id,
        g.name as game_name,
        g.complexity as game_complexity,
        sl.staff_name
      FROM staff_knowledge sk
      LEFT JOIN games g ON sk.game_id = g.id
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.id
      WHERE sk.id = $1
    `, [recordId]);

    if (currentKnowledgeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Knowledge entry not found' },
        { status: 404 }
      );
    }

    const currentKnowledge = currentKnowledgeResult.rows[0];
    const oldConfidenceLevel = currentKnowledge.confidence_level;

    // Update record in PostgreSQL
    console.log(`[staff-knowledge PATCH] Updating knowledge entry: ${recordId}`);

    // Map confidence level string to number (same as POST endpoint)
    const confidenceLevelMap: { [key: string]: number } = {
      'Beginner': 1,
      'Intermediate': 2,
      'Expert': 3,
      'Instructor': 4,
    };

    const reverseLevelMap: { [key: number]: string } = {
      1: 'Beginner',
      2: 'Intermediate',
      3: 'Expert',
      4: 'Instructor',
    };

    const updates: any = {};
    let newConfidenceLevel = oldConfidenceLevel;

    if (confidenceLevel !== undefined) {
      // Convert string to integer if it's a string
      newConfidenceLevel = typeof confidenceLevel === 'string'
        ? confidenceLevelMap[confidenceLevel] || 1
        : confidenceLevel;
      updates.confidenceLevel = newConfidenceLevel;
    }
    if (canTeach !== undefined) updates.canTeach = canTeach;
    if (notes !== undefined) updates.notes = notes;

    const updatedKnowledge = await db.staffKnowledge.updateKnowledge(recordId, updates);

    console.log(`✅ Knowledge entry updated successfully: ${recordId}`);

    // Award points and log to changelog if confidence level was upgraded
    let pointsAwarded = 0;
    const isUpgrade = newConfidenceLevel > oldConfidenceLevel;

    if (isUpgrade && currentKnowledge.game_name && currentKnowledge.staff_name) {
      try {
        // Log to changelog
        await logKnowledgeUpdated(
          recordId,
          currentKnowledge.game_name,
          currentKnowledge.staff_name,
          currentKnowledge.staff_member_id,
          reverseLevelMap[oldConfidenceLevel] || 'Unknown',
          reverseLevelMap[newConfidenceLevel] || 'Unknown'
        );

        // Award points for knowledge upgrade (100 × complexity)
        const pointsResult = await awardPoints({
          staffId: currentKnowledge.staff_member_id,
          actionType: 'knowledge_upgrade',
          metadata: {
            gameId: currentKnowledge.game_id,
            gameComplexity: currentKnowledge.game_complexity || 1
          },
          context: `Upgraded knowledge for ${currentKnowledge.game_name} from ${reverseLevelMap[oldConfidenceLevel]} to ${reverseLevelMap[newConfidenceLevel]}`
        });

        if (pointsResult.success) {
          pointsAwarded = pointsResult.pointsAwarded;
          console.log(`✅ Awarded ${pointsAwarded} points for knowledge upgrade`);
        }
      } catch (changelogError) {
        console.error('Failed to log knowledge upgrade or award points:', changelogError);
        // Don't fail the request if changelog/points fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        knowledge: updatedKnowledge,
        pointsAwarded,
        message: `Knowledge entry updated successfully${pointsAwarded > 0 ? ` and ${pointsAwarded} points awarded` : ''}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error updating knowledge entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update knowledge entry';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
