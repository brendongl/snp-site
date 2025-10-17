/**
 * One-time setup script to add all known BGG mechanisms to Airtable
 * This comprehensive list was compiled from BGG's mechanism taxonomy
 *
 * Usage: Set environment variables and run:
 *   AIRTABLE_API_KEY=xxx AIRTABLE_GAMES_BASE_ID=xxx AIRTABLE_GAMES_TABLE_ID=xxx npx tsx scripts/setup-mechanisms.ts
 */

const BGG_MECHANISMS = [
  "Acting",
  "Action / Event",
  "Action Drafting",
  "Action Points",
  "Action Queue",
  "Action Retrieval",
  "Action Timer",
  "Advantage Token",
  "Alliances",
  "Area Majority / Influence",
  "Area Movement",
  "Area-Impulse",
  "Auction / Bidding",
  "Auction Compensation",
  "Auction: Dexterity",
  "Auction: Dutch",
  "Auction: Dutch Priority",
  "Auction: English",
  "Auction: Fixed Placement",
  "Auction: Multiple Lot",
  "Auction: Once Around",
  "Auction: Sealed Bid",
  "Auction: Turn Order Until Pass",
  "Automatic Resource Growth",
  "Betting and Bluffing",
  "Bias",
  "Bids As Wagers",
  "Bingo",
  "Bribery",
  "Campaign / Battle Card Driven",
  "Card Play Conflict Resolution",
  "Catch the Leader",
  "Chaining",
  "Chit-Pull System",
  "Closed Drafting",
  "Closed Economy Auction",
  "Command Cards",
  "Commodity Speculation",
  "Communication Limits",
  "Connections",
  "Constrained Bidding",
  "Contracts",
  "Cooperative Game",
  "Crayon Rail System",
  "Critical Hits and Failures",
  "Cube Tower",
  "Deck Construction",
  "Deck, Bag, and Pool Building",
  "Deduction",
  "Delayed Purchase",
  "Dice Rolling",
  "Die Icon Resolution",
  "Different Dice Movement",
  "Drawing",
  "Elapsed Real Time Ending",
  "Enclosure",
  "End Game Bonuses",
  "Events",
  "Finale Ending",
  "Flicking",
  "Follow",
  "Force Commitment",
  "Grid Coverage",
  "Grid Movement",
  "Hand Management",
  "Hexagon Grid",
  "Hidden Movement",
  "Hidden Roles",
  "Hidden Victory Points",
  "Highest-Lowest Scoring",
  "Hot Potato",
  "I Cut, You Choose",
  "Impulse Movement",
  "Income",
  "Increase Value of Unchosen Resources",
  "Induction",
  "Interrupts",
  "Investment",
  "Kill Steal",
  "King of the Hill",
  "Ladder Climbing",
  "Layering",
  "Legacy Game",
  "Line Drawing",
  "Line of Sight",
  "Loans",
  "Lose a Turn",
  "Mancala",
  "Map Addition",
  "Map Deformation",
  "Map Reduction",
  "Market",
  "Matching",
  "Measurement Movement",
  "Melding and Splaying",
  "Memory",
  "Minimap Resolution",
  "Modular Board",
  "Move Through Deck",
  "Movement Points",
  "Movement Template",
  "Moving Multiple Units",
  "Multi-Use Cards",
  "Multiple Maps",
  "Narrative Choice / Paragraph",
  "Negotiation",
  "Neighbor Scope",
  "Network and Route Building",
  "Once-Per-Game Abilities",
  "Open Drafting",
  "Order Counters",
  "Ownership",
  "Paper-and-Pencil",
  "Passed Action Token",
  "Pattern Building",
  "Pattern Movement",
  "Pattern Recognition",
  "Physical Removal",
  "Pick-up and Deliver",
  "Pieces as Map",
  "Player Elimination",
  "Player Judge",
  "Point to Point Movement",
  "Predictive Bid",
  "Prisoner's Dilemma",
  "Programmed Movement",
  "Push Your Luck",
  "Questions and Answers",
  "Race",
  "Random Production",
  "Ratio / Combat Results Table",
  "Re-rolling and Locking",
  "Real-Time",
  "Relative Movement",
  "Resource Queue",
  "Resource to Move",
  "Roles with Asymmetric Information",
  "Roll / Spin and Move",
  "Rondel",
  "Rotation",
  "Round Tracker",
  "Scenario / Mission / Campaign Game",
  "Score-and-Reset Game",
  "Season / Day",
  "Secret Unit Deployment",
  "Selection Order Bid",
  "Semi-Cooperative Game",
  "Set Collection",
  "Shape Matching",
  "Simulation",
  "Simultaneous Action Selection",
  "Single Loser Game",
  "Slide / Push",
  "Solo / Solitaire Game",
  "Speed Matching",
  "Square Grid",
  "Stacking and Balancing",
  "Stat Check Resolution",
  "Static Capture",
  "Stock Holding",
  "Storytelling",
  "Sudden Death Ending",
  "Take That",
  "Tags",
  "Tech Trees / Tech Tracks",
  "Three Dimensional Movement",
  "Threshold Bid",
  "Tile Placement",
  "Time Track",
  "Track Movement",
  "Trade",
  "Trading",
  "Traitor Game",
  "Trick-taking",
  "Tug of War",
  "Turn Order: Auction",
  "Turn Order: Claim Action",
  "Turn Order: Pass Order",
  "Turn Order: Progressive",
  "Turn Order: Random",
  "Turn Order: Role Order",
  "Turn Order: Stat-Based",
  "Variable Phase Order",
  "Variable Player Powers",
  "Variable Set-up",
  "Victory Points as a Resource",
  "Voting",
  "Worker Placement",
  "Worker Placement with Dice Workers",
  "Worker Placement, Different Worker Types",
  "Zone of Control"
];

