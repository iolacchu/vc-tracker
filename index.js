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
  const connection = getVoiceConnection(channel.guild.id);
  
  // If the bot was manually disconnected, STOP everything and do not re-join
  if (!connection && !activeCalls.has(channel.id)) {
    return;
  }

  const humanMemberCount = channel.members.filter((member) => !member.user.bot).size;
  const channelId = channel.id;

  // Start tracking from zero when a human enters and the bot isn't connected
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
    return;
  }

  if (humanMemberCount === 0 && activeCalls.has(channelId)) {
    console.log(`[SHIELD ACTIVE] Channel empty. The bot is holding the room open indefinitely.`);
  }
}

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}!`);
  
  const channel = await client.channels.fetch(process.env.VOICE_CHANNEL_ID).catch(() => null);
  if (channel && channel.isVoiceBased()) {
    const humanMemberCount = channel.members.filter((member) => !member.user.bot).size;
    if (humanMemberCount > 0) {
      updateChannelSession(channel);
    }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  // 🟢 FIXED: If the bot itself is kicked via right-click (from inside OR outside the channel), KILL immediately
  if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
    console.log('[MANUAL KICK] Bot was disconnected via right-click. Finalizing log and shutting down tracking.');
    
    const targetChannelId = process.env.VOICE_CHANNEL_ID;
    if (activeCalls.has(targetChannelId)) {
      const startTime = activeCalls.get(targetChannelId);
      activeCalls.delete(targetChannelId); // Wipe tracking before anything else can trigger
      
      const channel = await client.channels.fetch(targetChannelId).catch(() => null);
      if (channel) {
        await logCompletedCall(channel, startTime);
      }
    }
    return;
  }

  const channel = oldState.channel || newState.channel;
  if (!channel || channel.id !== process.env.VOICE_CHANNEL_ID) return;
  
  // Only trigger session updates if the bot wasn't just disconnected
  const connection = getVoiceConnection(channel.guild.id);
  if (connection || activeCalls.has(channel.id)) {
    updateChannelSession(channel);
  }
});

client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();
app.get("/", (req, res) => res.send("Online"));
app.listen(process.env.PORT || 3000);
