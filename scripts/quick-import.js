const TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';
const URL = 'https://vikunja-production-f9be.up.railway.app/api/v1';
const PROJECT_ID = 2;

const tasks = [
  ['Charge + Wipe all rarely used video game controllers incl Arcade Sticks', '2025-11-26T23:59:59Z'],
  ['Clean G1 Retail shelf (Read Notes)', '2025-11-21T23:59:59Z'],
  ['Clean giant katamino g2', '2025-11-11T23:59:59Z'],
  ['Clean g1 fridge bottom shelf', '2025-11-10T23:59:59Z'],
  ['Stocktake Brooch Pins (4 Step)', '2025-11-10T23:59:59Z'],
  ['G1 BG arranging (read notes)', '2025-11-07T23:59:59Z'],
  ['TV/TV 2 Deep Clean (Read Notes)', '2025-11-07T23:59:59Z'],
  ['Sweep g2 stair', '2025-11-06T23:59:59Z'],
  ['G2 Furniture & Games Cleaning (Read Notes)', '2025-11-06T23:59:59Z'],
  ['Clean g2 wall shelf (read notes)', '2025-11-05T23:59:59Z'],
  ['Bin Spraying (Read Notes)', '2025-11-04T23:59:59Z'],
  ['Kitchen Deep Cleaning (Read Notes)', '2025-11-04T23:59:59Z'],
  ['G1 Board-game Shelf Cleaning', '2025-11-04T23:59:59Z'],
  ['Charge all Wii-u Controllers', '2025-11-04T23:59:59Z'],
  ['Small cut to Lords of waterdeep insert box', '2025-11-03T23:59:59Z'],
  ['Wrap lord of waterdeep box', '2025-11-03T23:59:59Z'],
  ['Spiderwebs n Doors(Read Notes)', '2025-11-03T23:59:59Z'],
  ['Check for out of date food', '2025-11-03T23:59:59Z'],
  ['Clean Poker Cards + Chips', '2025-11-03T23:59:59Z'],
  ['(Appsheet) Stocktake', '2025-11-03T23:59:59Z'],
  ['Deep clean popcorn machine (read note)', '2025-11-02T23:59:59Z'],
  ['Collect draft beer and hard soda can', null]
];

(async () => {
  let count = 4; // Already have 1-3
  for (const [title, dueDate] of tasks) {
    const body = { title, project_id: PROJECT_ID };
    if (dueDate) body.due_date = dueDate;

    const res = await fetch(`${URL}/projects/${PROJECT_ID}/tasks`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      console.log(`✅ Task ${count}: ${title.substring(0, 50)}...`);
      count++;
    } else {
      console.log(`❌ Failed: ${title}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\n🎉 All ${count-1} tasks imported!\n`);
  console.log(`View at: https://vikunja-production-f9be.up.railway.app/projects/2`);
})();
