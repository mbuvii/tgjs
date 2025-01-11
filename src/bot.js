import TelegramBot from 'node-telegram-bot-api';
import youtubeDl from 'youtube-dl-exec';
import ytSearch from 'yt-search';
import { createWriteStream, unlink } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('Starting bot initialization...');

try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Load environment variables
    config();
    console.log('Environment variables loaded');

    const token = process.env.BOT_TOKEN;
    if (!token) {
        throw new Error('BOT_TOKEN must be provided!');
    }
    console.log('Bot token verified');

    const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
    console.log(`Downloads directory set to: ${DOWNLOADS_DIR}`);

    // Initialize bot with error handling
    const bot = new TelegramBot(token, { 
        polling: true,
        filepath: false // Disable file downloading to filesystem
    });

    bot.on('polling_error', (error) => {
        console.error('Polling error:', error);
    });

    // Basic error handler
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (error) => {
        console.error('Unhandled Rejection:', error);
    });

    // Rest of your bot code...
    
    console.log('Bot successfully started and listening...');
} catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
}
