const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('path');
const http = require('http');

// Simple health check server
const PORT = process.env.PORT || 8080;
const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Multi-Bot System is running\n');
}).listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  
  // Keep-alive ping
  setInterval(() => {
    const protocol = appUrl.startsWith('https') ? require('https') : require('http');
    protocol.get(appUrl, (res) => {
      // console.log('Self-ping successful');
    }).on('error', (err) => {
      console.error('Self-ping failed:', err.message);
    });
  }, 10 * 60 * 1000); // 10 minutes
});

// Number of bots
const NUM_BOTS = 10;
const clients = [];

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function startBots() {
  console.log('Starting Discord Multi-Bot Voice System (Single Process Mode)...');

  for (let i = 0; i < NUM_BOTS; i++) {
    const token = process.env[`BOT_TOKEN_${i}`];
    if (!token) {
      console.error(`[ERROR] Token for Bot ${i + 1} (BOT_TOKEN_${i}) missing!`);
      continue;
    }

    console.log(`[DEBUG] Bot ${i + 1} preparing login...`);

    const audioFile = path.join(__dirname, `new${i + 1}.mp3`);
    
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });

    // Detailed debug logs
    client.on('debug', info => {
      console.log(`[JS-DEBUG] Bot ${i + 1}: ${info.substring(0, 100)}`);
    });

    client.on('ready', () => {
      console.log(`[SUCCESS] Bot ${i + 1} (${client.user.tag}) is ready!`);
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      const content = message.content.toLowerCase();

      if (content === '!join10' || content === '!join') {
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) return; // Silent return if user not in VC

        try {
          const voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
          });
          
          // Play audio automatically if start command or join10
          const audioPlayer = createAudioPlayer();
          const resource = createAudioResource(audioFile);
          voiceConnection.subscribe(audioPlayer);
          audioPlayer.play(resource);
          
          console.log(`Bot ${i + 1} joined and playing ${path.basename(audioFile)}`);
        } catch (err) {
          console.error(`Bot ${i + 1} Voice Error:`, err);
        }
      } else if (content === '!ds10' || content === '!leave') {
        const { getVoiceConnection } = require('@discordjs/voice');
        const connection = getVoiceConnection(message.guild.id);
        if (connection) connection.destroy();
      }
    });

    client.on('error', (err) => console.error(`[ERROR] Bot ${i + 1}:`, err));

    // LOGIN with 5 second delay to avoid Discord rate limits
    if (i > 0) {
      console.log(`Waiting 6 seconds before Bot ${i + 1} login...`);
      await delay(6000); 
    }

    try {
      await client.login(token);
      clients.push(client);
    } catch (err) {
      console.error(`[FATAL] Bot ${i + 1} Login Failed:`, err.message);
    }
  }
}

startBots();

process.on('SIGINT', () => {
  clients.forEach(c => c.destroy());
  process.exit(0);
});

process.on('SIGTERM', () => {
  clients.forEach(c => c.destroy());
  process.exit(0);
});