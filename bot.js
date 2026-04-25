require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('path');

// Bot index passed as argument (0-9)
const botIndex = parseInt(process.argv[2]) || 0;

// Discord bot tokens from environment variables
const tokens = [
  process.env.BOT_TOKEN_0,
  process.env.BOT_TOKEN_1,
  process.env.BOT_TOKEN_2,
  process.env.BOT_TOKEN_3,
  process.env.BOT_TOKEN_4,
  process.env.BOT_TOKEN_5,
  process.env.BOT_TOKEN_6,
  process.env.BOT_TOKEN_7,
  process.env.BOT_TOKEN_8,
  process.env.BOT_TOKEN_9
];

if (botIndex < 0 || botIndex >= tokens.length) {
  console.error(`Invalid bot index: ${botIndex}. Must be between 0 and ${tokens.length - 1}`);
  process.exit(1);
}

if (!tokens[botIndex]) {
  console.error(`Bot token not found for index ${botIndex}. Set BOT_TOKEN_${botIndex} in .env file`);
  process.exit(1);
}

const token = tokens[botIndex];
const audioFile = path.join(__dirname, `new${botIndex + 1}.mp3`);

console.log(`[DEBUG] Bot ${botIndex + 1} process started (PID: ${process.pid})`);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

console.log(`[DEBUG] Bot ${botIndex + 1} token defined: ${token ? 'YES' : 'NO'}`);
if (token) {
    console.log(`[DEBUG] Bot ${botIndex + 1} token length: ${token.length}`);
}

let voiceConnection = null;
let audioPlayer = null;

// Bot ready event
client.on('ready', () => {
  console.log(`Bot ${botIndex + 1} (${client.user.tag}) is ready!`);
});

// Error handling
client.on('error', (error) => {
  console.error(`Bot ${botIndex + 1} error:`, error);
});

client.on('voiceStateUpdate', (oldState, newState) => {
  // Handle voice state changes if needed
});

// Message handler
client.on('messageCreate', async (message) => {
  // Simple log to see if the bot is receiving messages
  console.log(`Bot ${botIndex + 1} received message: "${message.content}" from ${message.author.tag}`);

  if (message.author.bot) return;

  const member = message.member;
  if (!member) return;

  const voiceChannel = member.voice.channel;

  try {
    // Commands: !join, !start, !stop, !leave
    // Or keep the '10' if the user specifically wants that, but usually !join is better for all bots
    if (message.content === '!join' || message.content === '!join10') {
      if (!voiceChannel) {
        return message.reply('You must be in a voice channel to use this command.').catch(console.error);
      }

      // Check if already connected
      if (voiceConnection) {
        return message.reply(`Bot ${botIndex + 1} is already in a voice channel.`).catch(console.error);
      }

      // Join voice channel
      voiceConnection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      console.log(`Bot ${botIndex + 1} joined voice channel: ${voiceChannel.name}`);
      message.reply(`Bot ${botIndex + 1} joined!`).catch(console.error);

    } else if (message.content === '!start' || message.content === '!st10') {
      if (!voiceConnection) {
        return message.reply(`Bot ${botIndex + 1} is not in a voice channel. Use !join first.`).catch(console.error);
      }

      // Stop any existing playback
      if (audioPlayer) {
        audioPlayer.stop();
      }

      // Create new audio player and resource
      audioPlayer = createAudioPlayer();
      const audioResource = createAudioResource(audioFile);

      // Subscribe to voice connection
      voiceConnection.subscribe(audioPlayer);

      // Play audio
      audioPlayer.play(audioResource);

      console.log(`Bot ${botIndex + 1} started playing: ${path.basename(audioFile)}`);

      // Handle playback finish
      audioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log(`Bot ${botIndex + 1} finished playing audio`);
      });

      // Handle errors
      audioPlayer.on('error', (error) => {
        console.error(`Bot ${botIndex + 1} audio player error:`, error);
      });

    } else if (message.content === '!stop' || message.content === '!sp10') {
      if (audioPlayer) {
        audioPlayer.stop();
        audioPlayer = null;
        console.log(`Bot ${botIndex + 1} stopped audio playback`);
        message.reply(`Bot ${botIndex + 1} stopped.`).catch(console.error);
      }

    } else if (message.content === '!leave' || message.content === '!ds10') {
      if (voiceConnection) {
        voiceConnection.destroy();
        voiceConnection = null;
        console.log(`Bot ${botIndex + 1} disconnected from voice channel`);
        message.reply(`Bot ${botIndex + 1} left.`).catch(console.error);
      }

      if (audioPlayer) {
        audioPlayer.stop();
        audioPlayer = null;
      }
    }
  } catch (error) {
    console.error(`Bot ${botIndex + 1} command error:`, error);
    message.reply('An error occurred while processing the command.').catch(console.error);
  }
});

// Login with token
client.login(token).catch((error) => {
  console.error(`Bot ${botIndex + 1} login failed:`, error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`Shutting down Bot ${botIndex + 1}...`);
  if (voiceConnection) {
    voiceConnection.destroy();
  }
  if (audioPlayer) {
    audioPlayer.stop();
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`Shutting down Bot ${botIndex + 1}...`);
  if (voiceConnection) {
    voiceConnection.destroy();
  }
  if (audioPlayer) {
    audioPlayer.stop();
  }
  client.destroy();
  process.exit(0);
});