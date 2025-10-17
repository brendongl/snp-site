# Airtable Manual Configuration Required

## Fields to Add to BG List Table

The following fields need to be added manually to the **BG List** table in Airtable, as the MCP API doesn't support creating rollup/lookup fields programmatically.

### 1. All Content Checks (Link Field)
- **Field Name**: `All Content Checks`
- **Field Type**: Link to another record
- **Linked Table**: `Content Check Log`
- **Configuration**:
  - Allow linking to multiple records: ✓
  - Link will appear in Content Check Log as: `Board Game`

### 2. Latest Check Date (Rollup)
- **Field Name**: `Latest Check Date`
- **Field Type**: Rollup
- **Configuration**:
  - Look up field: Select `All Content Checks` → `Check Date`
  - Aggregation function: `MAX(values)`
  - Result type: Date

### 3. Latest Check Status (Lookup)
- **Field Name**: `Latest Check Status`
- **Field Type**: Lookup
- **Configuration**:
  - Look up records: `All Content Checks`
  - Look up field: `Status`
  - Note: This will show all statuses, but in the UI we'll filter to show only the latest

### 4. Latest Check Notes (Lookup)
- **Field Name**: `Latest Check Notes`
- **Field Type**: Lookup
- **Configuration**:
  - Look up records: `All Content Checks`
  - Look up field: `Notes`

### 5. Total Checks (Count)
- **Field Name**: `Total Checks`
- **Field Type**: Count
- **Configuration**:
  - Count records from: `All Content Checks`

## Alternative: Use Existing Link Field

I noticed the BG List table already has a field called **`ContentsChecker`** that links to the old ContentsChecker table. You can either:

1. **Option A**: Keep the old link and add the new `All Content Checks` link field
2. **Option B**: Rename `ContentsChecker` to `Old Content Checks` and create `All Content Checks` as the new primary link

I recommend **Option A** to preserve the historical data relationship.

## After Adding These Fields

Once you've added the fields manually in Airtable:
1. Run the migration script: `npm run migrate:content-checks`
2. The rollups and lookups will automatically populate based on the migrated data
3. Verify the data looks correct in Airtable
4. Let me know to continue with the code implementation

## Status

- ✅ Content Check Log table created via MCP
- ⏳ Manual fields needed in BG List (you need to add)
- ⏳ Migration script ready to run (after manual fields)
