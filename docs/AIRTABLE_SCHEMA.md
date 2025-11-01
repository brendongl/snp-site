# Airtable Base Schema Reference

> **⚠️ IMPORTANT**: This is **reference documentation only**. The application now uses **PostgreSQL as the primary database**. Airtable is only used for:
> - Staff table sync (read-only, for authentication)
> - Backfill operations during migration
>
> For current implementation details, see [POSTGRESQL_MIGRATION_SUMMARY.md](./POSTGRESQL_MIGRATION_SUMMARY.md) and [DATABASE_SERVICES_USAGE.md](./DATABASE_SERVICES_USAGE.md).

This document provides a reference for the original Airtable base schema that the PostgreSQL database mirrors.

## Base Information
- **Base ID**: `apppFvSDh2JBc0qAu`
- **Table ID**: `tblIuIJN5q3W6oXNr`
- **Table Name**: "BG List"
- **View ID (Default)**: `viwRxfowOlqk8LkAd` (BG View [DO NOT EDIT FILTER])

## Key Fields

### Text Fields
- **Game Name** (`fldQoGwQ2vxCYej4B`): `singleLineText` - Primary game name
- **Description** (`fldghJOR5jrxWXMll`): `multilineText` - Game description
- **bggID** (`fldNlLrLijKKUxxoY`): `singleLineText` - BoardGameGeek ID reference
- **Additional Notes** (`fldXEK5sEsJS09yMs`): `multilineText` - General notes

### Player Count Fields (SINGLE SELECT - DROPDOWNS!)
- **Min Players** (`fldCJO7IItEMkw3Q1`): `singleSelect`
  - Options: "1", "2", "3", "4", "5", "6"
  - **NOTE**: This is a dropdown, NOT a number field!

- **Max. Players** (`fldtxMNTZiTOw1QnF`): `singleSelect`
  - Options: "2", "3", "4", "5", "6", "7", "8", "10", "12", "16", "17", "20", "No Limit"
  - **NOTE**: This is a dropdown, NOT a number field!

- **Best Player Amount** (`fldqXEWvrhNTSYdn7`): `singleSelect`
  - Options: "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"

### Numeric/Rating Fields
- **Year Released** (`fldSIQm1lJ4CKQzTC`): `number` (precision: 0)
- **Complexity** (`fld630lmMEzhQncb5`): `rating` (1-5 stars, icon: star, color: yellowBright)
  - 1 = Easy, non-gamer level
  - 5 = As hard as it gets
- **SNP Popularity** (`fldarhB3Lu7ZZBBj9`): `rating` (1-5 stars, icon: star, color: yellowBright)

### Financial Fields
- **Cost Price** (`fldgJ1oSswF4vPbxy`): `currency` (₫, precision: 0)
- **Deposit** (`fldjmODcB6LlOyLlj`): `currency` (₫, precision: 0)
- **Game Size (Rental)** (`fldU1Abiw26POnZPq`): `singleSelect` - Options: "1", "2", "3", "4", "5"

### Formula Fields (Rental Prices - READ ONLY)
- **Rent (8h)** (`fldsCiKUtfPjzNiQC`): `formula` → `currency`
- **Rent (24h)** (`fldZMEiPkjqCbxAOA`): `formula` → `currency`
- **Rent (3 days)** (`fldV4n02w9I3Wx2Bp`): `formula` → `currency`
- **Rent (7 days)** (`fldzZRWwDyNIXtiw6`): `formula` → `currency`

### Multi-Select Fields
- **Categories** (`fld8V3aPvhXjU9V7W`): `multipleSelects` - 130+ options including:
  - Abstract, Action, Adventure, Animal, Card Game, Co-Op, Deduction, Dice Rolling
  - Economic, Exploration, Family, Fantasy, Fighting, Horror, Party, Puzzle
  - Strategy, Trading, Trivia, Word Game, Worker Placement, etc.

