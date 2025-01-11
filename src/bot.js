import TelegramBot from 'node-telegram-bot-api';
import ytdl from 'ytdl-core';
import ytSearch from 'yt-search';
import { createWriteStream, unlink } from 'fs';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN must be provided!');
}

const bot = new TelegramBot(token, { polling: true });

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

    if (query.data.startsWith('select_')) {
        const videoId = query.data.split('_')[1];
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "Audio (128kbps)", callback_data: `dl_audio_${videoId}_128` },
                    { text: "Audio (320kbps)", callback_data: `dl_audio_${videoId}_320` }
                ],
                [
                    { text: "Video (360p)", callback_data: `dl_video_${videoId}_360` },
                    { text: "Video (720p)", callback_data: `dl_video_${videoId}_720` }
                ]
            ]
        };

        bot.editMessageText("Choose format:", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    } else if (query.data.startsWith('dl_')) {
        const [_, type, videoId, quality] = query.data.split('_');
        
        bot.editMessageText("⏳ Downloading... Please wait.", {
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
        } catch (error) {
            console.error('Download error:', error);
            bot.sendMessage(chatId, "Sorry, an error occurred while downloading.");
        }
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
    const filePath = path.join('downloads', fileName);

    return new Promise((resolve, reject) => {
        const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            quality: type === 'audio' ? 'highestaudio' : 'highest',
            filter: type === 'audio' ? 'audioonly' : 'videoandaudio'
        });

        stream.pipe(createWriteStream(filePath))
            .on('finish', () => resolve(filePath))
            .on('error', reject);
    });
}

console.log('Bot is running...');
