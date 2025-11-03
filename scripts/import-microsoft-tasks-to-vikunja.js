/**
 * Import Microsoft To-Do tasks into Vikunja
 *
 * Usage: node scripts/import-microsoft-tasks-to-vikunja.js
 */

const VIKUNJA_URL = 'https://vikunja-production-f9be.up.railway.app/api/v1';
const API_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

// Parse date from "Due ‎Mon‎, ‎1‎ ‎Dec" format
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Extract just the date part after "Due "
  const match = dateStr.match(/Due\s+.*?,\s*(\d+)\s+([A-Za-z]+)(?:\s+(\d+))?/);
  if (!match) return null;

  const [, day, month, year] = match;
  const currentYear = year || new Date().getFullYear();
  const monthMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  const date = new Date(currentYear, monthMap[month], parseInt(day), 23, 59, 59);
  return date.toISOString();
}

// Tasks data
const tasks = [
  {
    title: "Alcohol Wipe Session (read notes)",
    dueDate: "Due ‎Sat‎, ‎27‎ ‎Dec",
    notes: `Alcohol wipe the following objects
-All Menus (in all rooms)
-All cubes and toys
-All standees

The following board games (and more if you can think of some)
-Wavelength
-Dropotler
-Cookie Box/Halli Galli Bell
-Chips in Splendor
-Pieces in monopoly games`,
    done: false
  },
  {
    title: "Clean Gutter pipe",
    dueDate: "Due ‎Mon‎, ‎1‎ ‎Dec",
    done: false
  },
  {
    title: "Check + Charge batteries in Wii motes g2 and u1",
    dueDate: "Due ‎Sun‎, ‎30‎ ‎Nov",
    done: false
  },
  {
    title: "Charge + Wipe all rarely used video game controllers incl Arcade Sticks",
    dueDate: "Due ‎Wed‎, ‎26‎ ‎Nov",
    done: false
  },
  {
    title: "Clean G1 Retail shelf (Read Notes)",
    dueDate: "Due ‎Fri‎, ‎21‎ ‎Nov",
    notes: `1) Take off items, use window cleaner and wipe the glass surface. Put items back on (take photo if you need)

2) Arrange the games nicely so they are all viewable. Check for any missing items from g2 storage and make sure they exist in the shelf.

We need to "rotate" games as well from the front facing view as the sun will fade the box over time. You can re-arrange it just as long as it looks good and every title is viewable

Estimated time to complete =1 hour`,
    done: false
  },
  {
    title: "Clean giant katamino g2",
    dueDate: "Due ‎Tue‎, ‎11‎ ‎Nov",
    done: false
  },
  {
    title: "Clean g1 fridge bottom shelf",
    dueDate: "Due ‎Mon‎, ‎10‎ ‎Nov",
    notes: `Where we store cream.
Take everything off. Use soap and dishwashing sponge.`,
    done: false
  },
  {
    title: "Stocktake Brooch Pins (4 Step)",
    dueDate: "Due ‎Mon‎, ‎10‎ ‎Nov",
    notes: `Tips:
- Do it during off-peak times and make sure you have enough time to do all 3 tasks. Doing them split between days will be more difficult

- Use 2 tables and lay all bags/boards on the table for easier viewing

Total time it should take is 1-2 hours if done effectively`,
    checklist: [
      "Make sure all pins are on g1 board",
      "Make sure all pins are on g2 board",
      "Report all pins with less than 3 In stock as pictures to #breakages-and-errors",
      "Arrange pins into correct categories, google for items you are unsure of."
    ],
    done: false
  },
  {
    title: "G1 BG arranging (read notes)",
    dueDate: "Due ‎Fri‎, ‎7‎ ‎Nov",
    notes: `Arrange the bg shelf in g1 and the small table next to tv1.

Make sure items are "faced up" meaning
Brought to front and aligned with edge of shelf
Flipped the correct way
Not bloated so fix pieces inside if fallen

Use the image to help move items to their correct spots. Similiar games belong together.

https://discord.com/channels/1257369266328703018/1292445776152363085/1377300304235597954`,
    done: false
  },
  {
    title: "TV/TV 2 Deep Clean (Read Notes)",
    dueDate: "Due ‎Fri‎, ‎7‎ ‎Nov",
    notes: `1) Lift controller charging stations and wipe table completely. Wipe around the sides of cupboard. Separate them slightly and wipe inbetween.

2) dry-wipe ontop of PS4 and deep around power cables for all dust.

Move everything back and ensure they all turn on/working/charging.

3) Wipe the small glass tables, move things, wipe it down including the legs, underneath corners.

Approximate time to finish = 15 minutes`,
    done: false
  },
  {
    title: "Sweep g2 stair",
    dueDate: "Due ‎Thu‎, ‎6‎ ‎Nov",
    done: false
  },
  {
    title: "G2 Furniture & Games Cleaning (Read Notes)",
    dueDate: "Due ‎Thu‎, ‎6‎ ‎Nov",
    notes: `1) Move all benches out slightly so you can mop/sweep. The entire room should be re-arranged so you can access the floor which was blocked.

2) Move it back, make sure the spacing for the sofas is even.

3) Wipe the sides/tops of all board games, along with the shelf. Take games out first, take photo or use reference photo in discord to make sure you put them back in the correct position. This includes the smaller shelf at the front.

4) arrange the retail lego nicely and use a dry-tissue to wipe all dust from the top of the boxes

Estimated time to finish - 2 hours`,
    checklist: [
      "Step 1",
      "Step 2",
      "Step 3",
      "Step 4"
    ],
    done: false
  },
  {
    title: "Clean g2 wall shelf (read notes)",
    dueDate: "Due ‎Wed‎, ‎5‎ ‎Nov",
    notes: `The wall with floating shelf attached. The surface area. Move figurines off, give it a wipe. Arrange figurines nicely and dust them.

Make sure to go into the benches. It's the entire wall side, not just near the stairs.`,
    done: false
  },
  {
    title: "Bin Spraying (Read Notes)",
    dueDate: "Due ‎Tue‎, ‎4‎ ‎Nov",
    notes: `Take out ALL bins (g1,g2, u1, u2, toilet bins)  to spray with soapy water. Use the toilet brush to remove and grease/dirty. It should smell nice afterwards.

Let it dry in the sun. So try to do this during morning task on a weekday

Estimated time to finish = 45minutes`,
    done: false
  },
  {
    title: "Kitchen Deep Cleaning (Read Notes)",
    dueDate: "Due ‎Tue‎, ‎4‎ ‎Nov",
    notes: `1) Remove Tray in Airfryer and wash with soap then rinse and let it try

2) Wipe down all bottles/things behind stove, lift stove up and wipe underneath

3) Wipe down microwave front and inside with cloth

4) Organise and Clean the juicing area - remove all rubbish

5) go to stairway and use dry tissue and wipe down all board game console boxes, and use wet cloth and wipe the stairway shelf tops.

6) Arrange stock in kitchen neatly, identify any rubbish and unorganised things

7) Wipe down fridge shelving, move things off, look for dirt/sugar/etc

Estimated time: 1 to 2 hours`,
    done: false
  },
  {
    title: "G1 Board-game Shelf Cleaning",
    dueDate: "Due ‎Tue‎, ‎4‎ ‎Nov",
    notes: `1) Take 1 game off at a time, wipe around the sides with damp tablecloth. Boxes at the top and bottom are prority. Also small boxes which don't get played much
2) Lift out all the games in the bottom row, clean the shelf with cloth.

3) Clean the edges of all the shelves

4) face-up the shelf (bring all board games to the border)

Approximate time to finish = 30-45 minutes`,
    done: false
  },
  {
    title: "Charge all Wii-u Controllers",
    dueDate: "Due ‎Tue‎, ‎4‎ ‎Nov",
    done: false
  },
  {
    title: "Small cut to Lords of waterdeep insert box",
    dueDate: "Due Tomorrow",
    done: false
  },
  {
    title: "Wrap lord of waterdeep box",
    dueDate: "Due Tomorrow",
    done: false
  },
  {
    title: "Spiderwebs n Doors(Read Notes)",
    dueDate: "Due Tomorrow",
    notes: `1) Use any long stick and look at the roof corners, find any spiderwebs and get it attached to the stick as well. Wipe the stick after usage.

2) use alcohol wipe and clean ALL door handles and spot-check for dirt on doors to clean. Look closely in the corners, wipe along the top edge for dust, use a chair to reach

Do this for ALL rooms including kitchen/bathrooms

Approximate time to finish = 30 minutes`,
    done: false
  },
  {
    title: "Check for out of date food",
    dueDate: "Due Tomorrow",
    notes: "If any are expiring within 1 month, send to #breakages-and-error and make sure they are in the FRONT of their selling zone.",
    checklist: [
      "Boom Jellys",
      "Chocolate",
      "All Beer Cans",
      "Snack O'star"
    ],
    done: false
  },
  {
    title: "Clean Poker Cards + Chips",
    dueDate: "Due Tomorrow",
    notes: "Approximate time to finish = 30-45 minutes",
    done: false
  },
  {
    title: "(Appsheet) Stocktake",
    dueDate: "Due Tomorrow",
    notes: "Count all items and make sure the count is correct. Also arrange and neaten/tidy",
    checklist: [
      "Kitchen Shelf",
      "Kitchen Fridge",
      "G2 Freezer"
    ],
    done: false
  },
  {
    title: "Deep clean popcorn machine (read note)",
    dueDate: "Due Today",
    notes: `Do this before closing on Sunday night or after opening the next Monday

Remove the salt catcher tray from the bottom of the
Remove the bottom of the machine's container and wash them

FOLD some dining tissue, spray it with some cleaning fluid and wipe the inside of the machine glasses clean`,
    checklist: [
      "Remove bottom tray",
      "Disassemble container bottom",
      "Sweep the container opening",
      "Clean container glasses"
    ],
    done: false
  },
  {
    title: "Collect draft beer and hard soda can (for display)",
    dueDate: null,
    checklist: [
      "Wildside tamarind",
      "WS lime lemon",
      "WS lime lemon",
      "WS mixberry",
      "Hard soda pink quava",
      "HS tropical punch",
      "Mixtape Molly",
      "M peach and cream",
      "M blue",
      "M red"
    ],
    done: false
  }
];