- **Mechanisms** (`fldW098tP8jgfmmCr`): `multipleSelects` - 200+ options including:
  - Action Points, Area Majority, Auction/Bidding, Card Drafting, Cooperative Game
  - Deck Building, Deduction, Dice Rolling, Hand Management, Pattern Building
  - Set Collection, Tile Placement, Trading, Trick-taking, Variable Player Powers
  - Worker Placement, etc.

- **Age Tag** (`fldfrDSrjIdtRYbpa`): `multipleSelects`
  - Options: "All Ages", "4-8+", "8-13+", "13+", "Adults Only NSFW"

### Date Fields
- **Date of Aquisition** (`fld0GUFZwXTzeuxOt`): `date` (format: friendly/LL)
- **Last Content Check** (`fldmrut1p5mldrsVa`): `date` (format: local/l)
- **Created** (`fldaQKQ1087Qyg3JJ`): `createdTime` (format: local/l)
- **Last Modified** (`fld4QpBEPHms2Pi90`): `lastModifiedTime`

### Attachment Fields
- **Images** (`fld517EcXXImq5rW9`): `multipleAttachments` - Main game images
- **Photos** (`fldunJnQOeCY9LRF1`): `multipleAttachments` - Additional photos

### Boolean/Checkbox Fields
- **Expansion** (`fld7IdzKCSifXEqz0`): `checkbox` - Is this an expansion?
- **Sleeved** (`fldPebzeYdR8gx09c`): `checkbox` - Are cards sleeved?
- **Box Wrapped** (`fld3rq72Ibu5icKOj`): `checkbox` - Is box wrapped?

### Content Check Fields (Linked/Lookup/Rollup)
- **Content Check Log** (`fldV3hoZyn20Un0d6`): `multipleRecordLinks` → Content Check table
- **Latest Check Status** (`fldBWCPq3GGqfXBRd`): `multipleLookupValues`
  - Options: "Perfect Condition", "Minor Issues", "Major Issues", "Unplayable"
- **Latest Check Date** (`fldTJ3G5XKEpZg0ze`): `rollup` from Content Check Log
- **Latest Check Notes** (`fldIzhXD3I9a9a61I`): `multipleLookupValues` from Content Check Log
- **Total Checks** (`fldkSFaXnZadQxBkq`): `count` of Content Check Log records

### Relationship Fields
- **Game Expansions Link** (`fldfl8oHAtSJWO2NP`): `multipleRecordLinks` → BG List (expansions of this game)
- **Base Game** (`fldwGGcdHomr8UT2V`): `multipleRecordLinks` → BG List (if this is an expansion)
- **ContentsChecker** (`fld3dNYgXkJbTF0Bv`): `multipleRecordLinks` → Content Checkers table

### Other Fields
- **Last Modified By** (`fldvPncoHg6eP0JRQ`): `lastModifiedBy`
- **Content-Check Notes/Name** (`fldkxqxs2FeDnZr6X`): `singleLineText` - Legacy field
- **RentalsData** (`fldVJtxPnDSb6mrEH`): `singleLineText` - Legacy field

## Available Views
1. **BG Gallery SHARED DO NOT EDIT** (`viwUp2KUiPMYF8FWg`) - Gallery view
2. **BG Gallery copy** (`viwMn9CZKVyYtuvcI`) - Gallery view
3. **BG Rental** (`viwDz5cAQ4gZak5d5`) - Gallery view
4. **BG View [DO NOT EDIT FILTER]** (`viwRxfowOlqk8LkAd`) - Grid view (default)
5. **BG View copy** (`viwZkWTqrVHmTnYVQ`) - Grid view
6. **claudeview** (`viw75e7ZqtCCH7wVW`) - Grid view
7. **BGContentsneverChecked** (`viwgUFQslwbgtJ65G`) - Grid view
8. **BG Rental View** (`viwbb3XMZhTUOhp9c`) - Grid view
9. **Grid view** (`viwRxfowOlqk8LkAd`) - Grid view
10. **Grid view copy** (`viwkHYO2qdp3nP0Nc`) - Grid view

