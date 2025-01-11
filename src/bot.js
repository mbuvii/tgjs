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

    // Initialize bot with detailed options
    const bot = new TelegramBot(token, {
        polling: {
            interval: 300,
            autoStart: true,
            params: {
                timeout: 10
            }
        }
    });

    // Add polling error handler
    bot.on('polling_error', (error) => {
        console.error('Polling error:', error);
    });

    // Add webhook error handler
    bot.on('webhook_error', (error) => {
        console.error('Webhook error:', error);
    });

    // Add error handler
    bot.on('error', (error) => {
        console.error('Bot error:', error);
    });

    // Test the connection
    bot.getMe().then((botInfo) => {
        console.log('Bot info:', botInfo);
        console.log('Connection to Telegram successful!');
    }).catch((error) => {
        console.error('Failed to get bot info:', error);
    });

    // Handle /start command with logging
    bot.onText(/\/start/, (msg) => {
        console.log('Received /start command from:', msg.from.id);
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 
            "👋 Hello! Send me a song name and I'll search YouTube for it.\n" +
            "You can then choose to download it as audio or video."
        ).then(() => {
            console.log('Sent welcome message to:', chatId);
        }).catch((error) => {
            console.error('Failed to send welcome message:', error);
        });
    });

    // Handle text messages with logging
    bot.on('message', async (msg) => {
        console.log('Received message:', msg.text, 'from:', msg.from.id);
        if (msg.text && !msg.text.startsWith('/')) {
            const chatId = msg.chat.id;
            try {
                // ... rest of your message handling code ...
            } catch (error) {
                console.error('Error handling message:', error);
                bot.sendMessage(chatId, "Sorry, an error occurred while processing your request.")
                    .catch(err => console.error('Failed to send error message:', err));
            }
        }
    });

    console.log('Bot successfully started and listening...');

    // Keep the process alive
    process.on('SIGINT', () => {
        console.log('Received SIGINT. Stopping bot...');
        bot.stopPolling();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('Received SIGTERM. Stopping bot...');
        bot.stopPolling();
        process.exit(0);
    });

} catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
}

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});
