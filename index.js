const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

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

client.once('ready', async () => {
  console.log(`Bot online come ${client.user.tag}!`);
  try {
    const channel = await client.channels.fetch(process.env.VOICE_CHANNEL_ID);
    if (channel && channel.isVoiceBased()) {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: true,
        selfDeaf: true
      });
      
      // Sincronizzato a 842 ore e 17 minuti
      const oreGiaPassateMs = ((842 * 60) + 17) * 60 * 1000; 
      activeCalls.set(channel.id, Date.now() - oreGiaPassateMs);
      console.log(`[SUCCESSO] Bot inserito in chiamata a 842h e 17m.`);
    }
  } catch (error) {
    console.error(error.message);
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const channel = oldState.channel || newState.channel;
  if (!channel || channel.id !== process.env.VOICE_CHANNEL_ID) return;

  const humanMemberCount = channel.members.filter((member) => !member.user.bot).size;

  if (humanMemberCount > 0 && logoutTimeout) {
    clearTimeout(logoutTimeout);
    logoutTimeout = null;
    console.log('[PROTETTO] Connessione ripristinata!');
  }

  if (humanMemberCount === 0 && activeCalls.has(channel.id) && !logoutTimeout) {
    console.log('[ATTENZIONE] Canale vuoto! Attivo la protezione di 15 minuti...');
    logoutTimeout = setTimeout(() => {
      const startTime = activeCalls.get(channel.id);
      activeCalls.delete(channel.id);
      logoutTimeout = null;
      void logCompletedCall(channel, startTime);
    }, 15 * 60 * 1000); 
  }
});

client.on('messageCreate', async (message) => {
  if (message.content === '!stopcall' && !message.author.bot) {
    const vID = process.env.VOICE_CHANNEL_ID;
    if (activeCalls.has(vID)) {
      const startTime = activeCalls.get(vID);
      const channel = await client.channels.fetch(vID);
      activeCalls.delete(vID);
      void logCompletedCall(channel, startTime);
      message.reply("🏁 **Session ended manually! Final log sent.**");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();
app.get("/", (req, res) => res.send("Online"));
app.listen(process.env.PORT || 3000);
