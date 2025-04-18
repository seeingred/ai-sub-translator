import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { SubtitleTrack, VideoInfo, ExtractSubtitleOptions } from './types';

const exec = promisify(childProcess.exec);

/**
 * Detects subtitle tracks available in a video file
 */
export async function detectSubtitles(videoPath: string, ffmpegPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file does not exist: ${videoPath}`);
  }

  try {
    // Use ffmpeg to list streams in the video file
    const { stdout } = await exec(`"${ffmpegPath}" -i "${videoPath}" -hide_banner -v error -of json -show_streams -select_streams s`);
    
    // Parse the JSON output
    const data = JSON.parse(stdout);
    
    // Extract subtitle tracks
    const subtitleTracks: SubtitleTrack[] = [];
    
    if (data.streams && Array.isArray(data.streams)) {
      data.streams.forEach((stream: any, index: number) => {
        if (stream.codec_type === 'subtitle') {
          const track: SubtitleTrack = {
            index: stream.index,
            language: stream.tags?.language || 'unknown',
            title: stream.tags?.title,
            format: stream.codec_name || 'unknown'
          };
          
          subtitleTracks.push(track);
        }
      });
    }
    
    return {
      path: videoPath,
      subtitleTracks
    };
  } catch (error) {
    console.error('Error detecting subtitles:', error);
    throw new Error(`Failed to detect subtitles: ${error.message || error}`);
  }
}

/**
 * Extracts a subtitle track from a video file
 */
export async function extractSubtitle(options: ExtractSubtitleOptions): Promise<string> {
  const { videoPath, subtitleIndex, outputPath, ffmpegPath } = options;
  
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file does not exist: ${videoPath}`);
  }
  
  try {
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Extract the subtitle track
    await exec(`"${ffmpegPath}" -i "${videoPath}" -map 0:${subtitleIndex} -y "${outputPath}"`);
    
    // Verify the file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Subtitle extraction failed: Output file not created');
    }
    
    console.log(`Subtitle extracted successfully to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error extracting subtitle:', error);
    throw new Error(`Failed to extract subtitle: ${error.message || error}`);
  }
}

/**
 * Determines the appropriate output file extension based on the subtitle format
 */
export function getSubtitleExtension(format: string): string {
  switch (format.toLowerCase()) {
    case 'srt':
    case 'subrip':
      return '.srt';
    case 'ass':
    case 'ssa':
      return '.ass';
    case 'vtt':
    case 'webvtt':
      return '.vtt';
    default:
      return '.srt'; // Default to .srt as a fallback
  }
}

/**
 * Cleans up temporary files created during subtitle extraction
 */
export function cleanupTempFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Temporary file deleted: ${filePath}`);
      } catch (error) {
        console.error(`Error deleting temporary file ${filePath}:`, error);
      }
    }
  }
} 