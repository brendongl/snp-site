# Vikunja Task Creation Workarounds

**Issue**: The "+ ADD" button in Vikunja UI is greyed out/non-functional due to a known bug in v1.0.0-rc2/unstable.

**Error Message**: "can't access property 'insertBefore', t is null"

**Root Cause**: Frontend JavaScript bug in Vikunja v1.0.0-rc2 causing permission state loss. GitHub Issue: [#142](https://github.com/go-vikunja/vikunja/issues/142)

**Status**: Known bug, closed as "Not Planned" by Vikunja developers. Waiting for v1.0.0 stable release.

---

## ✅ Working Solutions

### Method 1: Keyboard Shortcut (Fastest)

**Best for**: Quick task creation

1. Press **`Ctrl+K`** anywhere in Vikunja
2. Type "new task" in the search box
3. Fill in task details:
   - Title
   - Project (select from dropdown)
   - Due date (optional)
4. Press Enter to create

**Pros**: Very fast, works every time
**Cons**: Limited options (can't set points or detailed descriptions easily)

---

### Method 2: CLI Script (Most Powerful)

**Best for**: Tasks with descriptions, due dates, and points

**From project root directory**:

```bash
node scripts/add-vikunja-task.js
```

**Or with command-line arguments**:

```bash
# Quick task creation
node scripts/add-vikunja-task.js --title "Fix broken widget" --project 2

# Interactive mode (prompts for all details)
node scripts/add-vikunja-task.js
```

**Interactive prompts**:
1. **Task title**: Enter task name
2. **Project**: Select from list (default: 2 = "Sip n Play")
3. **Description**: Optional detailed description
4. **Due date**: Optional (format: YYYY-MM-DD)
5. **Points**: Optional (100, 200, 500, 1000, 5000, 10000, 20000, 50000)

**Example Output**:
```
🎯 Vikunja Task Creator (CLI Workaround)
==================================================

📝 Task title: Fix the spinner widget
📁 Available projects:
   1. Inbox
   2. Sip n Play
   3. Cleaning
   ...

Project ID [2 for Sip n Play]: 2
📄 Description (optional): The spinner on the games page is broken
📅 Due date (YYYY-MM-DD, optional): 2025-01-31

💎 Add points? (y/n) [n]: y

Available point values:
   1. points:100 - Simple quick task (5-15 min)
   2. points:200 - Minor task (15-30 min)
   3. points:500 - Standard task (30-60 min)
   ...

Select points (1-8): 3

🚀 Creating task...
✅ Task created successfully!
   Task ID: 57
   Title: Fix the spinner widget

💎 Adding point label...
✅ Added points:500

✨ Done! Task will appear in Vikunja and on your dashboard.
```

**Pros**:
- Full control over all task properties
- Can assign points for gamification
- Reliable (uses API directly)
- Works even when UI is completely broken

**Cons**: Requires command line access

---

### Method 3: Staff Dashboard (View Only)

The Staff Dashboard at [/staff/dashboard](/staff/dashboard) shows:
- Priority tasks (due today/overdue)
- Point values
- Task descriptions

**Note**: The dashboard is read-only. Use Method 1 or 2 to create tasks.

---

## 🔧 API Access (For Developers)

The Vikunja API works perfectly. If building custom UI:

```bash
# Create task via API
curl -X PUT "https://tasks.sipnplay.cafe/api/v1/projects/2/tasks" \
  -H "Authorization: Bearer tk_e396533971cba5f0873c21900a49ecd136602c77" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task name",
    "description": "Task details",
    "done": false,
    "due_date": "2025-01-31T17:00:00Z"
  }'

# Add point label (after creating task)
curl -X PUT "https://tasks.sipnplay.cafe/api/v1/tasks/TASK_ID/labels" \
  -H "Authorization: Bearer tk_e396533971cba5f0873c21900a49ecd136602c77" \
  -H "Content-Type: application/json" \
  -d '{"label_id": 3}'
```

**Point Label IDs**:
- 1 = points:100 (5-15 min)
- 2 = points:200 (15-30 min)
- 3 = points:500 (30-60 min)
- 4 = points:1000 (1-2 hours)
- 5 = points:5000 (half day)
- 6 = points:10000 (full day)
- 7 = points:20000 (2-3 days)
- 8 = points:50000 (1+ week)

---

## 📊 Project IDs

Use these IDs when creating tasks:

| ID | Project Name |
|----|--------------|
| 1  | Inbox |
| 2  | Sip n Play (default for staff tasks) |
| 3  | Cleaning |
| 4  | Maintenance |
| 6  | test |
| 7  | Admin |
| 8  | Inventory |
| 9  | Events & Marketing |
| 10 | TEST - Fresh Project |

---

## 🐛 When Will This Be Fixed?

This is a **known bug in v1.0.0-rc2** (release candidate). Options:

1. **Wait for v1.0.0 stable release** - May have frontend fixes
2. **Continue using workarounds** - Both methods work reliably
3. **Build custom UI** - If Vikunja frontend continues to be unstable

**Recommended**: Use workarounds (Methods 1 & 2) until v1.0.0 stable is released.

---

## 📞 Support

If workarounds don't work:
- Check [docs/VIKUNJA_TASK_WORKFLOW.md](VIKUNJA_TASK_WORKFLOW.md) for detailed workflow
- Check [scripts/add-vikunja-task.js](../scripts/add-vikunja-task.js) for CLI script details
- Report issues to development team

**Last Updated**: January 30, 2025
**Vikunja Version**: v1.0.0-rc2 (unstable)
