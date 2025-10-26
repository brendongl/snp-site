# Staff Profile and Directory Feature Design

**Date:** October 26, 2025
**Version:** 1.0
**Status:** Approved

## Overview

This document outlines the design for two new staff pages:
1. **Staff Profile Page** - Personal profile management with tabs for account info, activity log, and knowledge stats
2. **Staff Directory Page** - Read-only directory of all staff members with contact info and stats

## Goals

- Allow staff to view and edit their personal information
- Provide staff access to their activity history and game knowledge stats
- Create a staff directory for internal contact information
- Migrate all staff data from Airtable to PostgreSQL (no Airtable dependencies)
- Store National ID images in persistent volume

## Database Schema

### PostgreSQL `staff_list` Table Extension

```sql
ALTER TABLE staff_list ADD COLUMN IF NOT EXISTS
  -- Profile fields
  nickname VARCHAR(100),                    -- Default: last name from staff_name
  contact_ph VARCHAR(50),                   -- Zalo number
  bank_account_number VARCHAR(100),         -- Best-effort parsing from Airtable
  bank_name VARCHAR(100),                   -- Best-effort parsing from Airtable
  national_id_hash VARCHAR(64),             -- MD5 hash for file retrieval
  home_address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_ph VARCHAR(50),
  date_of_hire DATE,                        -- NULL initially, manual entry needed

  -- Metadata
  profile_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

### Existing Fields (for reference)
- `staff_id` (PK) - Airtable Staff table record ID
- `stafflist_id` - Airtable StaffList table record ID
- `staff_name` - Full name
- `staff_email` - Email (editable, triggers logout on change)
- `staff_type` - Type: Admin, Full-Time, Part-Time, Casual, etc.
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

### Field Editability

**Editable by Staff:**
- `nickname`
- `staff_email` (triggers logout on change)
- `contact_ph`
- `bank_account_number`
- `bank_name`
- `national_id_hash` (via file upload)
- `home_address`
- `emergency_contact_name`
- `emergency_contact_ph`

**Read-Only:**
- `staff_name`
- `staff_type`
- `date_of_hire`
- `created_at`
- `updated_at`

## File Storage

### National ID Images

**Location:** `/app/data/staff-ids/{hash}.jpg`

**Strategy:**
- Use MD5 hash-based deduplication (same as game images)
- Store hash in `staff_list.national_id_hash` column
- Only accessible to the staff member who owns it (or admins)
- Reference: [lib/storage/image-cache.ts](../../lib/storage/image-cache.ts)

## Service Layer

### New Service: `lib/services/staff-db-service.ts`

```typescript
interface StaffMember {
  staffId: string;
  stafflistId: string;
  name: string;
  nickname: string;
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
  profileUpdatedAt: string;
}

interface StaffProfileUpdate {
  nickname?: string;
  email?: string;
  contactPh?: string;
  bankAccountNumber?: string;
  bankName?: string;
  homeAddress?: string;
  emergencyContactName?: string;
  emergencyContactPh?: string;
}

interface StaffStats {
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
  // Get staff member by ID (for profile page)
  async getStaffById(staffId: string): Promise<StaffMember | null>

  // Get staff member by email (for login context)
  async getStaffByEmail(email: string): Promise<StaffMember | null>

  // Update staff profile (editable fields only)
  async updateStaffProfile(
    staffId: string,
    updates: StaffProfileUpdate
  ): Promise<boolean>

  // Get all staff (for directory)
  async getAllStaff(): Promise<StaffMember[]>

