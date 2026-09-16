const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const berlinTimeZone = 'Europe/Berlin';
const chennaiTimeZone = 'Asia/Kolkata';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

const activeCalls = new Map();
let logoutTimeout = null;

function formatDuration(totalDurationMs) {
  const totalSeconds = Math.max(0, Math.floor(totalDurationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatDateTime(timestamp, timeZone) {
  const date = new Date(timestamp);
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    timeZone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date);
  const timeZoneName = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || timeZone;
  return `${formattedDate} (${timeZoneName})`;
}

async function logCompletedCall(channel, startTime) {
  const logChannel = await client.channels.fetch(process.env.CHANNEL_ID).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) return;

  const finishedAt = Date.now();
  const durationString = formatDuration(finishedAt - startTime);

  await logChannel.send(
    `📢 **The call in <#${channel.id}> has ended.**\n` +
    `🟢 **Started:** ${formatDateTime(startTime, berlinTimeZone)} / ${formatDateTime(startTime, chennaiTimeZone)}\n` +
    `🔴 **Finished:** ${formatDateTime(finishedAt, berlinTimeZone)} / ${formatDateTime(finishedAt, chennaiTimeZone)}\n` +
    `⏱️ **Total session duration:** ${durationString}`
  ).catch((error) => console.error(error.message));
}

function updateChannelSession(channel) {
  const humanMemberCount = channel.members.filter((member) => !member.user.bot).size;
  const channelId = channel.id;

  // 🟢 FIXED: The bot ONLY triggers tracking AND joins if there is AT LEAST 1 real human inside
  if (humanMemberCount > 0 && !activeCalls.has(channelId)) {
    activeCalls.set(channelId, Date.now());
    console.log(`[TRACKING] Active human detected. Starting session from zero in channel ${channelId}`);

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    if (logoutTimeout) {
      clearTimeout(logoutTimeout);
      logoutTimeout = null;
    }
    return;
  }

  // Someone returns before the 15-minute grace period expires
  if (humanMemberCount > 0 && logoutTimeout) {
    clearTimeout(logoutTimeout);
    logoutTimeout = null;
    console.log('[SHIELD] Connection restored in time.');
  }

  // Channel becomes completely empty (0 humans)
  if (humanMemberCount === 0 && activeCalls.has(channelId) && !logoutTimeout) {
    console.log('[WARNING] Channel empty. Starting 15 minutes grace period...');
    logoutTimeout = setTimeout(() => {
      const startTime = activeCalls.get(channelId);
      activeCalls.delete(channelId);
      logoutTimeout = null;
      
      console.log('[LOG] Grace period expired. Sending log and disconnecting bot.');
      void logCompletedCall(channel, startTime);

      const connection = getVoiceConnection(channel.guild.id);
      if (connection) connection.destroy();
    }, 15 * 60 * 1000); 
  }
}

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}!`);
  
  // ⛔ FIXED: Do NOT force any connection or session check when the bot boots up empty
  const channel = await client.channels.fetch(process.env.VOICE_CHANNEL_ID).catch(() => null);
  if (channel && channel.isVoiceBased()) {
    const humanMemberCount = channel.members.filter((member) => !member.user.bot).size;
    // Only engage if humans are already talking when the bot restarts
    if (humanMemberCount > 0) {
      updateChannelSession(channel);
    }
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const channel = oldState.channel || newState.channel;
  if (!channel || channel.id !== process.env.VOICE_CHANNEL_ID) return;
  updateChannelSession(channel);
});

// EMERGENCY DIRECT CHAT COMMAND
client.on('messageCreate', async (message) => {
  if (message.content === '!stopcall' && !message.author.bot) {
    const vID = process.env.VOICE_CHANNEL_ID;
    if (activeCalls.has(vID)) {
      if (logoutTimeout) clearTimeout(logoutTimeout);
      const startTime = activeCalls.get(vID);
      const channel = await client.channels.fetch(vID);
      activeCalls.delete(vID);
      void logCompletedCall(channel, startTime);
      message.reply("🏁 **Session ended manually! Final log sent.**");
      const connection = getVoiceConnection(channel.guild.id);
      if (connection) connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();
app.get("/", (req, res) => res.send("Online"));
app.listen(process.env.PORT || 3000);