## Important Notes

### Player Count Field Types
**CRITICAL**: Min Players, Max Players, and Best Player Amount are all `singleSelect` fields (dropdowns), NOT number fields!

This means:
- Values are strings, not numbers: "2", "3", "4", etc.
- When filtering, you must compare strings: `game.fields['Min Players'] === "2"`
- UI components should use dropdowns/selects, NOT number inputs
- When querying Airtable, use the exact string values from the choices

### TypeScript Type Mapping
```typescript
interface BoardGame {
  fields: {
    'Game Name': string;
    'Min Players'?: string;  // NOT number! → "1", "2", "3", "4", "5", "6"
    'Max. Players'?: string; // NOT number! → "2", "3", ..., "No Limit"
    'Best Player Amount'?: string; // NOT number! → "1", "2", ..., "11"
    'Year Released'?: number;
    'Complexity'?: number; // 1-5
    'SNP Popularity'?: number; // 1-5
    Categories?: string[];
    Mechanisms?: string[];
    'Age Tag'?: string;
    Description?: string;
    // ... other fields
  }
}
```

## Last Updated
Generated: 2025-10-16

## Sip N Play Base - Staff Table

### Base Information
- **Base ID**: `appjD3LJhXYjp0tXm`
- **Base Name**: "Sip N Play"
- **Table ID**: `tblLthDOTzCPbSdAA`
- **Table Name**: "Staff"

### Key Fields for Authentication

#### Email
- **Field ID**: `fld4SyFL1xB27u4rQ`
- **Type**: `email`
- **Purpose**: Used to match login credentials
- **Required**: Yes

#### Type (CRITICAL FOR ADMIN DETECTION)
- **Field ID**: `fldr6YlEuDLksBHIW`
- **Type**: `singleSelect`
- **Purpose**: Determines if user is Admin or Staff
- **Options** (choices):
  - `Part-Time` (yellowLight1)
  - `Full-Time` (greenLight1)
  - `Casual` (tealLight2)
  - `Assistant` (cyanDark1)
  - `Terminated` (redBright)
  - `Probation` (grayLight2)
  - **`Admin` (redLight1)** ← **THIS DETERMINES ADMIN ACCESS**

### Other Staff Fields
- **Name** (`fld5qB1HlvUNNxn2z`): `singleLineText` - Staff member name
- **Active** (`fldB0Oi1D2lTo2Ghv`): `checkbox` - Is staff currently active
- **Contract sent** (`fldu9GsyKufJNq018`): `checkbox` - Has contract been sent
- **Has 🔑** (`fld6WY1bIvMFpUwHR`): `checkbox` - Has keys
- **Roles** (`fld8zDf7Dgj3v8SVa`): `multipleSelects` - Staff roles
  - Options: Boss, Game Master, Counterhand, Marketting
- **Contact Ph** (`fldFNKKpgdoJMDDde`): `singleLineText`
- **Date of Hire** (`fldXyJWlpe2j7QmX2`): `date` (format: local/l)
- **Bank account** (`fld1q0rHShcBUtOOX`): `multilineText`
- **Home Address** (`fld1WrzU93umQdgGc`): `multilineText`
- **Emergency Contact Name** (`fldBcGt2pKCoApBSU`): `singleLineText`
- **Emergency Contact Ph No** (`fldGVszTgZEhOtxvZ`): `singleLineText`

### Relationship/Link Fields
- **staffeval** (`fldOeSxagBo3JuKCk`): `multipleRecordLinks` → Staff Evaluation records
- **CashFlow** (`fldmXRqy5Feptw41y`): `multipleRecordLinks` → CashFlow records
- **CommisionsTable** (`fldpzEzYbGDpEPM07`): `multipleRecordLinks` → Commission records

