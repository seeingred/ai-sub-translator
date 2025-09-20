import * as fs from 'fs';
import * as path from 'path';
import { serverState } from './simpleServerState';
import { getVideoInfo, initializeFFmpeg } from './videoExtraction/ffmpeg';
import { extractSubtitle } from './videoExtraction/subtitleExtractor';
import handleSubtitleServer from './handleSubtitleServer';

// Global variable to track current translation task
let currentTranslationTask: Promise<void> | null = null;

export const simpleServerApiHandlers = {
    // Initialize FFmpeg (called automatically on startup)
    'init': async (args: any[], callback: any) => {
        try {
            const result = await initializeFFmpeg({});
            callback(null, {
                success: true,
                ffmpegPath: result
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Load a file (video or subtitle) - replaces any existing file
    'file.load': async (args: any[], callback: any) => {
        try {
            const [filePath] = args;
            if (!filePath) {
                callback({ code: -32602, message: 'Invalid params: filePath required' });
                return;
            }

            if (!fs.existsSync(filePath)) {
                callback({ code: -32603, message: 'File not found' });
                return;
            }

            const ext = path.extname(filePath).toLowerCase();

            // Check if it's a subtitle file
            if (ext === '.srt' || ext === '.vtt' || ext === '.sub') {
                const content = fs.readFileSync(filePath, 'utf-8');
                serverState.loadFile(filePath, 'subtitle', content);

                callback(null, {
                    type: 'subtitle',
                    path: filePath,
                    contentLength: content.length
                });
            }
            // Otherwise treat as video file
            else {
                const videoInfo = await getVideoInfo(filePath);
                serverState.loadFile(filePath, 'video', undefined, videoInfo);

                callback(null, {
                    type: 'video',
                    path: filePath,
                    subtitles: videoInfo.subtitleTracks.map((sub, index) => ({
                        id: index,
                        language: sub.language || 'Unknown',
                        format: sub.format,
                        title: sub.title || `Subtitle ${index + 1}`
                    }))
                });
            }
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Get current loaded file info
    'file.info': async (args: any[], callback: any) => {
        try {
            const file = serverState.getLoadedFile();
            if (!file) {
                callback({ code: -32603, message: 'No file loaded' });
                return;
            }

            const response: any = {
                path: file.path,
                type: file.type
            };

            if (file.type === 'subtitle') {
                response.contentLength = file.content?.length || 0;
                response.hasContent = !!file.content;
            } else if (file.type === 'video') {
                response.subtitles = file.videoInfo?.subtitleTracks.map((sub, index) => ({
                    id: index,
                    language: sub.language || 'Unknown',
                    format: sub.format,
                    title: sub.title || `Subtitle ${index + 1}`
                })) || [];
                response.hasExtractedSubtitle = !!file.extractedSubtitle;
            }

            callback(null, response);
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Extract subtitle from video by ID
    'subtitle.extract': async (args: any[], callback: any) => {
        try {
            const [subtitleId] = args;
            if (subtitleId === undefined) {
                callback({ code: -32602, message: 'Invalid params: subtitleId required' });
                return;
            }

            const file = serverState.getLoadedFile();
            if (!file) {
                callback({ code: -32603, message: 'No file loaded. Load a video file first.' });
                return;
            }

            if (file.type !== 'video') {
                callback({ code: -32603, message: 'Current file is not a video. Load a video file first.' });
                return;
            }

            const extractedContent = await extractSubtitle(file.path, subtitleId);
            serverState.setExtractedSubtitle(extractedContent);

            callback(null, {
                success: true,
                contentLength: extractedContent.length
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Start translation job (cancels any existing job)
    'translation.start': async (args: any[], callback: any) => {
        try {
            const [options] = args;
            if (!options) {
                callback({ code: -32602, message: 'Invalid params: options required' });
                return;
            }

            const { apiKey, language, context, model, batchSize } = options;
            if (!apiKey || !language) {
                callback({ code: -32602, message: 'Invalid params: apiKey and language required' });
                return;
            }

            if (!serverState.hasFile()) {
                callback({ code: -32603, message: 'No file loaded. Load a file first.' });
                return;
            }

            if (!serverState.hasSubtitleContent()) {
                callback({ code: -32603, message: 'No subtitle content available. Load a subtitle file or extract from video first.' });
                return;
            }

            const textToTranslate = serverState.getSubtitleContent();
            if (!textToTranslate) {
                callback({ code: -32603, message: 'Failed to get subtitle content' });
                return;
            }

            // Cancel any existing translation task
            if (currentTranslationTask) {
                console.log('Cancelling existing translation task...');
                currentTranslationTask = null;
            }

            // Start new translation job
            const jobId = serverState.startJob({
                apiKey,
                language,
                context: context || '',
                model: model || 'gemini-1.5-flash-8b',
                batchSize: batchSize || 50
            });

            // Start translation in background
            currentTranslationTask = handleSubtitleServer({
                text: textToTranslate,
                apiKey,
                language,
                pieceNameOrContext: context || '',
                model: model || 'gemini-1.5-flash-8b',
                batchSize: batchSize || 50
            }, (progress) => {
                serverState.updateJobProgress(progress);
            }).then(result => {
                serverState.completeJob(result);
                currentTranslationTask = null;
            }).catch(error => {
                serverState.failJob(error.message);
                currentTranslationTask = null;
            });

            callback(null, {
                jobId,
                status: 'started'
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Get translation job status
    'translation.status': async (args: any[], callback: any) => {
        try {
            const job = serverState.getCurrentJob();

            if (job.status === 'idle') {
                callback({ code: -32603, message: 'No active translation job' });
                return;
            }

            callback(null, {
                id: job.id,
                status: job.status,
                progress: Math.round(job.progress * 100),
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                error: job.error
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Get translation result
    'translation.result': async (args: any[], callback: any) => {
        try {
            const job = serverState.getCurrentJob();

            if (job.status === 'idle') {
                callback({ code: -32603, message: 'No translation job found' });
                return;
            }

            if (job.status !== 'completed') {
                callback({ code: -32603, message: `Translation not completed. Current status: ${job.status}` });
                return;
            }

            callback(null, {
                translatedText: job.result,
                completedAt: job.completedAt
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Save translation result to file
    'translation.save': async (args: any[], callback: any) => {
        try {
            const [filePath] = args;
            if (!filePath) {
                callback({ code: -32602, message: 'Invalid params: filePath required' });
                return;
            }

            const job = serverState.getCurrentJob();

            if (job.status !== 'completed' || !job.result) {
                callback({ code: -32603, message: 'No completed translation to save' });
                return;
            }

            fs.writeFileSync(filePath, job.result, 'utf-8');
            callback(null, {
                success: true,
                path: filePath,
                size: job.result.length
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Clear current file and job
    'clear': async (args: any[], callback: any) => {
        try {
            serverState.clearFile();
            currentTranslationTask = null;
            callback(null, { success: true });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Health check
    'ping': (args: any[], callback: any) => {
        callback(null, 'pong');
    },

    // Get server info
    'info': (args: any[], callback: any) => {
        const file = serverState.getLoadedFile();
        const job = serverState.getCurrentJob();

        callback(null, {
            name: 'AI Subtitle Translator Server',
            version: '1.0.0',
            api: 'simple-stateless',
            currentFile: file ? {
                type: file.type,
                path: file.path
            } : null,
            currentJob: job.status !== 'idle' ? {
                status: job.status,
                progress: Math.round(job.progress * 100)
            } : null,
            endpoints: [
                'file.load',
                'file.info',
                'subtitle.extract',
                'translation.start',
                'translation.status',
                'translation.result',
                'translation.save',
                'clear',
                'ping',
                'info'
            ]
        });
    }
};