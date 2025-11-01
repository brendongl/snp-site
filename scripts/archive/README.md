# Archived Scripts

This directory contains scripts that are no longer actively used in production but are kept for historical reference.

## Archive Date
**January 30, 2025 (v1.19.0)**

## Reason for Archival
After the UUID migration in v1.19.0, many diagnostic and verification scripts that referenced the old dual-ID system (`staff_id` + `stafflist_id`) are no longer relevant. The codebase now uses a single UUID primary key (`id`) for all staff operations.

## Categories

### Old Dual-ID System Diagnostics
Scripts that were used to diagnose issues with the old staff ID architecture:
- `diagnose-staff-data-issues.js` - Diagnosed dual-ID inconsistencies
- `check-content-checks-data.js` - Verified content check data with old ID system
- `check-play-logs-data.js` - Verified play logs data with old ID system
- `check-staff-knowledge-data.js` - Verified staff knowledge data with old ID system
- `verify-inspector-display.js` - Verified inspector names with old ID system
- `verify-inspector-names.js` - Verified inspector ID mapping
- `backfill-content-check-inspectors-from-csv.js` - One-time backfill operation

### One-Time Fixes
Scripts that fixed specific issues and are no longer needed:
- `delete-duplicate-content-checks.js` - Removed duplicate records (completed)
- `verify-all-fixes.js` - Verified fixes for old system issues

## Important Notes

- **Do not delete these scripts** - they provide historical context for database evolution
- If you need to understand how the old dual-ID system worked, refer to these files
- For current implementation, see `migrate-staff-to-uuid.js` in the main scripts directory

## Current Staff ID Implementation (v1.19.0+)

- Single UUID primary key: `staff_list.id`
- localStorage key: `staff_id` (contains UUID)
- All foreign keys reference this single UUID field
- See documentation: `docs/DATABASE_SERVICES_USAGE.md`
