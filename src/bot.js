import TelegramBot from 'node-telegram-bot-api';
import youtubeDl from 'youtube-dl-exec';
import ytSearch from 'yt-search';
import { createWriteStream, unlink } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN must be provided!');
}

const bot = new TelegramBot(token, { polling: true });
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        "👋 Hello! Send me a song name and I'll search YouTube for it.\n" +
        "You can then choose to download it as audio or video."
    );
});

// Handle text messages (search queries)
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        try {
            const results = await searchYoutube(msg.text);
            if (results.length === 0) {
                return bot.sendMessage(chatId, "Sorry, no results found!");
            }

            const keyboard = {
                inline_keyboard: results.map(video => ([{
                    text: video.title.substring(0, 50) + "...",
                    callback_data: `select_${video.videoId}`
                }]))
            };

            bot.sendMessage(chatId, "Select a song:", { reply_markup: keyboard });
        } catch (error) {
            console.error('Search error:', error);
            bot.sendMessage(chatId, "Sorry, an error occurred while searching.");
        }
    }
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        if (query.data.startsWith('select_')) {
            const videoId = query.data.split('_')[1];
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: "Audio (MP3)", callback_data: `dl_audio_${videoId}` }
                    ],
                    [
                        { text: "Video (360p)", callback_data: `dl_video_${videoId}_360` },
                        { text: "Video (720p)", callback_data: `dl_video_${videoId}_720` }
                    ]
                ]
            };

            await bot.editMessageText("Choose format:", {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            });
        } else if (query.data.startsWith('dl_')) {
            const [_, type, videoId, quality] = query.data.split('_');
            
            await bot.editMessageText("⏳ Downloading... Please wait.", {
                chat_id: chatId,
                message_id: messageId
            });

            try {
                const filePath = await downloadYoutube(videoId, type, quality);
                
                if (type === 'audio') {
                    await bot.sendAudio(chatId, filePath);
                } else {
                    await bot.sendVideo(chatId, filePath);
                }

                // Clean up
                unlink(filePath, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });

                await bot.editMessageText("✅ Download complete!", {
                    chat_id: chatId,
                    message_id: messageId
                });
            } catch (error) {
                console.error('Download error:', error);
                await bot.editMessageText("❌ Sorry, couldn't download this video. Please try another one.", {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
        }
    } catch (error) {
        console.error('Callback error:', error);
        bot.sendMessage(chatId, "An error occurred. Please try again.");
    }
});

async function searchYoutube(query) {
    try {
        const results = await ytSearch(query);
        return results.videos.slice(0, 5).map(video => ({
            title: video.title,
            videoId: video.videoId
        }));
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

async function downloadYoutube(videoId, type, quality) {
    const fileName = `${videoId}_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
        if (type === 'audio') {
            await youtubeDl(url, {
                extractAudio: true,
                audioFormat: 'mp3',
                output: filePath,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0'
                ]
            });
        } else {
            const videoQuality = quality === '720' ? '22' : '18'; // 22 for 720p, 18 for 360p
            await youtubeDl(url, {
                format: videoQuality,
                output: filePath,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0'
                ]
            });
        }
        return filePath;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

// Error handling for unhandled promises
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

console.log('Bot is running...');
