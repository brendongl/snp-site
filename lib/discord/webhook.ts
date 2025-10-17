/**
 * Discord Webhook Integration
 * Sends version release notifications to Discord
 */

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  thumbnail?: {
    url: string;
  };
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export async function sendDiscordNotification(
  webhookUrl: string,
  message: DiscordMessage
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${text}`);
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to send Discord notification:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export function createVersionReleaseEmbed(
  version: string,
  buildDate: string,
  changes: string[]
): DiscordMessage {
  const color = 0x3498db; // Blue color
  const timestamp = new Date().toISOString();

  const fields: DiscordEmbedField[] = [
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
      name: '🔄 What\'s New',
      value: changes.length > 0
        ? changes.map(change => `• ${change}`).join('\n')
        : 'No changes documented',
      inline: false,
    },
  ];

  return {
    username: 'Sip n Play Bot',
    avatar_url: 'https://cdn.discordapp.com/avatars/bot-avatar.png',
    embeds: [
      {
        title: '🎮 New Version Released',
        description: `Sip n Play Board Games Portal has been updated to **v${version}**`,
        color,
        fields,
        thumbnail: {
          url: 'https://cdn-icons-png.flaticon.com/512/1197/1197232.png',
        },
      },
    ],
  };
}

export function createSimpleReleaseMessage(
  version: string,
  changes: string[]
): DiscordMessage {
  const changeList = changes.length > 0
    ? '\n' + changes.map(change => `• ${change}`).join('\n')
    : '';

  return {
    content: `🎮 **New Version Released: v${version}**${changeList}`,
  };
}
