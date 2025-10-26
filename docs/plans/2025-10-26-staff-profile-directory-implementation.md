# Staff Profile and Directory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build staff profile management page (with tabs for account info, activity, and knowledge) and a staff directory page for viewing all staff contact information and stats.

**Architecture:** Extend PostgreSQL staff_list table with profile fields, create staff database service layer, build 5 new API endpoints, implement 2 pages with React components. One-time migration script downloads National ID images from Airtable to persistent volume. No Airtable dependencies after migration.

**Tech Stack:** Next.js 15, PostgreSQL, TypeScript, Tailwind CSS, shadcn/ui components

---

## Prerequisites

- Worktree created at `.worktrees/feature/staff-profile-directory`
- Branch: `feature/staff-profile-directory`
- DATABASE_URL configured in environment
- Airtable MCP available for one-time migration

---

## Task 1: Extend PostgreSQL Schema

**Goal:** Add new columns to `staff_list` table for profile fields

**Files:**
- Create: `scripts/add-staff-profile-columns.js`

**Step 1: Write migration script**

Create `scripts/add-staff-profile-columns.js`:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addStaffProfileColumns() {
  const client = await pool.connect();

  try {
    console.log('🔧 Adding profile columns to staff_list table...\n');

    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS nickname VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contact_ph VARCHAR(50),
      ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS national_id_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS home_address TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS emergency_contact_ph VARCHAR(50),
      ADD COLUMN IF NOT EXISTS date_of_hire DATE,
      ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    console.log('✅ Successfully added profile columns\n');

    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'staff_list'
      AND column_name IN (
        'nickname', 'contact_ph', 'bank_account_number', 'bank_name',
        'national_id_hash', 'home_address', 'emergency_contact_name',
        'emergency_contact_ph', 'date_of_hire', 'profile_updated_at'
      )
      ORDER BY column_name;
    `);

    console.log('📋 Added columns:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addStaffProfileColumns().catch(console.error);
```

**Step 2: Run migration script**

Run: `node scripts/add-staff-profile-columns.js`

Expected output:
```
🔧 Adding profile columns to staff_list table...
✅ Successfully added profile columns
📋 Added columns:
   - bank_account_number (character varying)
   - bank_name (character varying)
   - contact_ph (character varying)
   ...
```

**Step 3: Commit**

```bash
git add scripts/add-staff-profile-columns.js
git commit -m "feat: Add staff profile columns to database schema

Add 10 new columns to staff_list table:
- nickname, contact_ph, banking info
- national_id_hash, home_address
- emergency contact fields
- date_of_hire, profile_updated_at

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create Staff Database Service

**Goal:** Create service layer for staff database operations

**Files:**
- Create: `lib/services/staff-db-service.ts`

**Step 1: Create service interface and class**

Create `lib/services/staff-db-service.ts`:

```typescript
import { pool } from '@/lib/db/postgres';

export interface StaffMember {
  staffId: string;
  stafflistId: string;
  name: string;
  nickname: string | null;
  email: string;
  type: string;
  contactPh: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  nationalIdHash: string | null;
  homeAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPh: string | null;
  dateOfHire: string | null;
  createdAt: string;
  updatedAt: string;
  profileUpdatedAt: string | null;
}

export interface StaffProfileUpdate {
  nickname?: string;
  email?: string;
  contactPh?: string;
  bankAccountNumber?: string;
  bankName?: string;
  homeAddress?: string;
  emergencyContactName?: string;
  emergencyContactPh?: string;
}

export interface StaffStats {
  totalKnowledge: number;
  knowledgeByLevel: {
    missing: number;
    beginner: number;
    intermediate: number;
    expert: number;
  };
  canTeachCount: number;
  totalPlayLogs: number;
  totalContentChecks: number;
}

class StaffDbService {
  /**
   * Get staff member by ID
   */
  async getStaffById(staffId: string): Promise<StaffMember | null> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT
          staff_id as "staffId",
          stafflist_id as "stafflistId",
          staff_name as name,
          nickname,
          staff_email as email,
          staff_type as type,
          contact_ph as "contactPh",
          bank_account_number as "bankAccountNumber",
          bank_name as "bankName",
          national_id_hash as "nationalIdHash",
          home_address as "homeAddress",
          emergency_contact_name as "emergencyContactName",
          emergency_contact_ph as "emergencyContactPh",
          date_of_hire as "dateOfHire",
          created_at as "createdAt",
          updated_at as "updatedAt",
          profile_updated_at as "profileUpdatedAt"
        FROM staff_list
        WHERE staff_id = $1`,
        [staffId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get staff member by email
   */
  async getStaffByEmail(email: string): Promise<StaffMember | null> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT
          staff_id as "staffId",
          stafflist_id as "stafflistId",
          staff_name as name,
          nickname,
          staff_email as email,
          staff_type as type,
          contact_ph as "contactPh",
          bank_account_number as "bankAccountNumber",
          bank_name as "bankName",
          national_id_hash as "nationalIdHash",
          home_address as "homeAddress",
          emergency_contact_name as "emergencyContactName",
          emergency_contact_ph as "emergencyContactPh",
          date_of_hire as "dateOfHire",
          created_at as "createdAt",
          updated_at as "updatedAt",
          profile_updated_at as "profileUpdatedAt"
        FROM staff_list
        WHERE LOWER(staff_email) = LOWER($1)`,
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Update staff profile (editable fields only)
   */
  async updateStaffProfile(
    staffId: string,
    updates: StaffProfileUpdate
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      if (updates.nickname !== undefined) {
        fields.push(`nickname = $${paramIndex++}`);
        values.push(updates.nickname);
      }
      if (updates.email !== undefined) {
        fields.push(`staff_email = $${paramIndex++}`);
        values.push(updates.email);
      }
      if (updates.contactPh !== undefined) {
        fields.push(`contact_ph = $${paramIndex++}`);
        values.push(updates.contactPh);
      }
      if (updates.bankAccountNumber !== undefined) {
        fields.push(`bank_account_number = $${paramIndex++}`);
        values.push(updates.bankAccountNumber);
      }
      if (updates.bankName !== undefined) {
        fields.push(`bank_name = $${paramIndex++}`);
        values.push(updates.bankName);
      }
      if (updates.homeAddress !== undefined) {
        fields.push(`home_address = $${paramIndex++}`);
        values.push(updates.homeAddress);
      }
      if (updates.emergencyContactName !== undefined) {
        fields.push(`emergency_contact_name = $${paramIndex++}`);
        values.push(updates.emergencyContactName);
      }
      if (updates.emergencyContactPh !== undefined) {
        fields.push(`emergency_contact_ph = $${paramIndex++}`);
        values.push(updates.emergencyContactPh);
      }

      if (fields.length === 0) {
        return false; // Nothing to update
      }

      // Always update profile_updated_at and updated_at
      fields.push(`profile_updated_at = CURRENT_TIMESTAMP`);
      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(staffId);

      const query = `
        UPDATE staff_list
        SET ${fields.join(', ')}
        WHERE staff_id = $${paramIndex}
      `;

      const result = await client.query(query, values);
      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Get all staff members (for directory)
   */
  async getAllStaff(): Promise<StaffMember[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT
          staff_id as "staffId",
          stafflist_id as "stafflistId",
          staff_name as name,
          nickname,
          staff_email as email,
          staff_type as type,
          contact_ph as "contactPh",
          bank_account_number as "bankAccountNumber",
          bank_name as "bankName",
          national_id_hash as "nationalIdHash",
          home_address as "homeAddress",
          emergency_contact_name as "emergencyContactName",
          emergency_contact_ph as "emergencyContactPh",
          date_of_hire as "dateOfHire",
          created_at as "createdAt",
          updated_at as "updatedAt",
          profile_updated_at as "profileUpdatedAt"
        FROM staff_list
        ORDER BY staff_name ASC`
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get staff statistics (knowledge, play logs, content checks)
   */
  async getStaffStats(staffId: string): Promise<StaffStats> {
    const client = await pool.connect();

    try {
      // Get knowledge stats
      const knowledgeResult = await client.query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN confidence_level = 0 THEN 1 ELSE 0 END) as missing,
          SUM(CASE WHEN confidence_level = 1 THEN 1 ELSE 0 END) as beginner,
          SUM(CASE WHEN confidence_level = 2 THEN 1 ELSE 0 END) as intermediate,
          SUM(CASE WHEN confidence_level = 3 THEN 1 ELSE 0 END) as expert,
          SUM(CASE WHEN can_teach = true THEN 1 ELSE 0 END) as can_teach
        FROM staff_knowledge
        WHERE staff_member_id = $1`,
        [staffId]
      );

      // Get play logs count
      const playLogsResult = await client.query(
        `SELECT COUNT(*) as total
        FROM play_logs
        WHERE staff_list_id = $1`,
        [staffId]
      );

      // Get content checks count
      const contentChecksResult = await client.query(
        `SELECT COUNT(*) as total
        FROM content_checks
        WHERE inspector_staff_id = $1`,
        [staffId]
      );

      const knowledge = knowledgeResult.rows[0];

      return {
        totalKnowledge: parseInt(knowledge.total) || 0,
        knowledgeByLevel: {
          missing: parseInt(knowledge.missing) || 0,
          beginner: parseInt(knowledge.beginner) || 0,
          intermediate: parseInt(knowledge.intermediate) || 0,
          expert: parseInt(knowledge.expert) || 0,
        },
        canTeachCount: parseInt(knowledge.can_teach) || 0,
        totalPlayLogs: parseInt(playLogsResult.rows[0].total) || 0,
        totalContentChecks: parseInt(contentChecksResult.rows[0].total) || 0,
      };
    } finally {
      client.release();
    }
  }
}

export const staffDbService = new StaffDbService();
```

**Step 2: Commit**

```bash
git add lib/services/staff-db-service.ts
git commit -m "feat: Create staff database service layer

Add StaffDbService with methods for:
- Get staff by ID or email
- Update staff profile (editable fields only)
- Get all staff (for directory)
- Get staff stats (knowledge, play logs, checks)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Create GET /api/staff/profile Endpoint

**Goal:** API endpoint to get current staff member's profile and stats

**Files:**
- Create: `app/api/staff/profile/route.ts`

**Step 1: Create profile GET endpoint**

Create `app/api/staff/profile/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { staffDbService } from '@/lib/services/staff-db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get session to identify current staff member
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get staff member by email
    const staff = await staffDbService.getStaffByEmail(session.user.email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Get staff stats
    const stats = await staffDbService.getStaffStats(staff.staffId);

    return NextResponse.json({
      profile: staff,
      stats,
    });
  } catch (error) {
    console.error('Error fetching staff profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/staff/profile/route.ts
git commit -m "feat: Add GET /api/staff/profile endpoint

Returns current staff member's profile and stats.
Requires authentication via session.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create PATCH /api/staff/profile Endpoint

**Goal:** API endpoint to update staff profile with email change handling

**Files:**
- Modify: `app/api/staff/profile/route.ts`

**Step 1: Add PATCH handler to profile route**

Modify `app/api/staff/profile/route.ts` to add PATCH handler:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { staffDbService } from '@/lib/services/staff-db-service';
import { signOut } from 'next-auth/react';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ... existing GET code ...
}

export async function PATCH(request: Request) {
  try {
    // Get session to identify current staff member
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get staff member by email
    const staff = await staffDbService.getStaffByEmail(session.user.email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const updates = await request.json();

    // Validate editable fields only
    const allowedFields = [
      'nickname',
      'email',
      'contactPh',
      'bankAccountNumber',
      'bankName',
      'homeAddress',
      'emergencyContactName',
      'emergencyContactPh',
    ];

    const filteredUpdates: any = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Check if email is being changed
    const emailChanged = filteredUpdates.email &&
                        filteredUpdates.email.toLowerCase() !== staff.email.toLowerCase();

    // Update profile
    const success = await staffDbService.updateStaffProfile(
      staff.staffId,
      filteredUpdates
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailChanged,
      message: emailChanged
        ? 'Profile updated. Please log in with your new email.'
        : 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating staff profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/staff/profile/route.ts
git commit -m "feat: Add PATCH /api/staff/profile endpoint

Updates staff profile with validation:
- Only editable fields allowed
- Returns emailChanged flag if email updated
- Frontend should logout on email change

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Create GET /api/staff/directory Endpoint

**Goal:** API endpoint to get all staff for directory (public fields only)

**Files:**
- Create: `app/api/staff/directory/route.ts`

**Step 1: Create directory endpoint**

Create `app/api/staff/directory/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { staffDbService } from '@/lib/services/staff-db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Require authentication (staff only)
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get all staff members
    const allStaff = await staffDbService.getAllStaff();

    // Map to public directory format (exclude sensitive fields)
    const directory = await Promise.all(
      allStaff.map(async (staff) => {
        const stats = await staffDbService.getStaffStats(staff.staffId);

        return {
          staffId: staff.staffId,
          name: staff.name,
          nickname: staff.nickname || staff.name.split(' ').pop(), // Default to last name
          contactPh: staff.contactPh,
          emergencyContactName: staff.emergencyContactName,
          emergencyContactPh: staff.emergencyContactPh,
          dateOfHire: staff.dateOfHire,
          stats: {
            totalKnowledge: stats.totalKnowledge,
            totalPlayLogs: stats.totalPlayLogs,
            totalContentChecks: stats.totalContentChecks,
          },
        };
      })
    );

    return NextResponse.json({ staff: directory });
  } catch (error) {
    console.error('Error fetching staff directory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch directory' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/staff/directory/route.ts
git commit -m "feat: Add GET /api/staff/directory endpoint

Returns all staff with public fields:
- name, nickname, contact info
- emergency contact info
- date of hire
- stats (knowledge, play logs, checks)

Excludes: banking, national ID, email, home address

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Create National ID Upload Endpoint

**Goal:** API endpoint to upload National ID images to persistent volume

**Files:**
- Create: `app/api/staff/national-id/upload/route.ts`

**Step 1: Create upload endpoint**

Create `app/api/staff/national-id/upload/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { staffDbService } from '@/lib/services/staff-db-service';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const STAFF_IDS_DIR = '/app/data/staff-ids';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    // Get session to identify current staff member
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get staff member
    const staff = await staffDbService.getStaffByEmail(session.user.email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG and PNG allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Calculate MD5 hash
    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    // Ensure directory exists
    await fs.mkdir(STAFF_IDS_DIR, { recursive: true });

    // Determine file extension
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${hash}.${ext}`;
    const filepath = path.join(STAFF_IDS_DIR, filename);

    // Write file to persistent volume
    await fs.writeFile(filepath, buffer);

    // Update staff record with hash
    await staffDbService.updateStaffProfile(staff.staffId, {
      // Note: We need to update the service to accept nationalIdHash
      // For now, we'll do a direct query
    });

    // Direct update for national_id_hash
    const { pool } = require('@/lib/db/postgres');
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE staff_list
         SET national_id_hash = $1, profile_updated_at = CURRENT_TIMESTAMP
         WHERE staff_id = $2`,
        [hash, staff.staffId]
      );
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      hash,
      message: 'National ID uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading National ID:', error);
    return NextResponse.json(
      { error: 'Failed to upload National ID' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/staff/national-id/upload/route.ts
git commit -m "feat: Add POST /api/staff/national-id/upload endpoint

Uploads National ID image to persistent volume:
- Validates file type (jpg, png) and size (max 10MB)
- Stores in /app/data/staff-ids/ with MD5 hash
- Updates staff_list.national_id_hash

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Create National ID Serve Endpoint

**Goal:** API endpoint to serve National ID images with authorization

**Files:**
- Create: `app/api/staff/national-id/[hash]/route.ts`

**Step 1: Create serve endpoint**

Create `app/api/staff/national-id/[hash]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { staffDbService } from '@/lib/services/staff-db-service';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const STAFF_IDS_DIR = '/app/data/staff-ids';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Get session
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get current staff member
    const currentStaff = await staffDbService.getStaffByEmail(session.user.email);

    if (!currentStaff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Authorization: Staff can only view their own ID, admins can view all
    const isAdmin = currentStaff.type === 'Admin';
    const isOwnId = currentStaff.nationalIdHash === hash;

    if (!isOwnId && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized to view this National ID' },
        { status: 403 }
      );
    }

    // Try both jpg and png extensions
    let filepath: string | null = null;
    let contentType: string = 'image/jpeg';

    for (const ext of ['jpg', 'png']) {
      const testPath = path.join(STAFF_IDS_DIR, `${hash}.${ext}`);
      try {
        await fs.access(testPath);
        filepath = testPath;
        contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        break;
      } catch {
        // File doesn't exist with this extension, try next
      }
    }

    if (!filepath) {
      return NextResponse.json(
        { error: 'National ID image not found' },
        { status: 404 }
      );
    }

    // Read and serve file
    const fileBuffer = await fs.readFile(filepath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // 1 hour cache
      },
    });
  } catch (error) {
    console.error('Error serving National ID:', error);
    return NextResponse.json(
      { error: 'Failed to serve National ID' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/staff/national-id/[hash]/route.ts
git commit -m "feat: Add GET /api/staff/national-id/[hash] endpoint

Serves National ID images with authorization:
- Staff can only view their own ID
- Admins can view all IDs
- Returns image from persistent volume

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Create Staff Profile Page Structure

**Goal:** Create staff profile page with tab structure

**Files:**
- Create: `app/staff/profile/page.tsx`

**Step 1: Create profile page with tabs**

Create `app/staff/profile/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ProfileData {
  profile: any;
  stats: any;
}

export default function StaffProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staff/profile');

      if (response.status === 401) {
        router.push('/auth/signin');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profileData = await response.json();
      setData(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error || 'Failed to load profile'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account">Account Information</TabsTrigger>
          <TabsTrigger value="activity">My Activity</TabsTrigger>
          <TabsTrigger value="knowledge">My Knowledge</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Profile form will go here
              </p>
              <pre className="text-xs mt-4 p-4 bg-muted rounded">
                {JSON.stringify(data.profile, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>My Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity log will go here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>My Knowledge</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Knowledge stats will go here
              </p>
              <pre className="text-xs mt-4 p-4 bg-muted rounded">
                {JSON.stringify(data.stats, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Test page loads**

Run: `npm run dev` and navigate to `http://localhost:3000/staff/profile`

Expected: Page loads with 3 tabs showing placeholder content

**Step 3: Commit**

```bash
git add app/staff/profile/page.tsx
git commit -m "feat: Create staff profile page with tab structure

Add tabbed interface with 3 tabs:
- Account Information (placeholder)
- My Activity (placeholder)
- My Knowledge (placeholder)

Fetches profile data from API on load.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Create Profile Form Component

**Goal:** Build editable profile form for Account Information tab

**Files:**
- Create: `components/features/staff/StaffProfileForm.tsx`

**Step 1: Create profile form component**

Create `components/features/staff/StaffProfileForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface StaffProfileFormProps {
  profile: any;
  onUpdate: () => void;
}

export default function StaffProfileForm({ profile, onUpdate }: StaffProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nickname: profile.nickname || '',
    email: profile.email || '',
    contactPh: profile.contactPh || '',
    bankAccountNumber: profile.bankAccountNumber || '',
    bankName: profile.bankName || '',
    homeAddress: profile.homeAddress || '',
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactPh: profile.emergencyContactPh || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/staff/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await response.json();

      if (result.emailChanged) {
        toast({
          title: 'Email Updated',
          description: 'Please log in with your new email address.',
        });
        // Wait 2 seconds then redirect to login
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      } else {
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been saved successfully.',
        });
        onUpdate();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNationalIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/staff/national-id/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload National ID');
      }

      toast({
        title: 'Upload Successful',
        description: 'Your National ID has been uploaded.',
      });
      onUpdate();
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Read-only fields */}
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={profile.name} disabled />
        </div>

        {/* Editable fields */}
        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={formData.nickname}
            onChange={(e) => handleChange('nickname', e.target.value)}
            placeholder={profile.name.split(' ').pop()}
          />
          <p className="text-xs text-muted-foreground">
            This will be displayed on the website. Defaults to your last name.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          <p className="text-xs text-yellow-600">
            ⚠️ Changing your email will log you out. You'll need to sign in with your new email.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPh">Zalo Number</Label>
          <Input
            id="contactPh"
            type="tel"
            value={formData.contactPh}
            onChange={(e) => handleChange('contactPh', e.target.value)}
            placeholder="+84..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bankAccountNumber">VND Banking - Account Number</Label>
            <Input
              id="bankAccountNumber"
              value={formData.bankAccountNumber}
              onChange={(e) => handleChange('bankAccountNumber', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankName">VND Banking - Bank Name</Label>
            <Input
              id="bankName"
              value={formData.bankName}
              onChange={(e) => handleChange('bankName', e.target.value)}
              placeholder="e.g., Techcombank, MB Bank"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationalId">National ID Card</Label>
          {profile.nationalIdHash ? (
            <div className="space-y-2">
              <Image
                src={`/api/staff/national-id/${profile.nationalIdHash}`}
                alt="National ID"
                width={300}
                height={200}
                className="rounded border"
              />
              <Input
                id="nationalId"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleNationalIdUpload}
                disabled={uploading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                id="nationalId"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleNationalIdUpload}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Upload a photo of your National ID (JPG or PNG, max 10MB)
              </p>
            </div>
          )}
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
          <Input
            id="emergencyContactName"
            value={formData.emergencyContactName}
            onChange={(e) => handleChange('emergencyContactName', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyContactPh">Emergency Contact Number</Label>
          <Input
            id="emergencyContactPh"
            type="tel"
            value={formData.emergencyContactPh}
            onChange={(e) => handleChange('emergencyContactPh', e.target.value)}
            placeholder="+84..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="homeAddress">Home Address</Label>
          <Textarea
            id="homeAddress"
            value={formData.homeAddress}
            onChange={(e) => handleChange('homeAddress', e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Date of Hire</Label>
          <Input
            value={profile.dateOfHire || 'Not set'}
            disabled
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update profile page to use form**

Modify `app/staff/profile/page.tsx` to import and use the form:

```typescript
import StaffProfileForm from '@/components/features/staff/StaffProfileForm';

// ... in TabsContent for "account":
<TabsContent value="account">
  <StaffProfileForm profile={data.profile} onUpdate={fetchProfile} />
</TabsContent>
```

**Step 3: Test form**

Run: `npm run dev` and test:
1. Navigate to `/staff/profile`
2. Edit fields and save
3. Upload National ID image

Expected: Form saves successfully, shows toast notification

**Step 4: Commit**

```bash
git add components/features/staff/StaffProfileForm.tsx app/staff/profile/page.tsx
git commit -m "feat: Add staff profile form component

Editable form with:
- All profile fields (nickname, email, contact, banking, etc)
- National ID image upload
- Email change warning with auto-logout
- Toast notifications for success/error

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Create Activity Log Component

**Goal:** Display staff member's activity log in My Activity tab

**Files:**
- Create: `components/features/staff/StaffActivityLog.tsx`

**Step 1: Create activity log component**

Create `components/features/staff/StaffActivityLog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

interface ActivityLogProps {
  staffId: string;
}

interface ChangelogEntry {
  id: string;
  createdAt: string;
  staffMemberId: string;
  action: string;
  gameId: string | null;
  gameName: string | null;
  details: string | null;
}

export default function StaffActivityLog({ staffId }: ActivityLogProps) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivityLogs();
  }, [staffId]);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/changelog?staffMemberId=${staffId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }

      const data = await response.json();
      setLogs(data.changelogs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Activity Log</CardTitle>
        <p className="text-sm text-muted-foreground">
          {logs.length} total actions
        </p>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity logged yet
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>{log.gameName || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update profile page to use activity log**

Modify `app/staff/profile/page.tsx`:

```typescript
import StaffActivityLog from '@/components/features/staff/StaffActivityLog';

// ... in TabsContent for "activity":
<TabsContent value="activity">
  <StaffActivityLog staffId={data.profile.staffId} />
</TabsContent>
```

**Step 3: Commit**

```bash
git add components/features/staff/StaffActivityLog.tsx app/staff/profile/page.tsx
git commit -m "feat: Add staff activity log component

Displays changelog filtered by staff member:
- Fetches from /api/changelog with staffMemberId filter
- Shows date, action, game, and details
- Table format with loading and error states

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Create Knowledge Stats Component

**Goal:** Display knowledge statistics in My Knowledge tab

**Files:**
- Create: `components/features/staff/StaffKnowledgeStats.tsx`

**Step 1: Create knowledge stats component**

Create `components/features/staff/StaffKnowledgeStats.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';

interface KnowledgeStatsProps {
  stats: any;
  staffId: string;
}

interface KnowledgeEntry {
  id: string;
  gameId: string;
  gameName: string;
  confidenceLevel: number;
  canTeach: boolean;
  notes: string | null;
}

const CONFIDENCE_LABELS: Record<number, string> = {
  0: 'Missing',
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Expert',
};

const CONFIDENCE_COLORS: Record<number, string> = {
  0: 'bg-gray-500',
  1: 'bg-yellow-500',
  2: 'bg-blue-500',
  3: 'bg-green-500',
};

export default function StaffKnowledgeStats({ stats, staffId }: KnowledgeStatsProps) {
  const [loading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [filteredKnowledge, setFilteredKnowledge] = useState<KnowledgeEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledge();
  }, [staffId]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredKnowledge(
        knowledge.filter((k) =>
          k.gameName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredKnowledge(knowledge);
    }
  }, [searchTerm, knowledge]);

  const fetchKnowledge = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/staff-knowledge?staffMemberId=${staffId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch knowledge data');
      }

      const data = await response.json();
      setKnowledge(data.knowledge || []);
      setFilteredKnowledge(data.knowledge || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalKnowledge}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-500">
              {stats.knowledgeByLevel.missing}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Beginner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">
              {stats.knowledgeByLevel.beginner}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Intermediate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">
              {stats.knowledgeByLevel.intermediate}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expert</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              {stats.knowledgeByLevel.expert}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Can Teach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-500">
              {stats.canTeachCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Table */}
      <Card>
        <CardHeader>
          <CardTitle>Game Knowledge</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredKnowledge.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No games found
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Game Name</TableHead>
                    <TableHead>Confidence Level</TableHead>
                    <TableHead>Can Teach</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKnowledge.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.gameName}</TableCell>
                      <TableCell>
                        <Badge className={CONFIDENCE_COLORS[k.confidenceLevel]}>
                          {CONFIDENCE_LABELS[k.confidenceLevel]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {k.canTeach ? (
                          <Badge variant="outline" className="bg-green-50">
                            ✓ Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50">
                            - No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {k.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Update profile page to use knowledge stats**

Modify `app/staff/profile/page.tsx`:

```typescript
import StaffKnowledgeStats from '@/components/features/staff/StaffKnowledgeStats';

// ... in TabsContent for "knowledge":
<TabsContent value="knowledge">
  <StaffKnowledgeStats stats={data.stats} staffId={data.profile.staffId} />
</TabsContent>
```

**Step 3: Commit**

```bash
git add components/features/staff/StaffKnowledgeStats.tsx app/staff/profile/page.tsx
git commit -m "feat: Add staff knowledge stats component

Displays knowledge stats with:
- 6 stat cards (total, missing, beginner, intermediate, expert, can teach)
- Searchable table of all games with knowledge
- Confidence level badges with colors
- Can teach indicator

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Create Staff Directory Page

**Goal:** Create staff directory page with searchable table

**Files:**
- Create: `app/staff/directory/page.tsx`

**Step 1: Create directory page**

Create `app/staff/directory/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Phone, Users } from 'lucide-react';

interface DirectoryStaff {
  staffId: string;
  name: string;
  nickname: string;
  contactPh: string | null;
  emergencyContactName: string | null;
  emergencyContactPh: string | null;
  dateOfHire: string | null;
  stats: {
    totalKnowledge: number;
    totalPlayLogs: number;
    totalContentChecks: number;
  };
}

export default function StaffDirectoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<DirectoryStaff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<DirectoryStaff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDirectory();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredStaff(
        staff.filter(
          (s) =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.nickname.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredStaff(staff);
    }
  }, [searchTerm, staff]);

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staff/directory');

      if (response.status === 401) {
        router.push('/auth/signin');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch directory');
      }

      const data = await response.json();
      setStaff(data.staff || []);
      setFilteredStaff(data.staff || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Staff Directory</h1>
          <p className="text-muted-foreground mt-1">
            Contact information for all staff members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">{staff.length} staff members</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or nickname..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No staff members found
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Emergency Contact</TableHead>
                    <TableHead>Date of Hire</TableHead>
                    <TableHead className="text-right">Stats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((member) => (
                    <TableRow key={member.staffId}>
                      <TableCell>
                        <div className="font-medium">{member.name}</div>
                        {member.nickname !== member.name.split(' ').pop() && (
                          <div className="text-sm text-muted-foreground">
                            ({member.nickname})
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {member.contactPh || '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.emergencyContactName ? (
                          <div>
                            <div className="font-medium text-sm">
                              {member.emergencyContactName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-xs text-muted-foreground">
                                {member.emergencyContactPh || '-'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {member.dateOfHire
                          ? new Date(member.dateOfHire).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <span className="font-mono font-medium">
                              {member.stats.totalKnowledge}
                            </span>
                            <span className="text-muted-foreground">games</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-mono font-medium">
                              {member.stats.totalPlayLogs}
                            </span>
                            <span className="text-muted-foreground">logs</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-mono font-medium">
                              {member.stats.totalContentChecks}
                            </span>
                            <span className="text-muted-foreground">checks</span>
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Test directory page**

Run: `npm run dev` and navigate to `http://localhost:3000/staff/directory`

Expected: Directory table loads with all staff members, search works

**Step 3: Commit**

```bash
git add app/staff/directory/page.tsx
git commit -m "feat: Add staff directory page

Searchable directory table with:
- Name (with nickname if different)
- Phone number
- Emergency contact (name + phone)
- Date of hire
- Stats (knowledge, play logs, checks)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Create Migration Script for Airtable Data

**Goal:** One-time migration to populate PostgreSQL with Airtable staff data

**Files:**
- Create: `scripts/migrate-staff-from-airtable.js`

**Step 1: Create migration script**

Create `scripts/migrate-staff-from-airtable.js`:

```javascript
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const STAFF_IDS_DIR = '/app/data/staff-ids';
const AIRTABLE_SIP_N_PLAY_BASE_ID = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
const AIRTABLE_STAFF_TABLE_ID = 'tblLthDOTzCPbSdAA';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

/**
 * Download image from URL to buffer
 */
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

/**
 * Parse bank account field (best-effort)
 */
function parseBankAccount(bankAccountText) {
  if (!bankAccountText) {
    return { accountNumber: null, bankName: null };
  }

  const text = bankAccountText.trim();

  // Try colon separator: "Seabank: 000001032260"
  if (text.includes(':')) {
    const parts = text.split(':');
    return {
      bankName: parts[0].trim(),
      accountNumber: parts[1].trim(),
    };
  }

  // Try plus separator: "Asia Commercial Bank ( ACB ) + 6705041"
  if (text.includes('+')) {
    const parts = text.split('+');
    return {
      bankName: parts[0].trim(),
      accountNumber: parts[1].trim(),
    };
  }

  // Try newline separator: "MB bank \n0845022005 \nĐặng Nhật Minh"
  if (text.includes('\n')) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return {
        bankName: lines[0],
        accountNumber: lines[1],
      };
    }
  }

  // Fallback: store as-is in bank_name
  return {
    bankName: text,
    accountNumber: null,
  };
}

/**
 * Extract default nickname from full name (last name)
 */
function extractNickname(fullName) {
  if (!fullName) return null;
  const parts = fullName.split(' ').filter(Boolean);
  return parts[parts.length - 1]; // Last word
}

async function migrateStaffData() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting staff data migration from Airtable...\n');

    // Fetch all staff from Airtable
    console.log('📋 Fetching staff from Airtable...');
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_SIP_N_PLAY_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Fetched ${data.records.length} staff records\n`);

    // Ensure staff-ids directory exists
    await fs.mkdir(STAFF_IDS_DIR, { recursive: true });

    let successCount = 0;
    let errorCount = 0;

    for (const record of data.records) {
      const fields = record.fields;
      const name = fields['Name'];
      const email = fields['Email'];

      if (!name || !email) {
        console.log(`⚠️  Skipping record ${record.id}: Missing name or email`);
        errorCount++;
        continue;
      }

      try {
        console.log(`\n📝 Processing: ${name} (${email})`);

        // Parse bank account
        const { bankName, accountNumber } = parseBankAccount(fields['Bank account']);

        // Extract default nickname
        const nickname = extractNickname(name);

        // Download National ID image if exists
        let nationalIdHash = null;
        if (fields['National ID Card'] && fields['National ID Card'].length > 0) {
          const firstAttachment = fields['National ID Card'][0];
          console.log(`   ⬇️  Downloading National ID...`);

          try {
            const imageBuffer = await downloadImage(firstAttachment.url);
            const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');

            // Determine extension
            const ext = firstAttachment.type === 'image/png' ? 'png' : 'jpg';
            const filename = `${hash}.${ext}`;
            const filepath = path.join(STAFF_IDS_DIR, filename);

            // Write to persistent volume
            await fs.writeFile(filepath, imageBuffer);
            nationalIdHash = hash;
            console.log(`   ✓ Saved National ID: ${filename}`);
          } catch (imgError) {
            console.log(`   ⚠️  Failed to download National ID: ${imgError.message}`);
          }
        }

        // Update database record
        const updateQuery = `
          UPDATE staff_list
          SET
            nickname = $1,
            contact_ph = $2,
            bank_account_number = $3,
            bank_name = $4,
            national_id_hash = $5,
            home_address = $6,
            emergency_contact_name = $7,
            emergency_contact_ph = $8,
            profile_updated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE LOWER(staff_email) = LOWER($9)
        `;

        const result = await client.query(updateQuery, [
          nickname,
          fields['Contact Ph'] || null,
          accountNumber,
          bankName,
          nationalIdHash,
          fields['Home Address'] || null,
          fields['Emergency Contact Name'] || null,
          fields['Emergency Contact Ph No'] || null,
          email,
        ]);

        if (result.rowCount > 0) {
          console.log(`   ✅ Updated database record`);
          successCount++;
        } else {
          console.log(`   ⚠️  No matching record found in database`);
          errorCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Migration complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateStaffData().catch(console.error);
```

**Step 2: Run migration (once)**

Run: `node scripts/migrate-staff-from-airtable.js`

Expected output:
```
🔄 Starting staff data migration from Airtable...
📋 Fetching staff from Airtable...
✓ Fetched X staff records

📝 Processing: Staff Name (email@example.com)
   ⬇️  Downloading National ID...
   ✓ Saved National ID: abc123.jpg
   ✅ Updated database record

=============================================================
✅ Migration complete!
   Success: X
   Errors: 0
=============================================================
```

**Step 3: Commit**

```bash
git add scripts/migrate-staff-from-airtable.js
git commit -m "feat: Add Airtable staff data migration script

One-time migration that:
- Fetches all staff from Airtable Staff table
- Parses bank account field (best-effort)
- Downloads National ID images to persistent volume
- Extracts default nickname from last name
- Updates PostgreSQL staff_list table

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Update Staff Menu

**Goal:** Add links to Profile and Directory pages in staff menu

**Files:**
- Modify: `components/features/staff/StaffMenu.tsx`

**Step 1: Add menu items**

Find the StaffMenu component and add two new menu items:

```typescript
// Add these menu items to the StaffMenu component
{
  label: 'My Profile',
  href: '/staff/profile',
  icon: User, // Import from lucide-react
},
{
  label: 'Staff Directory',
  href: '/staff/directory',
  icon: Users, // Import from lucide-react
},
```

**Step 2: Test menu navigation**

Run: `npm run dev` and verify:
1. Staff menu shows "My Profile" and "Staff Directory"
2. Clicking navigates to correct pages

**Step 3: Commit**

```bash
git add components/features/staff/StaffMenu.tsx
git commit -m "feat: Add Profile and Directory links to staff menu

Add navigation items:
- My Profile → /staff/profile
- Staff Directory → /staff/directory

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 15: Final Testing & Version Update

**Goal:** Test all features end-to-end and update version

**Files:**
- Modify: `lib/version.ts`
- Modify: `package.json`

**Step 1: Manual testing checklist**

Test in this order:

1. **Profile Page - Account Tab:**
   - [ ] Page loads with correct data
   - [ ] All fields editable except read-only ones
   - [ ] Save updates database
   - [ ] Email change triggers logout
   - [ ] National ID upload works
   - [ ] Toast notifications appear

2. **Profile Page - Activity Tab:**
   - [ ] Activity log loads
   - [ ] Shows filtered changelog for current user
   - [ ] Table displays correctly

3. **Profile Page - Knowledge Tab:**
   - [ ] Stats cards show correct counts
   - [ ] Knowledge table loads
   - [ ] Search filters games
   - [ ] Confidence badges show correct colors

4. **Directory Page:**
   - [ ] All staff listed
   - [ ] Search filters by name/nickname
   - [ ] Stats display correctly
   - [ ] Emergency contacts visible

5. **API Endpoints:**
   - [ ] GET /api/staff/profile returns data
   - [ ] PATCH /api/staff/profile updates
   - [ ] GET /api/staff/directory returns all staff
   - [ ] POST /api/staff/national-id/upload works
   - [ ] GET /api/staff/national-id/[hash] serves images

**Step 2: Update version**

Modify `lib/version.ts`:
```typescript
export const VERSION = '1.8.0'; // or next appropriate version
```

Modify `package.json`:
```json
{
  "version": "1.8.0"
}
```

**Step 3: Run build to verify**

Run: `npm run build`

Expected: Build succeeds with no errors

**Step 4: Commit version update**

```bash
git add lib/version.ts package.json
git commit -m "chore: Bump version to 1.8.0

All features tested and working:
- Staff profile page with 3 tabs
- Staff directory page
- 5 new API endpoints
- National ID image storage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Completion Checklist

Before merging to staging:

- [ ] All 15 tasks completed
- [ ] Database schema extended
- [ ] Service layer created
- [ ] All 5 API endpoints working
- [ ] Profile page with 3 tabs functional
- [ ] Directory page working
- [ ] Migration script tested
- [ ] Manual testing passed
- [ ] Build succeeds
- [ ] Version updated
- [ ] All commits pushed to feature branch

---

## Next Steps

After completing implementation:

1. **Merge to Staging:**
   ```bash
   git checkout staging
   git merge feature/staff-profile-directory
   git push origin staging
   ```

2. **Run Migration on Staging:**
   ```bash
   # SSH into staging Railway instance
   node scripts/add-staff-profile-columns.js
   node scripts/migrate-staff-from-airtable.js
   ```

3. **Test on Staging Environment:**
   - Verify all features work
   - Check National ID images persist
   - Test with real staff accounts

4. **Deploy to Production** (after user approval):
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```

5. **Run Migration on Production:**
   ```bash
   # SSH into production Railway instance
   node scripts/add-staff-profile-columns.js
   node scripts/migrate-staff-from-airtable.js
   ```

---

## Notes

- National ID images stored in `/app/data/staff-ids/` persist across deployments
- One-time migration script only needs to run once per environment
- Email changes trigger immediate logout for security
- Directory page excludes sensitive data (banking, home address, email)
- All database queries use service layer for consistency
