import * as fs from 'fs';
import * as path from 'path';
import { serverState } from './serverState';
import { getVideoInfo, initializeFFmpeg } from './videoExtraction/ffmpeg';
import { extractSubtitle } from './videoExtraction/subtitleExtractor';
import handleSubtitleServer from './handleSubtitleServer';

export const serverApiHandlers = {
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

    // Create a new session
    'session.create': async (args: any[], callback: any) => {
        try {
            const sessionId = serverState.createSession();
            callback(null, { sessionId });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Get session info
    'session.get': async (args: any[], callback: any) => {
        try {
            const [sessionId] = args;
            if (!sessionId) {
                callback({ code: -32602, message: 'Invalid params: sessionId required' });
                return;
            }

            const session = serverState.getSession(sessionId);
            if (!session) {
                callback({ code: -32603, message: 'Session not found' });
                return;
            }

            callback(null, session);
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Delete a session
    'session.delete': async (args: any[], callback: any) => {
        try {
            const [sessionId] = args;
            if (!sessionId) {
                callback({ code: -32602, message: 'Invalid params: sessionId required' });
                return;
            }

            const deleted = serverState.deleteSession(sessionId);
            callback(null, { success: deleted });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Load a file (video or subtitle)
    'file.load': async (args: any[], callback: any) => {
        try {
            const [sessionId, filePath] = args;
            if (!sessionId || !filePath) {
                callback({ code: -32602, message: 'Invalid params: sessionId and filePath required' });
                return;
            }

            const session = serverState.getSession(sessionId);
            if (!session) {
                callback({ code: -32603, message: 'Session not found' });
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
                serverState.updateSession(sessionId, {
                    loadedFile: {
                        path: filePath,
                        type: 'subtitle',
                        content
                    }
                });
                callback(null, {
                    type: 'subtitle',
                    path: filePath,
                    contentLength: content.length
                });
            }
            // Otherwise treat as video file
            else {
                const videoInfo = await getVideoInfo(filePath);
                serverState.updateSession(sessionId, {
                    loadedFile: {
                        path: filePath,
                        type: 'video',
                        videoInfo
                    }
                });
                callback(null, {
                    type: 'video',
                    path: filePath,
                    videoInfo
                });
            }
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Get available subtitles for loaded video
    'subtitles.list': async (args: any[], callback: any) => {
        try {
            const [sessionId] = args;
            if (!sessionId) {
                callback({ code: -32602, message: 'Invalid params: sessionId required' });
                return;
            }

            const session = serverState.getSession(sessionId);
            if (!session) {
                callback({ code: -32603, message: 'Session not found' });
                return;
            }

            if (!session.loadedFile || session.loadedFile.type !== 'video') {
                callback({ code: -32603, message: 'No video file loaded in session' });
                return;
            }

            const subtitles = session.loadedFile.videoInfo?.subtitleTracks || [];
            callback(null, {
                subtitles: subtitles.map((sub: any, index: number) => ({
                    id: index,
                    language: sub.language || 'Unknown',
                    codec: sub.format,
                    title: sub.title || `Subtitle ${index + 1}`
                }))
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Extract subtitle from video by ID
    'subtitle.extract': async (args: any[], callback: any) => {
        try {
            const [sessionId, subtitleId] = args;
            if (!sessionId || subtitleId === undefined) {
                callback({ code: -32602, message: 'Invalid params: sessionId and subtitleId required' });
                return;
            }

            const session = serverState.getSession(sessionId);
            if (!session) {
                callback({ code: -32603, message: 'Session not found' });
                return;
            }

            if (!session.loadedFile || session.loadedFile.type !== 'video') {
                callback({ code: -32603, message: 'No video file loaded in session' });
                return;
            }

            const extractedContent = await extractSubtitle(
                session.loadedFile.path,
                subtitleId
            );

            serverState.updateSession(sessionId, {
                loadedFile: {
                    ...session.loadedFile,
                    extractedSubtitle: extractedContent
                }
            });

            callback(null, {
                success: true,
                contentLength: extractedContent.length
            });
        } catch (error) {
            callback({ code: -32000, message: error.message });
        }
    },

    // Start translation job
    'translation.start': async (args: any[], callback: any) => {
        try {
            const [sessionId, options] = args;
            if (!sessionId || !options) {
                callback({ code: -32602, message: 'Invalid params: sessionId and options required' });
                return;
            }

            const { apiKey, language, context, model, batchSize } = options;
            if (!apiKey || !language) {
                callback({ code: -32602, message: 'Invalid params: apiKey and language required in options' });
                return;
            }

            const session = serverState.getSession(sessionId);
            if (!session) {
                callback({ code: -32603, message: 'Session not found' });
                return;
            }

            // Determine what to translate
            let textToTranslate: string | undefined;

            if (session.loadedFile?.type === 'subtitle') {
                textToTranslate = session.loadedFile.content;
            } else if (session.loadedFile?.extractedSubtitle) {
                textToTranslate = session.loadedFile.extractedSubtitle;
            }

            if (!textToTranslate) {
                callback({ code: -32603, message: 'No subtitle content to translate. Load a subtitle file or extract from video first.' });
                return;
            }

            // Create translation job
            const jobId = serverState.createJob(sessionId, {
                apiKey,
                language,
                context: context || '',
                model: model || 'gemini-1.5-flash-8b',
                batchSize: batchSize || 50
            });

            // Start translation asynchronously
            const job = serverState.getJob(jobId);
            if (!job) {
                callback({ code: -32000, message: 'Failed to create job' });
                return;
            }

            // Start translation in background
            handleSubtitleServer({
                text: textToTranslate,
                apiKey,
                language,
                pieceNameOrContext: context || '',
                model: model || 'gemini-1.5-flash-8b',
                batchSize: batchSize || 50
            }, (progress) => {
                serverState.updateJobProgress(jobId, progress);
            }).then(result => {
                serverState.completeJob(jobId, result);
            }).catch(error => {
                serverState.failJob(jobId, error.message);
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
            const [jobId] = args;
            if (!jobId) {
                callback({ code: -32602, message: 'Invalid params: jobId required' });
                return;
            }

            const job = serverState.getJob(jobId);
            if (!job) {
                callback({ code: -32603, message: 'Job not found' });
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
            const [jobId] = args;
            if (!jobId) {
                callback({ code: -32602, message: 'Invalid params: jobId required' });
                return;
            }

            const job = serverState.getJob(jobId);
            if (!job) {
                callback({ code: -32603, message: 'Job not found' });
                return;
            }

            if (job.status !== 'completed') {
                callback({ code: -32603, message: `Job not completed. Current status: ${job.status}` });
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
            const [jobId, filePath] = args;
            if (!jobId || !filePath) {
                callback({ code: -32602, message: 'Invalid params: jobId and filePath required' });
                return;
            }

            const job = serverState.getJob(jobId);
            if (!job) {
                callback({ code: -32603, message: 'Job not found' });
                return;
            }

            if (job.status !== 'completed' || !job.result) {
                callback({ code: -32603, message: 'Translation not completed' });
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

    // List all active sessions (for debugging)
    'sessions.list': async (args: any[], callback: any) => {
        try {
            const sessions = serverState.getAllSessions();
            callback(null, {
                sessions: sessions.map(s => ({
                    id: s.id,
                    hasFile: !!s.loadedFile,
                    fileType: s.loadedFile?.type,
                    hasJob: !!s.translationJob,
                    jobStatus: s.translationJob?.status
                }))
            });
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
        callback(null, {
            name: 'AI Subtitle Translator Server',
            version: '0.3.0',
            api: 'workflow-based',
            endpoints: [
                'session.create',
                'session.get',
                'session.delete',
                'file.load',
                'subtitles.list',
                'subtitle.extract',
                'translation.start',
                'translation.status',
                'translation.result',
                'translation.save',
                'sessions.list',
                'ping',
                'info'
            ]
        });
    }
};