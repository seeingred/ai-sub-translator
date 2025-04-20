import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { SubtitleTrack, VideoInfo } from './types';
import { getFfmpegExecPath, getUserDataDir } from './ffmpeg';
import { promises as fsPromises } from 'fs';
const exec = promisify(childProcess.exec);
const { readFile, unlink: rmFile } = fsPromises;
export function parseFfmpegSubtitleStreams(output: string): SubtitleTrack[] {
    const lines = output.split('\n');
    const subtitles: SubtitleTrack[] = [];

    const streamRegex = /Stream #0:(\d+)(?:\((\w+)\))?: Subtitle: [^\s]+(?: \(([^\)]+)\))?(?: \(([^\)]+)\))?/i;
    const titleRegex = /title\s+:\s+(.+)/i;

    let currentIndex: string | null = null;
    let currentStream: SubtitleTrack | null = null;

    for (const line of lines) {
        const streamMatch = line.match(streamRegex);

        if (streamMatch) {
            const [, index, lang, flag1] = streamMatch;
            currentIndex = index;
            currentStream = {
                index: parseInt(index),
                language: lang,
                format: flag1,
            };
            subtitles.push(currentStream);
            continue;
        }

        if (currentStream && line.includes('Metadata')) continue;

        const titleMatch = line.match(titleRegex);
        if (titleMatch && currentStream) {
            currentStream.title = titleMatch[1].trim();
        }
    }

    return subtitles;
}

export async function detectSubtitles(videoPath: string, ffmpegPath: string): Promise<VideoInfo> {
    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file does not exist: ${videoPath}`);
    }

    let commandOutput = ''

    try {
        await exec(`"${ffmpegPath}" -i "${videoPath}"`);
    } catch (error) {
        commandOutput = error.message;
    }
    console.log(`commandOutput`, commandOutput);

    const subtitleTracks = parseFfmpegSubtitleStreams(commandOutput).filter((track) => track.format.includes('srt'));

    return {
        path: videoPath,
        subtitleTracks
    };
}

export async function extractSubtitle(videoPath: string, subtitleIndex: number): Promise<string> {
    const outputPath = path.join(getUserDataDir(), `subtitle.srt`);
    const ffmpegPath = getFfmpegExecPath(getUserDataDir());

    if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file does not exist: ${videoPath}`);
    }

    try {

        // Extract the subtitle track
        await exec(`"${ffmpegPath}" -i "${videoPath}" -map 0:${subtitleIndex} -y "${outputPath}"`);

        if (!fs.existsSync(outputPath)) {
            throw new Error('Subtitle extraction failed: Output file not created');
        }

        try {
            const text = await readFile(outputPath, 'utf8');
            return text;
        } catch (error) {
            console.error('Error reading subtitle file:', error);
            throw new Error(`Failed to read subtitle file: ${error.message || error}`);
        } finally {
            await rmFile(outputPath);
        }
    } catch (error) {
        console.error('Error extracting subtitle:', error);
        throw new Error(`Failed to extract subtitle: ${error.message || error}`);
    }
}