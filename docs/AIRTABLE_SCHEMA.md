# Airtable Base Schema Reference

This document provides a reference for the Airtable base schema for the SNP Board Games catalog.

## Base Information
- **Base ID**: `apppFvSDh2JBc0qAu`
- **Table ID**: `tblIuIJN5q3W6oXNr`
- **Table Name**: "BG List"
- **View ID (Default)**: `viwHMUIuvp0H2S1vE` (BG View [DO NOT EDIT FILTER])

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
4. **BG View [DO NOT EDIT FILTER]** (`viwHMUIuvp0H2S1vE`) - Grid view (default)
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

## References
- Airtable API: https://airtable.com/developers/web/api/introduction
- Base ID: apppFvSDh2JBc0qAu
- Table ID: tblIuIJN5q3W6oXNr