async function setupMechanisms() {
  const baseId = process.env.AIRTABLE_GAMES_BASE_ID;
  const tableId = process.env.AIRTABLE_GAMES_TABLE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;

  if (!baseId || !tableId || !apiKey) {
    console.error('Missing Airtable configuration');
    process.exit(1);
  }

  console.log(`Setting up ${BGG_MECHANISMS.length} BGG mechanisms in Airtable...`);

  // Step 1: Fetch table schema to get Mechanisms field ID
  const schemaUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const schemaResponse = await fetch(schemaUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!schemaResponse.ok) {
    console.error('Failed to fetch schema:', await schemaResponse.text());
    process.exit(1);
  }

  const schema = await schemaResponse.json();
  const gamesTable = schema.tables.find((table: any) => table.id === tableId);

  if (!gamesTable) {
    console.error('Games table not found');
    process.exit(1);
  }

  const mechanismsField = gamesTable.fields.find(
    (field: any) => field.name === 'Mechanisms' && field.type === 'multipleSelects'
  );

  if (!mechanismsField) {
    console.error('Mechanisms field not found. Please create a multi-select field named "Mechanisms" in Airtable.');
    process.exit(1);
  }

  console.log(`Found Mechanisms field: ${mechanismsField.id}`);

  // Step 2: Update the field with all mechanisms
  const colors = ['blueLight2', 'cyanLight2', 'tealLight2', 'greenLight2', 'yellowLight2', 'orangeLight2', 'redLight2', 'pinkLight2', 'purpleLight2', 'grayLight2'];

  const choices = BGG_MECHANISMS.map((name, index) => ({
    name,
    color: colors[index % colors.length]
  }));

  const updateUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields/${mechanismsField.id}`;

  console.log('Updating Mechanisms field...');

  const updateResponse = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      options: {
        choices,
      },
    }),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error('Failed to update Mechanisms field:', errorText);
    process.exit(1);
  }

  console.log('✓ Successfully added all BGG mechanisms to Airtable!');
  console.log(`  Total mechanisms: ${BGG_MECHANISMS.length}`);
}

setupMechanisms().catch(console.error);