### Authentication Logic

When a user logs in with their email:

1. Query Airtable Staff table where `Email == user_email`
2. Retrieve the record and read the **`Type`** field
3. Check the Type value:
   - **If Type == "Admin"** → Set `staff_type: "Admin"` in localStorage
   - **Otherwise** → Set `staff_type: "Staff"` in localStorage
4. Admin features are only visible when `staff_type === "Admin"`

### Example TypeScript Interface

```typescript
interface StaffMember {
  id: string;
  name: string;
  email: string;
  type: "Admin" | "Full-Time" | "Part-Time" | "Casual" | "Assistant" | "Probation" | "Terminated";
  active: boolean;
  roles?: string[];
  dateOfHire?: string;
}
```

## Important: Staff Table vs StaffList Table

**CRITICAL ARCHITECTURE NOTE**: Airtable cannot create linked records between different bases. Therefore:

- **Staff Table** (`tblLthDOTzCPbSdAA`) lives in **Sip N Play base** (`appjD3LJhXYjp0tXm`)
  - Used for: Authentication (checking email, Type field for admin detection)
  - When to use: Sign-in process, verifying user credentials

- **StaffList Table** (`tblGIyQNmhcsK4Qlg`) lives in **SNP Games List base** (`apppFvSDh2JBc0qAu`)
  - Used for: Linked records in Play Logs "Logged By" field
  - This is a synced table (mirrors data from Sip N Play Staff table)
  - When to use: For any Airtable linkages within SNP Games List base

**Example Flow (LEGACY - PostgreSQL now uses single UUID)**:
1. User signs in with email → Query **Staff table** (Sip N Play base) for authentication
2. Get the user's Airtable record ID from **Staff table**
3. Also fetch the same user's record ID from **StaffList table** (SNP Games List base)
4. ~~Store both IDs in localStorage: `staff_id` (for auth info) and `staff_record_id` (for Play Logs linking)~~ **DEPRECATED**
5. ~~When creating Play Log → Use `staff_record_id` (from StaffList) for the "Logged By" link~~ **DEPRECATED**

**CURRENT IMPLEMENTATION (v1.19.0+)**:
- PostgreSQL uses a single UUID primary key (`id`) in the `staff_list` table
- Only `staff_id` is stored in localStorage (contains the UUID)
- All staff-related operations use this single UUID field
- See [POSTGRESQL_MIGRATION_SUMMARY.md](./POSTGRESQL_MIGRATION_SUMMARY.md) for migration details

## SNP Games List Base - Play Logs Table

### Base Information
- **Base ID**: `apppFvSDh2JBc0qAu` (SNP Games List)
- **Table ID**: `tblggfqeM2zQaDUEI`
- **Table Name**: "Play Logs"

### Key Fields

#### Linked Record Fields (for creating relations)
- **Game** (`fldbpBouq2IK7OOZb`): `multipleRecordLinks` → BG List table
  - Stores the game that was played
  - When creating a record: Pass array of game IDs: `[gameId]`

- **Logged By** (`fldWXUcDBFcIiVzbL`): `multipleRecordLinks` → StaffList table (SNP Games List base)
  - Stores which staff member logged the play session
  - **IMPORTANT**: Uses StaffList record IDs from SNP Games List base, NOT Staff IDs from Sip N Play base
  - When creating a record: Pass array of StaffList record IDs: `[staffListRecordId]`

#### Date/Time Field
- **Session Date** (`fldpVByTZBkdjD6fJ`): `dateTime` (format: local/l, time: 12hour/h:mma)
  - When the game was played
  - Must be ISO 8601 format when POSTing to Airtable

#### Text Field
- **Notes** (`fldVWpXwr60JyRIF8`): `multilineText`
  - Optional notes about the play session

