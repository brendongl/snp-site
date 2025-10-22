/**
 * Changelog Service
 *
 * Helper functions for logging changes to the changelog table
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - changelog logging disabled');
}

export interface ChangelogEntry {
  eventType: 'created' | 'updated' | 'deleted' | 'photo_added';
  category: 'board_game' | 'play_log' | 'staff_knowledge' | 'content_check';
  entityId: string;
  entityName: string;
  description: string;
  staffMember: string;
  staffId: string;
  metadata?: Record<string, any>;
}

/**
 * Log a change to the changelog table
 *
 * @param params - Changelog entry details
 */
export async function logChange(params: ChangelogEntry): Promise<void> {
  if (!DATABASE_URL) {
    console.warn('[Changelog] Skipping - DATABASE_URL not set');
    return;
  }

  const {
    eventType,
    category,
    entityId,
    entityName,
    description,
    staffMember,
    staffId,
    metadata,
  } = params;

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    await pool.query(
      `INSERT INTO changelog (
        event_type, category, entity_id, entity_name,
        description, staff_member, staff_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventType,
        category,
        entityId,
        entityName,
        description,
        staffMember,
        staffId,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    console.log(`[Changelog] Logged ${eventType} for ${category}: ${entityName}`);
  } catch (error) {
    console.error('[Changelog] Failed to log change:', error);
    // Don't throw - logging failure shouldn't break the main operation
  } finally {
    await pool.end();
  }
}

/**
 * Convenience functions for common changelog operations
 */

export async function logGameUpdate(
  gameId: string,
  gameName: string,
  staffMember: string,
  staffId: string,
  changes?: Record<string, any>
): Promise<void> {
  await logChange({
    eventType: 'updated',
    category: 'board_game',
    entityId: gameId,
    entityName: gameName,
    description: `Updated game: ${gameName}`,
    staffMember,
    staffId,
    metadata: changes,
  });
}

export async function logPhotoAdded(
  gameId: string,
  gameName: string,
  staffMember: string,
  staffId: string,
  photoCount: number
): Promise<void> {
  await logChange({
    eventType: 'photo_added',
    category: 'board_game',
    entityId: gameId,
    entityName: gameName,
    description: `Added ${photoCount} photo${photoCount > 1 ? 's' : ''} to ${gameName}`,
    staffMember,
    staffId,
    metadata: { photoCount },
  });
}

export async function logPlayLogCreated(
  playLogId: string,
  gameName: string,
  staffMember: string,
  staffId: string,
  duration?: number
): Promise<void> {
  await logChange({
    eventType: 'created',
    category: 'play_log',
    entityId: playLogId,
    entityName: gameName,
    description: `Logged play session for ${gameName}${duration ? ` (${duration} hours)` : ''}`,
    staffMember,
    staffId,
    metadata: duration ? { duration } : undefined,
  });
}

export async function logPlayLogDeleted(
  playLogId: string,
  gameName: string,
  staffMember: string,
  staffId: string
): Promise<void> {
  await logChange({
    eventType: 'deleted',
    category: 'play_log',
    entityId: playLogId,
    entityName: gameName,
    description: `Deleted play log for ${gameName}`,
    staffMember,
    staffId,
  });
}

export async function logKnowledgeCreated(
  knowledgeId: string,
  gameName: string,
  staffMember: string,
  staffId: string,
  confidenceLevel: string,
  canTeach: boolean
): Promise<void> {
  await logChange({
    eventType: 'created',
    category: 'staff_knowledge',
    entityId: knowledgeId,
    entityName: gameName,
    description: `Added knowledge: ${gameName} - ${confidenceLevel} level`,
    staffMember,
    staffId,
    metadata: { confidenceLevel, canTeach },
  });
}

export async function logKnowledgeUpdated(
  knowledgeId: string,
  gameName: string,
  staffMember: string,
  staffId: string,
  oldLevel: string,
  newLevel: string
): Promise<void> {
  await logChange({
    eventType: 'updated',
    category: 'staff_knowledge',
    entityId: knowledgeId,
    entityName: gameName,
    description: `Updated knowledge: ${gameName} (${oldLevel} → ${newLevel})`,
    staffMember,
    staffId,
    metadata: { oldLevel, newLevel },
  });
}

export async function logKnowledgeDeleted(
  knowledgeId: string,
  gameName: string,
  staffMember: string,
  staffId: string
): Promise<void> {
  await logChange({
    eventType: 'deleted',
    category: 'staff_knowledge',
    entityId: knowledgeId,
    entityName: gameName,
    description: `Deleted knowledge entry for ${gameName}`,
    staffMember,
    staffId,
  });
}

export async function logContentCheckCreated(
  checkId: string,
  gameName: string,
  staffMember: string,
  staffId: string,
  status: string,
  notes?: string
): Promise<void> {
  await logChange({
    eventType: 'created',
    category: 'content_check',
    entityId: checkId,
    entityName: gameName,
    description: `Content check: ${gameName} - ${status}`,
    staffMember,
    staffId,
    metadata: { status, notes },
  });
}