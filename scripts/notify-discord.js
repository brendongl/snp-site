#!/usr/bin/env node

/**
 * Discord Version Notification Script
 *
 * Usage: node scripts/notify-discord.js [version] [changes...]
 *
 * Example:
 *   node scripts/notify-discord.js 1.0.6 "Added new filter" "Fixed expansion display"
 *
 * Or with automatic version detection:
 *   node scripts/notify-discord.js --auto
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

function getVersionFromPackageJson() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

function formatDate() {
  return new Date().toISOString().split('T')[0];
}

function createDiscordMessage(version, buildDate, changes) {
  const color = 3498843; // Blue

  return {
    username: 'Sip n Play Bot',
    embeds: [
      {
        title: '🎮 New Version Released',
        description: `Board Games Portal has been updated to **v${version}**`,
        color,
        fields: [
          {
            name: '📦 Version',
            value: `\`v${version}\``,
            inline: true,
          },
          {
            name: '📅 Build Date',
            value: buildDate,
            inline: true,
          },
          {
            name: '✨ Updates',
            value:
              changes.length > 0
                ? changes.map((change) => `• ${change}`).join('\n')
                : 'Release deployment',
            inline: false,
          },
        ],
        footer: {
          text: 'Sip n Play Cafe - Board Games Collection',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function sendToDiscord(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(webhookUrl);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({ success: true, status: res.statusCode });
        } else {
          reject(
            new Error(
              `Discord API error: ${res.statusCode} - ${data}`
            )
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(message));
    req.end();
  });
}

async function main() {
  // Get webhook URL from environment
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('❌ Error: DISCORD_WEBHOOK_URL environment variable not set');
    console.error('Set it with: export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."');
    process.exit(1);
  }

  let version = '';
  let changes = [];
  let useAuto = false;

  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/notify-discord.js [version] [changes...]');
    console.error('   or: node scripts/notify-discord.js --auto');
    process.exit(1);
  }

  if (args[0] === '--auto') {
    version = getVersionFromPackageJson();
    useAuto = true;
  } else {
    version = args[0];
    changes = args.slice(1);
  }

  if (!version) {
    console.error('❌ Error: Could not determine version');
    process.exit(1);
  }

  const buildDate = formatDate();

  console.log(`📤 Sending Discord notification for v${version}...`);
  console.log(`   Build Date: ${buildDate}`);
  if (changes.length > 0) {
    console.log(`   Changes: ${changes.length} item(s)`);
    changes.forEach((change) => console.log(`     • ${change}`));
  }

  try {
    const message = createDiscordMessage(version, buildDate, changes);
    const result = await sendToDiscord(webhookUrl, message);

    console.log(
      `\n✅ Discord notification sent successfully (HTTP ${result.status})`
    );
    console.log(`   Version: v${version}`);
    console.log(`   Time: ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`\n❌ Failed to send Discord notification:`);
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

main();
