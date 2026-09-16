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
      
      // FORZATURA DI EMERGENZA FISSA A 864 ORE E 50 MINUTI
      const oreGiaPassateMs = ((864 * 60) + 50) * 60 * 1000; 
      
      // Inviamo direttamente il log definitivo nel canale di testo simulando la fine della chiamata
      void logCompletedCall(channel, Date.now() - oreGiaPassateMs);
      console.log(`[SUCCESSO] Log forzato delle 864 ore inviato su Discord!`);
    }
  } catch (error) {
    console.error(error.message);
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  // Disattivato per il recupero forzato
});

client.on('messageCreate', async (message) => {
  // Disattivato per il recupero forzato
});

client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();
app.get("/", (req, res) => res.send("Online"));
app.listen(process.env.PORT || 3000);
