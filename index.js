const { fork } = require('child_process');
const path = require('path');
const http = require('http');
require('dotenv').config({ quiet: true });

// Simple health check server for hosting platforms (Koyeb, Render, etc.)
const PORT = process.env.PORT || 10000;
const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const TOTAL_BOTS = 10;
const BOT_START_DELAY_MS = Number(process.env.BOT_START_DELAY_MS || (process.env.NODE_ENV === 'production' ? 5000 : 1000));
const BASE_RESTART_DELAY_MS = Number(process.env.BOT_RESTART_DELAY_MS || 5000);
const MAX_RESTART_DELAY_MS = Number(process.env.BOT_MAX_RESTART_DELAY_MS || 60000);

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  
  // Keep-alive ping every 10 minutes
  setInterval(() => {
    const protocol = appUrl.startsWith('https') ? require('https') : require('http');
    protocol.get(appUrl, (res) => {
      console.log('Self-ping successful');
    }).on('error', (err) => {
      console.error('Self-ping failed:', err.message);
    });
  }, 10 * 60 * 1000); // 10 minutes
});

// Check if tokens are set
console.log('Validating environment variables...');
const allBotIndexes = Array.from({ length: TOTAL_BOTS }, (_, i) => i);
const enabledBotIndexes = [];
const missingTokens = [];
for (const i of allBotIndexes) {
  if (!process.env[`BOT_TOKEN_${i}`]) {
    missingTokens.push(`BOT_TOKEN_${i}`);
  } else {
    enabledBotIndexes.push(i);
  }
}

if (missingTokens.length > 0) {
  console.warn(`\n[WARNING] The following environment variables are missing: ${missingTokens.join(', ')}`);
  console.warn('The bots associated with these tokens will be skipped.\n');
} else {
  console.log(`[SUCCESS] All ${TOTAL_BOTS} bot tokens are present in environment.\n`);
}

if (enabledBotIndexes.length === 0) {
  console.error('[FATAL] No valid BOT_TOKEN_* environment variables found. Exiting.');
  process.exit(1);
}

console.log(`[INFO] ${enabledBotIndexes.length}/${TOTAL_BOTS} bots are configured and will be started.`);

// Array to hold child processes
const bots = [];
const restartAttempts = new Map();
let isShuttingDown = false;

// Optimized bot spawning with better resource management
function startBot(index) {
  if (!process.env[`BOT_TOKEN_${index}`]) {
    return;
  }

  console.log(`Starting Bot ${index + 1}...`);

  const botProcess = fork(path.join(__dirname, 'bot.js'), [index.toString()], {
    stdio: 'inherit',
    env: { ...process.env, BOT_INDEX: index },
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    detached: false,
    windowsHide: true
  });

  botProcess.on('exit', (code, signal) => {
    console.warn(`Bot ${index + 1} exited with code ${code}, signal ${signal}`);
    if (isShuttingDown) {
      return;
    }

    // Auto-restart with exponential backoff
    if (code !== 0 && code !== null) {
      const attempt = (restartAttempts.get(index) || 0) + 1;
      restartAttempts.set(index, attempt);

      const restartDelay = Math.min(
        MAX_RESTART_DELAY_MS,
        BASE_RESTART_DELAY_MS * Math.pow(2, attempt - 1)
      );

      console.log(
        `Restarting Bot ${index + 1} in ${Math.round(restartDelay / 1000)} seconds (attempt ${attempt})...`
      );
      setTimeout(() => startBot(index), restartDelay);
    } else {
      restartAttempts.delete(index);
    }
  });

  botProcess.on('error', (error) => {
    console.error(`Bot ${index + 1} process error:`, error.message);
  });

  bots[index] = botProcess;
}

// Start all bots with minimal resource usage
console.log('Starting Discord Multi-Bot Voice System (512MB total)...');
for (let i = 0; i < enabledBotIndexes.length; i++) {
  const botIndex = enabledBotIndexes[i];
  // Staggered startup to reduce Discord login timeouts on low-CPU hosts
  setTimeout(() => {
    startBot(botIndex);
  }, i * BOT_START_DELAY_MS);
}

// Track startup completion
setTimeout(() => {
  console.log(`[SUCCESS] Startup sequence triggered for ${enabledBotIndexes.length} bot(s). Press Ctrl+C to stop.`);
}, enabledBotIndexes.length * BOT_START_DELAY_MS + 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  isShuttingDown = true;
  console.log('\nShutting down all bots...');
  bots.forEach((bot, index) => {
    if (bot && !bot.killed) {
      console.log(`Terminating Bot ${index + 1}...`);
      bot.kill('SIGINT');
    }
  });

  // Wait a bit for bots to shut down
  setTimeout(() => {
    console.log('All bots shut down. Exiting...');
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  console.log('\nShutting down all bots...');
  bots.forEach((bot, index) => {
    if (bot && !bot.killed) {
      console.log(`Terminating Bot ${index + 1}...`);
      bot.kill('SIGTERM');
    }
  });

  setTimeout(() => {
    console.log('All bots shut down. Exiting...');
    process.exit(0);
  }, 2000);
});

// Optional: Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});