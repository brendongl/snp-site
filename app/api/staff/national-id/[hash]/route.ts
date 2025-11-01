import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import DatabaseService from '@/lib/services/db-service';
import * as fs from 'fs/promises';
import * as path from 'path';

export const dynamic = 'force-dynamic';

// Constants
const STAFF_IDS_DIR = path.join(process.cwd(), 'data', 'staff-ids');

/**
 * GET /api/staff/national-id/[hash]
 * Serve National ID image for authenticated staff member
 *
 * Security:
 * - Only authenticated staff can view National IDs
 * - Users can ONLY view their own National ID
 * - Returns 403 if user tries to access someone else's National ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    // 1. Authenticate user
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 2. Get current staff member by email
    const db = DatabaseService.initialize();
    const staff = await db.staff.getStaffByEmail(session.user.email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // 3. Get hash from params
    const { hash } = await params;

    // 4. Validate hash format (should be MD5 hex, 32 chars)
    if (!hash || !/^[a-f0-9]{32}$/.test(hash)) {
      return NextResponse.json(
        { error: 'Invalid hash format' },
        { status: 400 }
      );
    }

    // 5. Security: Check if user is authorized to view this National ID
    if (staff.nationalIdHash !== hash) {
      console.warn(
        `[National ID Access Denied] Staff ${staff.id} (${staff.email}) ` +
        `attempted to access hash ${hash} (their hash: ${staff.nationalIdHash})`
      );
      return NextResponse.json(
        { error: 'Forbidden: You can only view your own National ID' },
        { status: 403 }
      );
    }

    // 6. Security: Prevent directory traversal
    if (hash.includes('..') || hash.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // 7. Look for image with any allowed extension
    const extensions = ['.jpg', '.jpeg', '.png'];
    let imagePath: string | null = null;
    let foundExtension: string | null = null;

    for (const ext of extensions) {
      const potentialPath = path.join(STAFF_IDS_DIR, `${hash}${ext}`);
      try {
        await fs.access(potentialPath);
        imagePath = potentialPath;
        foundExtension = ext;
        break;
      } catch (error) {
        // File doesn't exist with this extension, try next
        continue;
      }
    }

    // 8. Return 404 if file not found on disk
    if (!imagePath || !foundExtension) {
      console.warn(`[National ID Not Found] Hash ${hash} not found on disk`);
      return NextResponse.json(
        { error: 'National ID image not found' },
        { status: 404 }
      );
    }

    // 9. Read image file
    const imageBuffer = await fs.readFile(imagePath);

    // 10. Determine MIME type
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    const mimeType = mimeTypeMap[foundExtension] || 'application/octet-stream';

    // 11. Set cache headers - 1 year for immutable hashed content
    const response = new NextResponse(imageBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${hash}"`,
      },
    });

    console.log(
      `[National ID Served] Staff ${staff.id} (${staff.email}) ` +
      `accessed their National ID (hash: ${hash})`
    );

    return response;
  } catch (error) {
    console.error('[National ID Serve] Error serving National ID:', error);

    return NextResponse.json(
      {
        error: 'Failed to serve National ID',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
