import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export const dynamic = 'force-dynamic';

// Constants
const STAFF_IDS_DIR = path.join(process.cwd(), 'data', 'staff-ids');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * POST /api/staff/national-id/upload
 * Upload National ID image for authenticated staff member
 * Uses form data with email parameter for localStorage authentication
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse form data
    const formData = await request.formData();
    const email = formData.get('email') as string | null;
    const file = formData.get('file') as File | null;

    // 2. Validate email (from localStorage authentication)
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    // 3. Get staff member by email
    const db = DatabaseService.initialize();
    const staff = await db.staff.getStaffByEmail(email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // 4. Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 5. Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, JPEG, and PNG are allowed.' },
        { status: 400 }
      );
    }

    // 5. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // 6. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Calculate MD5 hash
    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    // 8. Determine file extension
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: 'Invalid file extension' },
        { status: 400 }
      );
    }

    // 9. Ensure directory exists
    try {
      await fs.mkdir(STAFF_IDS_DIR, { recursive: true, mode: 0o755 });
    } catch (error) {
      console.error('Error creating staff-ids directory:', error);
      return NextResponse.json(
        { error: 'Failed to create storage directory' },
        { status: 500 }
      );
    }

    // 10. Save to persistent volume using atomic write pattern
    const fileName = `${hash}${extension}`;
    const filePath = path.join(STAFF_IDS_DIR, fileName);
    const tempPath = path.join(STAFF_IDS_DIR, `${hash}.tmp`);

    try {
      // Write to temp file first
      await fs.writeFile(tempPath, buffer);

      // Rename to final path (atomic operation)
      await fs.rename(tempPath, filePath);

      console.log(`[National ID Upload] Saved to disk: ${filePath}`);
    } catch (error) {
      console.error('[National ID Upload] Filesystem error:', error);

      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return NextResponse.json(
        {
          error: 'Failed to save image to disk',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // 11. Update database with national_id_hash
    try {
      const success = await db.staff.updateStaffProfile(staff.id, {
        nationalIdHash: hash
      });

      if (!success) {
        console.error('[National ID Upload] Failed to update database');
        return NextResponse.json(
          { error: 'Failed to update staff record' },
          { status: 500 }
        );
      }

      console.log(`[National ID Upload] Updated staff ${staff.id} with hash: ${hash}`);
    } catch (error) {
      console.error('[National ID Upload] Database error:', error);
      return NextResponse.json(
        {
          error: 'Failed to update staff record',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // 12. Return success response
    return NextResponse.json({
      success: true,
      hash,
    });
  } catch (error) {
    console.error('[National ID Upload] Upload failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload National ID',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
