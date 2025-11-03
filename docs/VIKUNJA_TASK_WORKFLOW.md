# Vikunja Task Management Workflow

**Last Updated**: January 30, 2025
**Task Manager URL**: https://tasks.sipnplay.cafe

---

## Overview

Sip N Play uses Vikunja for staff task management with a gamified points system. Tasks appear on the Staff Dashboard when they are due today or overdue.

### ⚠️ Known Issue: Add Task Button Not Working

**Current Status**: The "+ Add Task" button in Vikunja UI is greyed out due to a frontend bug in v1.0.0-rc2.

**Workarounds Available**:
- **Press `Ctrl+K`** and type "new task" (fastest method)
- **Use CLI script**: `node scripts/add-vikunja-task.js` (most features)

**📖 Full workaround documentation**: [VIKUNJA_WORKAROUNDS.md](VIKUNJA_WORKAROUNDS.md)

---

## For Staff: How to Propose Tasks

### Step 1: Access Vikunja
1. Go to https://tasks.sipnplay.cafe
2. Log in with your staff credentials

### Step 2: Create a New Task

**⚠️ If "+ Add Task" button is greyed out**: Press `Ctrl+K` and type "new task" instead

1. Navigate to the **Staff Tasks** project
2. **Option A**: Click **"+ Add Task"** (if button is working)
3. **Option B**: Press **`Ctrl+K`** → type "new task" (if button is greyed out)
4. Fill in task details:
   - **Title**: Clear, concise task name (e.g., "Clean G1 Retail shelf")
   - **Description**: Detailed instructions or notes (optional but recommended)
   - **Due Date**: When should this be completed?
   - **Assignee**: Assign to yourself or leave unassigned for admin review

### Step 3: Submit for Review
- **DO NOT** add point labels (points:100, points:500, etc.) - Only admins can assign points
- Click **"Create Task"**
- Admin will review and assign appropriate point value based on task complexity

### What Happens Next
1. Admin reviews your proposed task
2. Admin assigns a point label (100-50,000 points)
3. Task appears on Staff Dashboard when due date approaches
4. Complete task in Vikunja to earn points

---

## For Admins: Assigning Point Values

### Point Value Scale

| Points | Color | Description | Examples |
|--------|-------|-------------|----------|
| **100** | Light Green | Simple quick task (5-15 min) | Check inventory, water plants |
| **200** | Green | Minor task (15-30 min) | Clean small area, restock shelves |
| **500** | Blue | Standard task (30-60 min) | Deep clean station, organize storage |
| **1000** | Bright Blue | Medium effort task (1-2 hours) | Full shelf reorganization, equipment maintenance |
| **5000** | Purple | Major task (half day) | Deep clean entire floor, major reorganization |
| **10000** | Dark Purple | Large project (full day) | Complete inventory audit, major renovation |
| **20000** | Orange | Major project (2-3 days) | Store-wide reorganization, system implementation |
| **50000** | Red-Orange | Epic achievement (1+ week) | Complete overhaul, major milestone completion |

### How to Assign Points
1. Review the proposed task in Vikunja
2. Assess complexity, time required, and impact
3. Click on the task to open details
4. Click **"Labels"** dropdown
5. Search for **"points:"** and select appropriate value
6. Only ONE point label per task
7. Task will now display with points on Staff Dashboard when due

### Point Assignment Guidelines
- **Consider time required**: How long will this realistically take?
- **Consider skill level**: Does this require specialized knowledge?
- **Consider impact**: How important is this task to operations?
- **Be consistent**: Similar tasks should have similar point values
- **Round up for complexity**: If uncertain, assign higher value

---

## Dashboard Display

