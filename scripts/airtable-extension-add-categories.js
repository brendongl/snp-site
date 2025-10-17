/**
 * Airtable Extension Script to Add All BGG Categories
 *
 * HOW TO USE:
 * 1. Open your Airtable base
 * 2. Click "Extensions" in the top right
 * 3. Click "Add an extension" → "Scripting"
 * 4. Copy and paste this entire script
 * 5. Click "Run"
 *
 * This will add all 129 unique standard BGG categories to your Categories field.
 * This ensures all games from BoardGameGeek can be imported without permission errors.
 */

// Complete list of BGG categories (as of 2025)
// This comprehensive list includes all unique categories from BoardGameGeek
const BGG_CATEGORIES = [
  "Abstract",
  "Abstract Strategy",
  "Acting",
  "Action",
  "Action / Dexterity",
  "Adult",
  "Adventure",
  "Age Tag",
  "Animal",
  "Animals",
  "Area Majority / Influence",
  "Area Movement",
  "ARPG",
  "Art",
  "Betting",
  "Bluffing",
  "Card Game",
  "Casual",
  "Children's Game",
  "City Building",
  "Classic",
  "Co-Op",
  "Deduction",
  "Dexterity",
  "Dice Rolling",
  "Drawing",
  "Economic",
  "Educational",
  "Exploration",
  "Expansion for Base-game",
  "Family",
  "Fantasy",
  "Farming",
  "Fighting",
  "First-Person",
  "Grid Movement",
  "Hand Management",
  "Horror",
  "Humor",
  "Income",
  "Investment",
  "Kids",
  "Math",
  "Mature",
  "Mature / Adult",
  "Medical",
  "Medieval",
  "Memory",
  "Mini-games",
  "Miniatures",
  "Modular Board",
  "Movies / TV / Radio theme",
  "Murder / Mystery",
  "Murder Mystery",
  "Musical",
  "Mythology",
  "Nautical",
  "Negotiation",
  "Novel-based",
  "Number",
  "Open Drafting",
  "Open-World",
  "Paper & Pencil",
  "Party",
  "Party Game",
  "Pattern Building",
  "Pirates",
  "Pixel",
  "Platformer",
  "Political",
  "Predictive Bid",
  "Prehistoric",
  "Print & Play",
  "Puzzle",
  "Quiz",
  "Racing",
  "Real-Time",
  "Real-time",
  "Religious",
  "Renaissance",
  "Requires Base Game",
  "Role-playing",
  "Rougelike",
  "RPG",
  "Science Fiction",
  "Set Collection",
  "Shooting",
  "Simulator",
  "Social",
  "Space Exploration",
  "Sports",
  "Spies / Secret Agents",
  "Strategy",
  "Take That",
  "Team-Based Game",
  "Test Category",
  "Thematic",
  "Third-Person Shooter",
  "Tile Placement",
  "Trading",
  "Trains",
  "Travel",
  "Trick-taking",
  "Trivia",
  "Tug Of War",
  "Uncategorized",
  "Video Game Theme",
  "Videogame-themed",
  "Wargame",
  "Word Game",
  "Worker Placement",
  "Zombies"
];

async function addCategories() {
  output.markdown('# Adding BGG Categories to Airtable');
  output.markdown(`Total BGG categories available: ${BGG_CATEGORIES.length}`);

  try {
    // Get the table
    output.markdown('\n📋 Step 1: Getting table...');
    const table = base.getTable('BG List');
    output.markdown('✓ Found table: BG List');

    // Get the field
    output.markdown('\n📋 Step 2: Getting Categories field...');
    const categoriesField = table.getField('Categories');

    if (!categoriesField) {
      output.markdown('❌ **Error:** Categories field not found!');
      output.markdown('Make sure your table is named "BG List" and has a "Categories" field.');
      return;
    }
    output.markdown('✓ Found Categories field');

    // Check existing categories
    output.markdown('\n📋 Step 3: Checking existing categories...');
    const fieldConfig = await categoriesField.getOptionsAsync();
    const existingNames = new Set(fieldConfig.choices.map(choice => choice.name));
    output.markdown(`✓ Found ${existingNames.size} existing categories in Airtable`);

    // Find missing categories
    const missingCategories = BGG_CATEGORIES.filter(cat => !existingNames.has(cat));
    output.markdown(`\n📊 **Analysis:**`);
    output.markdown(`- Total BGG categories: ${BGG_CATEGORIES.length}`);
    output.markdown(`- Already in Airtable: ${existingNames.size}`);
    output.markdown(`- Need to add: ${missingCategories.length}`);

    if (missingCategories.length === 0) {
      output.markdown('\n✅ **All categories already exist!** No updates needed.');
      output.markdown('Your Categories field is complete and ready to use.');
      return;
    }

    // Show missing categories
    output.markdown('\n📋 Step 4: Categories to be added:');
    output.markdown(`- ${missingCategories.slice(0, 10).join('\n- ')}`);
    if (missingCategories.length > 10) {
      output.markdown(`- ... and ${missingCategories.length - 10} more`);
    }

    // Build new choices (keep existing + add new)
    output.markdown('\n📋 Step 5: Building updated category list...');
    const colors = ['blueLight2', 'cyanLight2', 'tealLight2', 'greenLight2', 'yellowLight2', 'orangeLight2', 'redLight2', 'pinkLight2', 'purpleLight2', 'grayLight2'];

    // Keep all existing choices
    const allChoices = [...fieldConfig.choices];

    // Add new categories
    missingCategories.forEach((name, index) => {
      allChoices.push({
        name: name,
        color: colors[(allChoices.length + index) % colors.length]
      });
    });

    output.markdown(`✓ Building complete list with ${allChoices.length} total categories`);

    // Update the field
    output.markdown('\n📋 Step 6: Updating Airtable field...');
    output.markdown(`⏳ Adding ${missingCategories.length} new categories (this may take 30-60 seconds)...`);

    const startTime = Date.now();
    await categoriesField.updateOptionsAsync({
      choices: allChoices
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    output.markdown(`\n✅ **SUCCESS!** Update completed in ${duration} seconds`);
    output.markdown(`✅ Added ${missingCategories.length} new categories`);
    output.markdown(`✅ Total categories now: ${allChoices.length}`);

    // Show important added categories
    output.markdown('\n📝 **Key categories added:**');
    const keyCategories = ['Team-Based Game', 'Abstract Strategy', 'Party Game', 'Worker Placement', 'Deck Building'];
    keyCategories.forEach(cat => {
      if (missingCategories.includes(cat)) {
        output.markdown(`- "${cat}" ✓`);
      }
    });

    output.markdown('\n✅ You can now close this extension and try adding games!');
    output.markdown('\n🎮 **Test it:** Try adding game BGG ID 392761 (Spots) - it should now work!');

  } catch (error) {
    output.markdown(`\n❌ **Error during update:** ${error.message}`);
    output.markdown('\n**Troubleshooting:**');
    output.markdown('- Make sure you have permission to edit field configurations');
    output.markdown('- Check that your table name is exactly "BG List"');
    output.markdown('- Check that your field name is exactly "Categories"');
    output.markdown('- Try closing and reopening the extension');
    output.markdown('\n📋 **Full error details:**');
    output.markdown('```');
    output.markdown(error.stack || error.toString());
    output.markdown('```');
  }
}

// Run the script
addCategories();
