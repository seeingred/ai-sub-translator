import fs from 'fs';
import path from 'path';
import os from 'os';

import { app } from 'electron';
import { 
  detectSubtitles,
  extractSubtitle,
  getSubtitleExtension,
  cleanupTempFiles 
} from './subtitleExtractor';
import { 
  FFmpegDownloadOptions,
  SubtitleTrack,
  VideoInfo,
  ExtractSubtitleOptions 
} from './types';

const URL_MAC_X64 = 'https://evermeet.cx/pub/ffmpeg/ffmpeg-7.1.1.zip';
const URL_MAC_ARM64 = 'https://www.osxexperts.net/ffmpeg711arm.zip';
const URL_LINUX_X64 = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
const URL_WIN_X64 = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';


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
        ? URL_MAC_X64
        : URL_MAC_ARM64
    case 'linux':
      return URL_LINUX_X64
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Downloads and saves the ffmpeg executable
 */
export async function downloadFFmpeg(options: FFmpegDownloadOptions): Promise<string> {
  const platform = options.platform || os.platform();
  const arch = os.arch();
  const url = getFFmpegDownloadUrl(platform, arch);
  console.log(`url`, url);
  
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }
  
  // Determine filename based on platform
  const filename = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
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
    if (platform !== 'win32') {
      fs.chmodSync(outputPath, 0o755);
    }
    
    console.log(`FFmpeg downloaded successfully to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error downloading ffmpeg:', error);
    throw error;
  }
}


export const initializeFFmpeg = async (options: FFmpegDownloadOptions): Promise<string> => {
  const downloadPath = getDefaultFFmpegDir();
  
  console.log(`downloadPath`, downloadPath);
  
  if (downloadPath && fs.existsSync(downloadPath)) {
    console.log(`Using existing ffmpeg at ${downloadPath}`);
    return downloadPath;
  } else {
    options.outputDir = downloadPath;
  }
  
  return downloadFFmpeg(options);
} 

// Default ffmpeg directory in app data
export const getDefaultFFmpegDir = (): string => {
  if (app) {
    return path.join(app.getPath('userData'), 'ffmpeg');
  } else {
    // Fallback for non-Electron environment (like tests)
    return path.join(os.tmpdir(), 'ai-sub-translator-ffmpeg');
  }
};

/**
 * Gets information about a video file, including available subtitle tracks
 */
// export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
//   // Ensure ffmpeg is available
//   const ffmpegPath = await initializeFFmpeg({});
  
//   return detectSubtitles(videoPath, ffmpegPath);
// }

/**
 * Extracts a subtitle from a video file
 */
// export async function extractSubtitleFromVideo(
//   videoPath: string,
//   subtitleIndex: number,
//   outputPath?: string
// ): Promise<string> {
//   // Ensure ffmpeg is available
//   const ffmpegPath = await initializeFFmpeg({});
  
//   // Get video info to determine subtitle format
//   const videoInfo = await detectSubtitles(videoPath, ffmpegPath);
  
//   // Find the selected subtitle track
//   const selectedTrack = videoInfo.subtitleTracks.find(track => track.index === subtitleIndex);
  
//   if (!selectedTrack) {
//     throw new Error(`No subtitle track found with index ${subtitleIndex}`);
//   }
  
//   // Determine output path if not provided
//   const finalOutputPath = outputPath || path.join(
//     path.dirname(videoPath),
//     `${path.basename(videoPath, path.extname(videoPath))}_${selectedTrack.language}${getSubtitleExtension(selectedTrack.format)}`
//   );
  
//   // Extract the subtitle
//   return extractSubtitle({
//     videoPath,
//     subtitleIndex,
//     outputPath: finalOutputPath,
//     ffmpegPath
//   });
// }