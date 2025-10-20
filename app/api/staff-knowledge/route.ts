import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface StaffKnowledgeEntry {
  id: string;
  staffMember: string;
  gameName: string;
  confidenceLevel: string;
  taughtBy: string | null;
  notes: string;
  canTeach: boolean;
}

export async function GET() {
  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_GAMES_BASE_ID;
    const knowledgeTableId = process.env.AIRTABLE_STAFF_KNOWLEDGE_TABLE_ID;
    const staffTableId = process.env.AIRTABLE_STAFF_TABLE_ID;
    const gamesTableId = process.env.AIRTABLE_GAMES_TABLE_ID;

    if (!apiKey || !baseId || !knowledgeTableId) {
      throw new Error('Missing Airtable configuration');
    }

    // Fetch all staff knowledge records
    let allRecords: any[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${knowledgeTableId}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`);
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset);

    // Transform records with lookups
    const transformed: StaffKnowledgeEntry[] = await Promise.all(
      allRecords.map(async (record) => {
        const staffMemberIds = record.fields['Staff Member'] || [];
        const gameIds = record.fields['Game'] || [];
        const confidenceLevel = record.fields['Confidence Level'] || 'Unknown';
        const canTeach = record.fields['Can Teach'] === 1;
        const notes = record.fields['Notes'] || '';

        let staffMemberName = 'Unknown Staff';
        if (staffMemberIds.length > 0) {
          try {
            const staffResponse = await fetch(
              `https://api.airtable.com/v0/${baseId}/${staffTableId}/${staffMemberIds[0]}`,
              { headers: { Authorization: `Bearer ${apiKey}` } }
            );
            if (staffResponse.ok) {
              const staffData = await staffResponse.json();
              staffMemberName = staffData.fields['Name'] || 'Unknown Staff';
            }
          } catch (err) {
            console.error('Error fetching staff member:', err);
          }
        }

        let gameName = 'Unknown Game';
        if (gameIds.length > 0) {
          try {
            const gameResponse = await fetch(
              `https://api.airtable.com/v0/${baseId}/${gamesTableId}/${gameIds[0]}`,
              { headers: { Authorization: `Bearer ${apiKey}` } }
            );
            if (gameResponse.ok) {
              const gameData = await gameResponse.json();
              gameName = gameData.fields['Game Name'] || 'Unknown Game';
            }
          } catch (err) {
            console.error('Error fetching game:', err);
          }
        }

        return {
          id: record.id,
          staffMember: staffMemberName,
          gameName: gameName,
          confidenceLevel: confidenceLevel,
          taughtBy: null,
          notes: notes,
          canTeach: canTeach,
        };
      })
    );

    return NextResponse.json({ knowledge: transformed });
  } catch (error) {
    console.error('Staff knowledge API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff knowledge' },
      { status: 500 }
    );
  }
}
