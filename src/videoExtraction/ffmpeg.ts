import fs from 'fs';
import path from 'path';
import os from 'os';
import unzipper from 'unzipper';
import { XzReadableStream } from 'xz-decompress';
import { app } from 'electron';
import { extract as tarExtract } from 'tar';
import {
    detectSubtitles,
} from './subtitleExtractor';
import {
    FFmpegDownloadOptions,
    VideoInfo,
} from './types';

import { Readable } from 'stream';
import { promises as fsPromises } from 'fs';

// Use fs.promises directly instead of promisify
const { rename: moveFile, rmdir: removeDir, chmod: chmodFile, unlink: removeFile, stat: statFile, mkdir: makeDir } = fsPromises;

const URL_MAC_X64 = 'https://evermeet.cx/pub/ffmpeg/ffmpeg-7.1.1.zip';
const URL_MAC_ARM64 = 'https://www.osxexperts.net/ffmpeg711arm.zip';
const URL_LINUX_X64 = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
const URL_LINUX_ARM64 = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz';
const URL_WIN_X64 = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

export const initializeFFmpeg = async (options: FFmpegDownloadOptions): Promise<string> => {
    const downloadPath = getUserDataDir();
    const execPath = getFfmpegExecPath(downloadPath);

    if (execPath && fs.existsSync(execPath)) {
        console.log(`Using existing ffmpeg at ${execPath}`);
        return execPath;
    } else {
        options.outputDir = downloadPath;
    }

    return downloadFFmpeg(options);
}

const getExecName = () => {
    const platform = os.platform();
    const extension = platform === 'win32' ? '.exe' : '';
    return `ffmpeg${extension}`;
}

export const getFfmpegExecPath = (outputDir: string) => {
    return path.join(outputDir, getExecName());
}

const findExecutable = async (dir: string, execName: string): Promise<string | null> => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        console.log(`filePath`, filePath);
        let stat: fs.Stats;
        try {
            stat = await statFile(filePath);
        } catch (error) {
            console.error(`Error getting stats for file ${filePath}:`, error);
            continue;
        }
        console.log(`stat`, stat);
        if (stat.isFile() && execName === file) {
            return filePath;
        } else if (stat.isDirectory()) {
            const result = await findExecutable(filePath, execName);
            if (result) {
                return result;
            }
        }
    }
    return null;
}

export async function downloadFFmpeg(options: FFmpegDownloadOptions): Promise<string> {
    const platform = options.platform || os.platform();
    const arch = os.arch();
    console.log(`arch`, arch);

    const url = getFFmpegDownloadUrl(platform, arch);
    let extension = url.split('.').pop();
    if (extension === 'xz') {
        extension = 'tar.xz';
    }
    console.log(`url`, url);


    // Create directory if it doesn't exist
    if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
    }

    // Determine filename based on platform
    // const filename = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const filename = `ffmpeg.${extension}`;
    const outputPath = path.join(options.outputDir, filename);

    try {
        console.log(`Downloading ffmpeg from ${url}...`);

        // Download the file
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download ffmpeg: ${response.statusText}`);
        }

        // Get total size for progress calculation
        const totalSize = parseInt(response.headers.get('content-length') || '0', 10);

        // Create a readable stream from the response body
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Unable to read response body');
        }

        // Create a write stream to save the file
        const writer = fs.createWriteStream(outputPath);

        let receivedBytes = 0;

        // Process the data chunks
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            writer.write(Buffer.from(value));

            receivedBytes += value.length;

            // Report progress if callback provided
            if (options.onProgress && totalSize > 0) {
                const progress = receivedBytes / totalSize;
                options.onProgress(progress);
            }
        }

        writer.end();

        // Make the file executable on non-Windows platforms
        console.log(`outputPath`, outputPath);

        console.log(`FFmpeg downloaded successfully to ${outputPath}`);
    } catch (error) {
        console.error('Error downloading ffmpeg:', error);
        throw error;
    }
    // extract the file
    const extractDir = path.join(options.outputDir, 'extracted');
    if (extension === 'zip') {
        const zip = fs.createReadStream(outputPath);

        console.log(`extractDir`, extractDir);

        const extract = unzipper.Extract({ path: extractDir });
        zip.pipe(extract);

        try {
            await new Promise<void>((resolve, reject) => {
                zip.on('end', () => resolve());
                zip.on('error', reject);
            });
        } catch (error) {
            console.error('Error unzipping ffmpeg:', error);
            throw error;
        }
    } else if (extension === 'tar.xz') {
        try {
            const decompressedFilePath = path.join(getUserDataDir(), 'ffmpeg.tar');
            const decompressedFile = fs.createWriteStream(decompressedFilePath);

            const compressedFile = fs.createReadStream(outputPath);
            const webStream = Readable.toWeb(compressedFile);
            const decompressor = new XzReadableStream(webStream as ReadableStream<Uint8Array>);
            const reader = decompressor.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                decompressedFile.write(Buffer.from(value));
            }
            
            // Close the file
            decompressedFile.end();
            
            // Wait for file to be fully written
            await new Promise<void>((resolve, reject) => {
                decompressedFile.on('finish', resolve);
                decompressedFile.on('error', reject);
            });

            await makeDir(extractDir, { recursive: true });
            
            // Extract the tar file
            await tarExtract({
                file: decompressedFilePath,
                cwd: extractDir,
            });
            
            // Clean up temporary tar file
            await removeFile(decompressedFilePath);
        } catch (error) {
            console.error('Error decompressing ffmpeg:', error);
            throw error;
        }
    } else {
        console.log(`Archive format not supported: ${extension}`);
    }

    const execName = getExecName();
    const execOutputPath = getFfmpegExecPath(getUserDataDir());
    const execExtractedOutputPath = await findExecutable(extractDir, execName);


    try {
        await moveFile(execExtractedOutputPath, execOutputPath);
    } catch (error) {
        console.error('Error moving ffmpeg:', error);
        throw error;
    }
    try {
        await removeDir(extractDir, { recursive: true });
    } catch (error) {
        console.error('Error removing extracted directory:', error);
    }
    try {
        await removeFile(outputPath);
    } catch (error) {
        console.error('Error removing extracted file:', error);
    }
    if (platform !== 'win32') {
        try {
            await chmodFile(execOutputPath, 0o755);
        } catch (error) {
            console.error('Error chmodding ffmpeg:', error);
            throw error;
        }
    }
    return execOutputPath;

    return outputPath;
}

/**
 * Gets the appropriate ffmpeg download URL based on the platform
 */
function getFFmpegDownloadUrl(platform: string, arch: string): string {
    // Base URL for ffmpeg downloads

    // Determine correct URL based on platform and architecture
    switch (platform) {
        case 'win32':
            return URL_WIN_X64
        case 'darwin':
            // Handle both Intel and Apple Silicon
            return arch === 'arm64'
                ? URL_MAC_ARM64
                : URL_MAC_X64
        case 'linux':
            return arch === 'arm64'
                ? URL_LINUX_ARM64
                : URL_LINUX_X64
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}




// Default ffmpeg directory in app data
export const getUserDataDir = (): string => {
    if (app) {
        return path.join(app.getPath('userData'));
    } else {
        // Fallback for non-Electron environment (like tests)
        return path.join(os.tmpdir(), 'ai-sub-translator-ffmpeg');
    }
};

/**
 * Gets information about a video file, including available subtitle tracks
 */
export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
    // Ensure ffmpeg is available
    const ffmpegPath = await initializeFFmpeg({});

    return detectSubtitles(videoPath, ffmpegPath);
}
