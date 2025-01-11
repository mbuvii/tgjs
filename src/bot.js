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

// ... (previous code remains the same) ...

async function downloadYoutube(videoId, type, quality) {
    const fileName = `${videoId}_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    try {
        const options = {
            binaryPath: '/usr/bin/python3',
            pythonPath: '/usr/bin/python3',
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

        await youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, options);
        return filePath;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

// ... (rest of the code remains the same) ...