async function createProject() {
  console.log('Creating "Staff Tasks" project...');

  const response = await fetch(`${VIKUNJA_URL}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Staff Tasks',
      description: 'Imported from Microsoft To-Do - Sip N Play staff task list'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create project: ${error}`);
  }

  const project = await response.json();
  console.log(`✅ Project created with ID: ${project.id}`);
  return project.id;
}

async function createTask(projectId, task) {
  const dueDate = parseDate(task.dueDate);

  const taskData = {
    title: task.title,
    description: task.notes || '',
    project_id: projectId,
    done: task.done || false
  };

  if (dueDate) {
    taskData.due_date = dueDate;
  }

  console.log(`Creating task: ${task.title}...`);

  const response = await fetch(`${VIKUNJA_URL}/projects/${projectId}/tasks`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Failed to create task "${task.title}": ${error}`);
    return null;
  }

  const createdTask = await response.json();
  console.log(`✅ Task created: ${task.title}`);

  // Add checklist items if any
  if (task.checklist && task.checklist.length > 0) {
    for (const checklistItem of task.checklist) {
      await addChecklistItem(createdTask.id, checklistItem);
    }
  }

  return createdTask;
}

async function addChecklistItem(taskId, title) {
  const response = await fetch(`${VIKUNJA_URL}/tasks/${taskId}/attachments`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      task_id: taskId,
      title: title,
      done: false
    })
  });

  if (response.ok) {
    console.log(`  ✓ Added checklist item: ${title}`);
  }
}

async function main() {
  console.log('\n🚀 Starting Microsoft To-Do → Vikunja import...\n');

  try {
    // Create project
    const projectId = await createProject();

    console.log(`\n📝 Importing ${tasks.length} tasks...\n`);

    // Create all tasks
    let successCount = 0;
    for (const task of tasks) {
      const created = await createTask(projectId, task);
      if (created) successCount++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ Import complete! ${successCount}/${tasks.length} tasks created successfully.`);
    console.log(`\n🔗 View your tasks at: ${VIKUNJA_URL.replace('/api/v1', '')}/projects/${projectId}\n`);

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

main();