  // Get staff stats (knowledge counts, play logs, content checks)
  async getStaffStats(staffId: string): Promise<StaffStats>
}
```

## API Endpoints

### 1. GET `/api/staff/profile`
**Purpose:** Get current staff member's profile and stats

**Authentication:** Requires valid session

**Response:**
```json
{
  "profile": {
    "staffId": "rec...",
    "name": "Brendon Gan-Le",
    "nickname": "Gan-Le",
    "email": "brendonganle@gmail.com",
    "type": "Admin",
    "contactPh": "+84...",
    "bankAccountNumber": "...",
    "bankName": "...",
    "nationalIdHash": "abc123...",
    "homeAddress": "...",
    "emergencyContactName": "...",
    "emergencyContactPh": "...",
    "dateOfHire": "2024-01-01"
  },
  "stats": {
    "totalKnowledge": 150,
    "knowledgeByLevel": {
      "missing": 10,
      "beginner": 20,
      "intermediate": 50,
      "expert": 70
    },
    "canTeachCount": 45,
    "totalPlayLogs": 230,
    "totalContentChecks": 120
  }
}
```

### 2. PATCH `/api/staff/profile`
**Purpose:** Update staff profile

**Authentication:** Requires valid session

**Request Body:**
```json
{
  "nickname": "Brendon",
  "email": "newemail@example.com",
  "contactPh": "+84123456789",
  "homeAddress": "123 Main St"
}
```

**Response:**
```json
{
  "success": true,
  "emailChanged": true  // If email was changed
}
```

**Special Behavior:**
- If `email` is changed:
  - Update database
  - Destroy session
  - Return `{ emailChanged: true }`
  - Frontend redirects to login page

### 3. GET `/api/staff/directory`
**Purpose:** Get all staff members for directory

**Authentication:** Requires staff session

**Response:**
```json
{
  "staff": [
    {
      "staffId": "rec...",
      "name": "Brendon Gan-Le",
      "nickname": "Gan-Le",
      "contactPh": "+84...",
      "emergencyContactName": "...",
      "emergencyContactPh": "...",
      "dateOfHire": "2024-01-01",
      "stats": {
        "totalKnowledge": 150,
        "totalPlayLogs": 230,
        "totalContentChecks": 120
      }
    }
  ]
}
```

**Excludes:** Banking info, national ID, email, home address

### 4. POST `/api/staff/national-id/upload`
**Purpose:** Upload National ID image

**Authentication:** Requires staff session

**Request:** Multipart form data with image file

**Response:**
```json
{
  "success": true,
  "hash": "abc123def456..."
}
```

**Process:**
1. Validate file type (jpg, png, jpeg)
2. Validate file size (max 10MB)
3. Calculate MD5 hash
4. Save to `/app/data/staff-ids/{hash}.jpg`
5. Update `staff_list.national_id_hash`
6. Return hash

### 5. GET `/api/staff/national-id/[hash]`
**Purpose:** Serve National ID image

**Authentication:** Requires staff session

**Authorization:**
- Staff member can only view their own ID
- Admins can view all IDs

**Response:** Image file (JPEG/PNG)

## Page Structure

### Page 1: `/app/staff/profile/page.tsx` - My Profile

**Layout:** Tabbed interface with 3 tabs

#### Tab 1: Account Information
- Form with all profile fields
- Read-only fields displayed but disabled
- Editable fields with input components
- National ID image upload/display
- Save button at bottom
- Success/error toast notifications

**Fields:**
- Full Name (read-only display)
- Nickname (text input, placeholder shows default)
- Email (text input with warning about logout on change)
- Zalo Number (phone input)
- VND Banking - Account Number (text input)
- VND Banking - Bank Name (text input)
- National ID Card (image upload/display - only visible to owner)
- Emergency Contact Name (text input)
- Emergency Contact Number (phone input)
- Home Address (textarea)
- Date of Hire (read-only display)

#### Tab 2: My Activity
- Reuses existing changelog component/logic
- Filtered by current staff member's ID
- Shows: Date, action type, game name, details
- Paginated table (same as `/app/staff/changelog`)

#### Tab 3: My Knowledge
**Stats Cards:**
- Total games with knowledge: X
- Missing knowledge: Y games
- Beginner: Z games
- Intermediate: W games
- Expert: V games
- Can teach: T games

**Table:**
- Searchable/filterable game knowledge table
- Columns: Game name, confidence level, can teach, notes
- Links to game details
- Sortable by confidence level

---

### Page 2: `/app/staff/directory/page.tsx` - Staff Directory

**Layout:** Full-page table

**Features:**
- Search bar (filters by name or nickname)
- Sortable columns
- Read-only (no edit capability)

**Columns:**
1. Name (with nickname in parentheses if different)
2. Phone Number
3. Emergency Contact (name + number)
4. Date of Hire
5. Stats: Knowledge (X) | Play Logs (Y) | Checks (Z)

**Access Control:**
- Available to all staff members
- No sensitive data displayed (no banking, no national ID, no home address)

## Migration Strategy

### Script: `scripts/migrate-staff-data.js`

**Purpose:** One-time migration from Airtable to PostgreSQL

**Steps:**
1. Fetch all staff from Airtable Staff table (`tblLthDOTzCPbSdAA`)
2. For each staff member:
   - Extract last name from "Name" field for default nickname
   - Parse "Bank account" field (best-effort):
     - Try `:` separator (e.g., "Seabank: 000001032260")
     - Try `+` separator (e.g., "ACB + 6705041")
     - Try newline split (e.g., "MB bank \n0845022005")
     - Store original if parsing fails
   - Download National ID image from attachment URL
   - Calculate MD5 hash
   - Save image to `/app/data/staff-ids/{hash}.jpg`
   - Insert/update PostgreSQL `staff_list` table
3. Report success/failures with detailed log

**Error Handling:**
- Continue on individual staff failures
- Log all errors for manual review
- Report summary at end

## Data Flows

### Profile Update Flow

```
User edits profile → Click Save
  ↓
