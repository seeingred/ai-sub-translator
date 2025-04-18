import { useState, useEffect, useCallback } from 'react';
import { SubtitleTrack, VideoInfo } from '../videoExtraction/types';

declare global {
  interface Window {
    video: {
      getVideoInfo: (videoPath: string) => Promise<VideoInfo>;
      extractSubtitle: (videoPath: string, subtitleIndex: number) => Promise<string>;
      initializeFFmpeg: (onProgress?: (progress: number) => void) => Promise<string>;
    }
  }
}

const LoadVideo = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState<string>('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloadingFFmpeg, setIsDownloadingFFmpeg] = useState<boolean>(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Initialize FFmpeg on component mount
  useEffect(() => {
    const initFFmpeg = async () => {
      try {
        setIsDownloadingFFmpeg(true);
        await window.video.initializeFFmpeg((progress) => {
          setDownloadProgress(progress);
        });
        setIsDownloadingFFmpeg(false);
      } catch (error) {
        setError(`Failed to initialize FFmpeg: ${error.message || 'Unknown error'}`);
        setIsDownloadingFFmpeg(false);
      }
    };

    initFFmpeg();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFile(file);
    setVideoPath(file.path);
    setError('');
    setVideoInfo(null);
    setSelectedSubtitleIndex(null);
    setExtractedText('');

    try {
      setIsLoading(true);
      const info = await window.video.getVideoInfo(file.path);
      setVideoInfo(info);
      setIsLoading(false);

      // Auto-select first subtitle if available
      if (info.subtitleTracks.length > 0) {
        setSelectedSubtitleIndex(info.subtitleTracks[0].index);
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Failed to analyze video: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSubtitleSelect = (index: number) => {
    setSelectedSubtitleIndex(index);
  };

  const handleExtractSubtitle = async () => {
    if (!videoPath || selectedSubtitleIndex === null) return;

    try {
      setIsLoading(true);
      const subtitleContent = await window.video.extractSubtitle(videoPath, selectedSubtitleIndex);
      setExtractedText(subtitleContent);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setError(`Failed to extract subtitle: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div>
      <h2>Load Video</h2>

      {isDownloadingFFmpeg && (
        <div className="download-progress">
          <p>Downloading FFmpeg: {Math.round(downloadProgress * 100)}%</p>
          <progress value={downloadProgress} max="1"></progress>
        </div>
      )}

      <input 
        type="file" 
        onChange={handleFileChange} 
        accept=".mp4,.mkv,.avi"
        disabled={isDownloadingFFmpeg || isLoading}
      />

      {error && <div className="error">{error}</div>}

      {videoInfo && (
        <div className="video-info">
          <h3>Available Subtitles</h3>
          {videoInfo.subtitleTracks.length === 0 ? (
            <p>No subtitles found in this video file.</p>
          ) : (
            <>
              <ul className="subtitle-list">
                {videoInfo.subtitleTracks.map((track: SubtitleTrack) => (
                  <li key={track.index} className={selectedSubtitleIndex === track.index ? 'selected' : ''}>
                    <button 
                      onClick={() => handleSubtitleSelect(track.index)}
                      className={selectedSubtitleIndex === track.index ? 'selected' : ''}
                    >
                      {track.language} {track.title ? `- ${track.title}` : ''} ({track.format})
                    </button>
                  </li>
                ))}
              </ul>

              <button 
                onClick={handleExtractSubtitle} 
                disabled={selectedSubtitleIndex === null || isLoading}
              >
                {isLoading ? 'Extracting...' : 'Extract Selected Subtitle'}
              </button>
            </>
          )}
        </div>
      )}

      {extractedText && (
        <div className="extracted-subtitle">
          <h3>Extracted Subtitle</h3>
          <textarea 
            readOnly 
            value={extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')} 
            rows={10}
          />
        </div>
      )}
    </div>
  );
};

export default LoadVideo; 