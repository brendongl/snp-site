/**
 * Airtable Extension Script to Add All BGG Mechanisms
 *
 * HOW TO USE:
 * 1. Open your Airtable base
 * 2. Click "Extensions" in the top right
 * 3. Click "Add an extension" → "Scripting"
 * 4. Copy and paste this entire script
 * 5. Click "Run"
 *
 * This will add all 193 standard BGG mechanisms to your Mechanisms field.
 */

// Complete list of BGG mechanisms (as of 2025)
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

// Available colors for select options
const COLORS = [
  'blueLight2', 'cyanLight2', 'tealLight2', 'greenLight2',
  'yellowLight2', 'orangeLight2', 'redLight2', 'pinkLight2',
  'purpleLight2', 'grayLight2'
];

async function addMechanisms() {
  output.markdown('# Adding BGG Mechanisms to Airtable');
  output.markdown(`Adding ${BGG_MECHANISMS.length} mechanisms...`);

  // Get the table
  const table = base.getTable('BG List');
  const mechanismsField = table.getField('Mechanisms');

  // Check if field exists
  if (!mechanismsField) {
    output.markdown('❌ **Error:** Mechanisms field not found!');
    return;
  }

  output.markdown('✓ Found Mechanisms field');

  // Build choices with colors
  const choices = BGG_MECHANISMS.map((name, index) => ({
    name: name,
    color: COLORS[index % COLORS.length]
  }));

  // Update the field
  output.markdown('Updating field with mechanisms...');

  try {
    await mechanismsField.updateOptionsAsync({
      choices: choices
    });

    output.markdown(`\n✅ **Success!** Added ${BGG_MECHANISMS.length} mechanisms to the Mechanisms field.`);
    output.markdown('\nYou can now close this extension and use the game creation API.');

  } catch (error) {
    output.markdown(`\n❌ **Error:** ${error.message}`);
    output.markdown('\nMake sure you have permission to edit field configurations.');
  }
}

// Run the script
addMechanisms();