Tasks appear on the Staff Dashboard (https://sipnplay.cafe/staff/dashboard) when they are:
- **Due Today** - Orange indicator with clock icon
- **Overdue** - Red indicator with alert icon

### Dashboard Features
- **Point Badges**: Color-coded based on task value
- **Due Date**: Shows formatted due time
- **Task Description**: First 2 lines visible
- **Quick Link**: Opens full task manager

---

## Workflow Example

### Example 1: Staff Proposes Cleaning Task

**Staff Action:**
1. Creates task: "Deep clean popcorn machine"
2. Description: "Read note: includes filter replacement and exterior polish"
3. Due date: November 2, 2025
4. Submits without point label

**Admin Action:**
1. Reviews task
2. Estimates 1 hour of work
3. Assigns **points:1000** label
4. Task is now worth 1000 points

**Result:**
- Task appears on dashboard November 2
- Shows "1000 pts" blue badge
- Staff completes task and earns 1000 points

### Example 2: Recurring Weekly Task

**Staff Action:**
1. Creates task: "Sweep G2 stair"
2. Due date: Every Monday
3. Submits for review

**Admin Action:**
1. Assigns **points:200** (15-20 min task)
2. Sets recurring: Weekly on Monday

**Result:**
- Task appears every Monday on dashboard
- Staff earns 200 points per completion
- Builds consistent routine

---

## Best Practices

### For Staff
- ✅ Be specific in task titles
- ✅ Add detailed descriptions for complex tasks
- ✅ Set realistic due dates
- ✅ Check dashboard daily for priority tasks
- ❌ Don't create duplicate tasks
- ❌ Don't assign point labels yourself

### For Admins
- ✅ Review proposed tasks within 24 hours
- ✅ Use consistent point values across similar tasks
- ✅ Add notes explaining point assignment if unclear
- ✅ Monitor dashboard to ensure tasks are balanced
- ❌ Don't change points after assignment (creates confusion)
- ❌ Don't assign points without reviewing task details

---

## Troubleshooting

### "+ Add Task" button is greyed out or not working?
**Known Issue**: This is a frontend bug in Vikunja v1.0.0-rc2

**Workarounds**:
1. **Keyboard Shortcut** (fastest): Press `Ctrl+K` → type "new task"
2. **CLI Script** (most features): Run `node scripts/add-vikunja-task.js`

**See full documentation**: [VIKUNJA_WORKAROUNDS.md](VIKUNJA_WORKAROUNDS.md)

### Task not showing on dashboard?
- Check if task has due date set
- Check if task is marked complete
- Verify task is in "Staff Tasks" project (ID: 2) or "Sip n Play" project
- Refresh dashboard page

### Can't see point labels in dropdown?
- Only admins have access to assign labels
- Labels are created in Vikunja settings
- Contact admin if labels are missing

### Task appears on wrong date?
- Check due date timezone settings
- Verify due date is set correctly
- Tasks appear when due date is today or past

---

## Integration with Staff Dashboard

The Staff Dashboard at https://sipnplay.cafe/staff/dashboard shows:
- **Quick Stats**: Games needing check, play logs, knowledge gaps
- **Games Needing Attention**: Issues reported on games (red section)
- **Today's Tasks**: Vikunja tasks due today/overdue (orange section)
- **Priority Actions**: Game checks needed (default section)
- **Recent Activity**: Latest staff actions

Tasks from Vikunja integrate seamlessly with existing staff workflows.

---

## Technical Details

### API Integration
- Endpoint: `/api/vikunja/tasks/priority`
- Returns tasks that are `!done AND (overdue OR due_today)`
- Sorts overdue first, then by due date
- Extracts points from labels with `points:` prefix

### Point Label Format
- Label title must be exactly: `points:500` (no spaces)
- Numeric value after colon is extracted
- Invalid formats return 0 points
- Multiple point labels on same task: only first is used

### Environment Variables
```bash
VIKUNJA_API_URL=https://tasks.sipnplay.cafe/api/v1
VIKUNJA_API_TOKEN=tk_your_vikunja_api_token_here
```

---

## Questions or Issues?

Contact your admin or check:
- Vikunja documentation: https://vikunja.io/docs/
- Staff Dashboard help section
- Internal communications channel