PATCH /api/staff/profile
  ↓
Validate session (must be logged in)
  ↓
Validate staff can only edit their own profile
  ↓
If email changed:
  - Update database
  - Update staff_list.updated_at
  - Destroy session (logout)
  - Return { success: true, emailChanged: true }
  - Frontend: Show message, redirect to login
  ↓
If other fields changed:
  - Update database
  - Update staff_list.profile_updated_at
  - Return { success: true }
  - Show success toast notification
```

### National ID Upload Flow

```
User clicks "Upload National ID"
  ↓
File picker dialog (accept: image/*)
  ↓
POST /api/staff/national-id/upload (multipart/form-data)
  ↓
Server validation:
  - Check file type (jpg, png, jpeg)
  - Check file size (max 10MB)
  - Validate session
  ↓
Process image:
  - Calculate MD5 hash
  - Save to /app/data/staff-ids/{hash}.jpg
  - Update staff_list.national_id_hash
  - Update staff_list.profile_updated_at
  ↓
Return { success: true, hash: "..." }
  ↓
Frontend: Display uploaded image
```

### Directory Page Load Flow

```
Navigate to /staff/directory
  ↓
GET /api/staff/directory
  ↓
Validate session (staff only)
  ↓
Query PostgreSQL:
  - SELECT all staff with public fields
  - JOIN with stats queries:
    - COUNT knowledge records
    - COUNT play logs
    - COUNT content checks
  ↓
Return staff array with stats
  ↓
Frontend: Render searchable table
```

## Component Breakdown

### New Components

1. **`components/features/staff/StaffProfileForm.tsx`**
   - Profile edit form with validation
   - Handles save and email change logic
   - File upload for National ID

2. **`components/features/staff/StaffActivityLog.tsx`**
   - Reuses changelog service filtered by staff ID
   - Paginated table component

3. **`components/features/staff/StaffKnowledgeStats.tsx`**
   - Stats cards display
   - Knowledge table with filters

4. **`components/features/staff/StaffDirectoryTable.tsx`**
   - Searchable/sortable table
   - Staff directory display

## Security Considerations

1. **Authorization:**
   - Staff can only edit their own profile
   - Staff can only view their own National ID
   - Admins can view all National IDs
   - Directory excludes sensitive data (banking, home address)

2. **File Upload Security:**
   - Validate file types (whitelist: jpg, png, jpeg)
   - Validate file size (max 10MB)
   - Use hash-based storage (prevents path traversal)
   - Serve files through API endpoint (not direct file access)

3. **Email Change Protection:**
   - Immediate logout on email change
   - Prevents session hijacking with old email

4. **Input Validation:**
   - Sanitize all text inputs
   - Validate email format
   - Validate phone number format

## Testing Checklist

- [ ] Migration script successfully imports all staff from Airtable
- [ ] National ID images stored in persistent volume
- [ ] Profile page loads with correct data
- [ ] Profile editing saves correctly
- [ ] Email change triggers logout
- [ ] National ID upload works
- [ ] National ID viewing restricted to owner/admin
- [ ] Activity log filtered correctly
- [ ] Knowledge stats calculated accurately
- [ ] Directory shows all staff with correct stats
- [ ] Directory search/sort works
- [ ] Authorization prevents unauthorized access

## Future Enhancements

1. **Points System:**
   - Add points display to profile page (Tab 1)
   - Integrate with future points calculation system

2. **Profile Photos:**
   - Add optional profile photo upload
   - Display in directory and profile

3. **Advanced Directory Filters:**
   - Filter by staff type
   - Filter by hire date range
   - Filter by knowledge level

4. **Audit Log:**
   - Track all profile changes
   - Show history of edits

## References

- Existing service pattern: [lib/services/games-db-service.ts](../../lib/services/games-db-service.ts)
- Image storage pattern: [lib/storage/image-cache.ts](../../lib/storage/image-cache.ts)
- Airtable schema: [docs/AIRTABLE_SCHEMA.md](../AIRTABLE_SCHEMA.md)
- Database migration example: [scripts/migrate-content-checks.js](../../scripts/migrate-content-checks.js)
