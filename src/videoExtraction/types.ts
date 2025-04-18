export interface FFmpegDownloadOptions {
  /**
   * Directory where the ffmpeg executable will be saved
   */
  outputDir?: string;
  
  /**
   * Platform to download ffmpeg for: 'darwin' (macOS), 'win32' (Windows), or 'linux'
   */
  platform?: string;
  
  /**
   * Progress callback function that receives download progress percentage
   */
  onProgress?: (progress: number) => void;
}

export interface SubtitleTrack {
  /**
   * Subtitle track index in the video file
   */
  index: number;
  
  /**
   * Language of the subtitle track (if available)
   */
  language: string;
  
  /**
   * Title of the subtitle track (if available)
   */
  title?: string;
  
  /**
   * Format of the subtitle track (srt, ass, etc.)
   */
  format: string;
}

export interface VideoInfo {
  /**
   * Full path to the video file
   */
  path: string;
  
  /**
   * List of subtitle tracks found in the video
   */
  subtitleTracks: SubtitleTrack[];
}

export interface ExtractSubtitleOptions {
  /**
   * Path to the video file
   */
  videoPath: string;
  
  /**
   * Index of the subtitle track to extract
   */
  subtitleIndex: number;
  
  /**
   * Output path where the subtitle file will be saved
   */
  outputPath: string;
  
  /**
   * Path to the ffmpeg executable
   */
  ffmpegPath: string;
} 