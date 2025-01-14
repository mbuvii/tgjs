import TelegramBot from 'node-telegram-bot-api';
import youtubeDl from 'youtube-dl-exec';
import ytSearch from 'yt-search';
import { createWriteStream, unlink, mkdirSync } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('Starting bot initialization...');

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

// Ensure downloads directory exists
try {
    mkdirSync(DOWNLOADS_DIR, { recursive: true });
    console.log('Downloads directory created/verified');
} catch (error) {
    console.error('Error creating downloads directory:', error);
}

// Download function
async function downloadYoutube(videoId, type, quality) {
    try {
        const timestamp = Date.now();
        const filePath = path.join(DOWNLOADS_DIR, `${videoId}_${timestamp}${type === 'audio' ? '.mp3' : '.mp4'}`);
        
        console.log('Starting download with options:', { videoId, type, quality, filePath });

        const options = {
            ...(type === 'audio' ? {
                extractAudio: true,
                audioFormat: 'mp3',
            } : {
                format: quality === '720' ? 'best[height<=720]' : 'best[height<=360]',
            }),
            output: filePath,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0'
            ]
        };

        console.log('Executing youtube-dl with options:', options);
        await youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, options);
        console.log('Download completed successfully');
        
        return filePath;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

try {
    // Load environment variables
    config();
    console.log('Environment variables loaded');

    const token = process.env.BOT_TOKEN;
    if (!token) {
        throw new Error('BOT_TOKEN must be provided!');
    }
    console.log('Bot token verified');

    // Initialize bot
    const bot = new TelegramBot(token, {
        polling: {
            interval: 300,
            autoStart: true,
            params: {
                timeout: 10
            }
        }
    });

    // Test connection
    bot.getMe().then((botInfo) => {
        console.log('Bot info:', botInfo);
        console.log('Connection to Telegram successful!');
    }).catch((error) => {
        console.error('Failed to get bot info:', error);
    });

    // Handle /start command
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

    // Handle messages
    bot.on('message', async (msg) => {
        console.log('Received message:', msg.text, 'from:', msg.from.id);
        if (msg.text && !msg.text.startsWith('/')) {
            const chatId = msg.chat.id;
            try {
                console.log('Searching for:', msg.text);
                
                // Send "searching" message
                const searchingMsg = await bot.sendMessage(chatId, "🔎 Searching...");
                
                // Perform the search
                const results = await ytSearch(msg.text);
                console.log('Search results:', results.videos.length, 'videos found');
                
                if (!results.videos.length) {
                    await bot.sendMessage(chatId, "❌ No results found.");
                    return;
                }

                // Get the first 5 results
                const videos = results.videos.slice(0, 5);
                
                // Create inline keyboard
                const keyboard = videos.map(video => ([{
                    text: `${video.title} (${video.timestamp})`,
                    callback_data: `select_${video.videoId}`
                }]));

                // Edit the "searching" message with results
                await bot.editMessageText(
                    "🎵 Select a video to download:",
                    {
                        chat_id: chatId,
                        message_id: searchingMsg.message_id,
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    }
                );
                
                console.log('Sent results to user');
            } catch (error) {
                console.error('Error handling message:', error);
                bot.sendMessage(chatId, "Sorry, an error occurred while processing your request.")
                    .catch(err => console.error('Failed to send error message:', err));
            }
        }
    });

    // Handle callback queries
    bot.on('callback_query', async (query) => {
        console.log('Received callback query:', query.data);
        const chatId = query.message.chat.id;
        
        try {
            if (query.data.startsWith('select_')) {
                const videoId = query.data.split('_')[1];
                
                const keyboard = [
                    [{text: "🎵 Audio (MP3)", callback_data: `audio_${videoId}`}],
                    [{text: "🎬 Video (360p)", callback_data: `video_360_${videoId}`}],
                    [{text: "🎬 Video (720p)", callback_data: `video_720_${videoId}`}]
                ];
                
                await bot.editMessageText(
                    "Choose format:",
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id,
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    }
                );
            } else if (query.data.startsWith('audio_') || query.data.startsWith('video_')) {
                const parts = query.data.split('_');
                const type = parts[0];
                const videoId = parts[parts.length - 1];
                const quality = parts[1] === '720' ? '720' : '360';
                
                await bot.editMessageText(
                    "⏳ Download started...",
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id
                    }
                );
                
                try {
                    console.log('Starting download:', {type, videoId, quality});
                    const filePath = await downloadYoutube(videoId, type, quality);
                    console.log('Download completed:', filePath);
                    
                    await bot.sendMessage(chatId, "✅ Download completed! Sending file...");
                    await bot.sendDocument(chatId, filePath);
                    
                    // Clean up
                    unlink(filePath, (err) => {
                        if (err) console.error('Error deleting file:', err);
                        else console.log('Cleanup: Deleted file', filePath);
                    });
                } catch (downloadError) {
                    console.error('Download failed:', downloadError);
                    await bot.sendMessage(chatId, "❌ Sorry, download failed. Please try another video or format.");
                }
            }
        } catch (error) {
            console.error('Error handling callback query:', error);
            bot.sendMessage(chatId, "Sorry, an error occurred. Please try again.")
                .catch(err => console.error('Failed to send error message:', err));
        }
    });

    // Add error handlers
    bot.on('polling_error', (error) => {
        console.error('Polling error:', error);
    });

    bot.on('error', (error) => {
        console.error('Bot error:', error);
    });

    console.log('Bot successfully started and listening...');

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