#### Auto-Generated Field
- **Play Log Entry** (`fldWe3lnHqEpZAjF5`): `autoNumber` - READ ONLY
  - Auto-generated unique ID for each play log entry

### Creating a Play Log Record

**Endpoint**: `POST https://api.airtable.com/v0/apppFvSDh2JBc0qAu/tblggfqeM2zQaDUEI`

**Payload**:
```json
{
  "records": [
    {
      "fields": {
        "Game": ["recXXXXXXXXXXXXXX"],     // Array with game ID from BG List
        "Logged By": ["recYYYYYYYYYYYYYY"],  // Array with staff record ID from Sip N Play Staff table
        "Session Date": "2025-10-20T12:00:00.000Z",  // ISO 8601 format
        "Notes": "Optional notes here"      // Optional
      }
    }
  ]
}
```

### Important Notes
- Play Logs table is in the **SNP Games List base** (`apppFvSDh2JBc0qAu`), NOT Sip N Play base
- Linked record fields require arrays even if only one ID: `["recXXX"]`, not `"recXXX"`
- Game IDs come from BG List table (`tblIuIJN5q3W6oXNr`)
- Staff record IDs for "Logged By" come from **StaffList** table (`tblGIyQNmhcsK4Qlg` in same SNP Games List base)
- **DO NOT** use Staff table IDs from Sip N Play base - they will cause "Record ID does not exist" errors

## SNP Games List Base - StaffList Table

### Base Information
- **Base ID**: `apppFvSDh2JBc0qAu` (SNP Games List)
- **Table ID**: `tblGIyQNmhcsK4Qlg`
- **Table Name**: "StaffList"
- **Type**: Synced table (mirrors Sip N Play Staff table)

### Purpose
Synced copy of the Staff table from Sip N Play base. Exists in SNP Games List base to enable:
- Linked records in Play Logs "Logged By" field (within same base)
- Lookups of staff information for games-related features

### Key Fields
Same fields as original **Sip N Play Staff table** (synced automatically):
- **Email** - For matching/filtering
- **Name** - Staff member name
- **Type** - Single-select field (Admin, Full-Time, Part-Time, Casual, Assistant, Probation, Terminated)
- Other fields synced from original Staff table

### When to Use
- Use **Staff Table** (`tblLthDOTzCPbSdAA` in Sip N Play base) for: Authentication, checking Type field, user verification
- Use **StaffList Table** (`tblGIyQNmhcsK4Qlg` in SNP Games List base) for: Linked records in Play Logs, any Airtable relationships within SNP Games List base

## SNP Games List Base - Staff Game Knowledge Table

### Base Information
- **Base ID**: `apppFvSDh2JBc0qAu` (SNP Games List)
- **Table ID**: `tblgdqR2DTAcjVFBd`
- **Table Name**: "Staff Game Knowledge"

### Purpose
Tracks which staff members have expertise or knowledge about specific games. Used for the "Add Knowledge" feature where staff can mark games they are instructors/experts in.

### Key Fields
- **Staff Member**: Links to StaffList table (for same-base relationships)
- **Game**: Links to BG List table
- **Confidence Level**: Single-select field indicating expertise level

## References
- Airtable API: https://airtable.com/developers/web/api/introduction
- **SNP Games List Base ID**: `apppFvSDh2JBc0qAu`
  - BG List Table: `tblIuIJN5q3W6oXNr`
  - Play Logs Table: `tblggfqeM2zQaDUEI`
  - StaffList Table: `tblGIyQNmhcsK4Qlg` (synced from Sip N Play Staff)
  - Staff Game Knowledge Table: `tblgdqR2DTAcjVFBd` ✓ IN THIS BASE
  - Content Check Log Table: `tblHWhNrHc9r3u42Q`
- **Sip N Play Base ID**: `appjD3LJhXYjp0tXm`
  - Staff Table: `tblLthDOTzCPbSdAA` (with Admin Type field, original source)
