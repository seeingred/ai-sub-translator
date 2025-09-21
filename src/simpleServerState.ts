import * as fs from 'fs';
import { VideoInfo } from './videoExtraction/types';

export interface LoadedFile {
    path: string;
    type: 'video' | 'subtitle';
    content?: string; // For subtitle files
    videoInfo?: VideoInfo; // For video files
    extractedSubtitle?: string; // Extracted subtitle content
}

export interface TranslationJob {
    status: 'idle' | 'in_progress' | 'completed' | 'failed';
    progress: number; // 0 to 1
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    result?: string; // Translated text
    options?: {
        apiKey: string;
        language: string;
        context: string;
        model?: string;
        batchSize?: number;
    };
}

class SimpleServerState {
    private loadedFile: LoadedFile | null = null;
    private currentJob: TranslationJob = {
        status: 'idle',
        progress: 0
    };

    // Load a new file (clears any existing file and job)
    loadFile(filePath: string, type: 'video' | 'subtitle', content?: string, videoInfo?: VideoInfo): void {
        // Clear existing job if any
        this.clearJob();

        // Set new file
        this.loadedFile = {
            path: filePath,
            type,
            content,
            videoInfo
        };
    }

    // Get current loaded file
    getLoadedFile(): LoadedFile | null {
        return this.loadedFile;
    }

    // Set extracted subtitle content
    setExtractedSubtitle(content: string): void {
        if (this.loadedFile && this.loadedFile.type === 'video') {
            this.loadedFile.extractedSubtitle = content;
        }
    }

    // Clear loaded file
    clearFile(): void {
        this.loadedFile = null;
        this.clearJob();
    }

    // Start a new translation job (cancels any existing job)
    startJob(options: TranslationJob['options']): void {
        // Clear any existing job
        this.currentJob = {
            status: 'in_progress',
            progress: 0,
            startedAt: new Date(),
            options
        };
    }

    // Get current job
    getCurrentJob(): TranslationJob {
        return this.currentJob;
    }

    // Update job progress
    updateJobProgress(progress: number): void {
        if (this.currentJob.status === 'in_progress') {
            this.currentJob.progress = Math.min(1, Math.max(0, progress));
        }
    }

    // Complete the job
    completeJob(result: string): void {
        if (this.currentJob.status === 'in_progress') {
            this.currentJob.status = 'completed';
            this.currentJob.progress = 1;
            this.currentJob.completedAt = new Date();
            this.currentJob.result = result;
        }
    }

    // Fail the job
    failJob(error: string): void {
        if (this.currentJob.status === 'in_progress') {
            this.currentJob.status = 'failed';
            this.currentJob.error = error;
            this.currentJob.completedAt = new Date();
        }
    }

    // Clear the current job
    clearJob(): void {
        this.currentJob = {
            status: 'idle',
            progress: 0
        };
    }

    // Check if there's a file loaded
    hasFile(): boolean {
        return this.loadedFile !== null;
    }

    // Check if there's subtitle content ready for translation
    hasSubtitleContent(): boolean {
        if (!this.loadedFile) return false;

        if (this.loadedFile.type === 'subtitle') {
            return !!this.loadedFile.content;
        } else if (this.loadedFile.type === 'video') {
            return !!this.loadedFile.extractedSubtitle;
        }

        return false;
    }

    // Get subtitle content for translation
    getSubtitleContent(): string | null {
        if (!this.loadedFile) return null;

        if (this.loadedFile.type === 'subtitle') {
            return this.loadedFile.content || null;
        } else if (this.loadedFile.type === 'video') {
            return this.loadedFile.extractedSubtitle || null;
        }

        return null;
    }

}

// Singleton instance
export const serverState = new SimpleServerState();