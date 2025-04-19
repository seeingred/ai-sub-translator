import { useState, useEffect, useRef } from "react";
import { HandleSubtitleProps } from "../types";
import { SubtitleTrack, VideoInfo } from '../videoExtraction/types';
import Translation from "./Translation";
import { FileLoadResponse, FileType } from "../file/types";
declare global {
    interface Window {
        video: {
            getVideoInfo: (videoPath: string) => Promise<VideoInfo>;
            extractSubtitle: (videoPath: string, subtitleIndex: number) => Promise<string>;
            initializeFFmpeg: (onProgress?: (progress: number) => void) => Promise<string>;

        },
        file: {
            load: () => Promise<FileLoadResponse>;
        }
    }
}



const LoadSubtitle = () => {
    const [fileResponse, setFileResponse] = useState<FileLoadResponse | null>(null);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [isDownloadingFFmpeg, setIsDownloadingFFmpeg] = useState<boolean>(false);
    const [ffmpegDownloaded, setFfmpegDownloaded] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [text, setText] = useState<string>('');
    // Initialize FFmpeg on file select if video is selected
    useEffect(() => {
        if (!fileResponse) return;
        if (fileResponse?.type === FileType.NONE) return;
        if (!fileResponse.path) return;
        setError('');
        setVideoInfo(null);
        setSelectedSubtitleIndex(null);
        if (fileResponse?.type === FileType.VIDEO) {
            const initFFmpeg = async () => {
                try {
                    setIsDownloadingFFmpeg(true);
                    await window.video.initializeFFmpeg((progress) => {
                        setDownloadProgress(progress);
                    });
                    setIsDownloadingFFmpeg(false);
                    setFfmpegDownloaded(true);
                } catch (error) {
                    setError(`Failed to initialize FFmpeg: ${error.message || 'Unknown error'}`);
                    setIsDownloadingFFmpeg(false);
                }
                setText('');
            };
            initFFmpeg();
        } else if (fileResponse?.type === FileType.SUBTITLE) {
            setText(fileResponse.text);
        }
    }, [fileResponse]);

    useEffect(() => {
        if (!ffmpegDownloaded) {
            return;
        }
        (async () => {
            try {
                setIsLoading(true);
                const info = await window.video.getVideoInfo(fileResponse?.path);
                setVideoInfo(info);
                setIsLoading(false);
                if (info.subtitleTracks.length > 0) {
                    setSelectedSubtitleIndex(info.subtitleTracks[0].index);
                }
            } catch (error) {
                setIsLoading(false);
                setError(`Failed to analyze video: ${error.message || 'Unknown error'}`);
            }
        })()

    }, [ffmpegDownloaded]);

    const handleLoadFile = async () => {
        const fileResponse = await window.file.load();
        console.log(`fileResponse`, fileResponse);
        setFileResponse(fileResponse);
    }

    const handleSubtitleSelect = (index: number) => {
        setSelectedSubtitleIndex(index);
    };

    const handleExtractSubtitle = async () => {
        if (!fileResponse?.path || selectedSubtitleIndex === null) return;

        try {
            setIsLoading(true);
            const subtitleContent = await window.video.extractSubtitle(fileResponse?.path, selectedSubtitleIndex);
            setText(subtitleContent);
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            setError(`Failed to extract subtitle: ${error.message || 'Unknown error'}`);
        }
    };


    return (
        <div>
            <h2>Load Subtitle</h2>
            <button
                onClick={handleLoadFile}
                disabled={isDownloadingFFmpeg || isLoading}
            >
                Load File (.mp4, .mkv, .avi, .srt)
            </button>
            {isDownloadingFFmpeg && (
                <div className="download-progress">
                    <p>Downloading FFmpeg: {Math.round(downloadProgress * 100)}%</p>
                    <progress value={downloadProgress} max="1"></progress>
                </div>
            )}
            {!!text && <Translation text={text} />}
            {error && <div className="error">{error}</div>}
            {videoInfo && !text && (
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
        </div>
    )
}

export default LoadSubtitle;