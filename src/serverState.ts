import * as fs from 'fs';
import * as path from 'path';
import { VideoInfo } from './videoExtraction/types';

export interface Session {
    id: string;
    loadedFile?: {
        path: string;
        type: 'video' | 'subtitle';
        content?: string; // For subtitle files
        videoInfo?: VideoInfo; // For video files
        extractedSubtitle?: string; // Extracted subtitle content
    };
    translationJob?: TranslationJob;
}

export interface TranslationJob {
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number; // 0 to 1
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    result?: string; // Translated text
    options: {
        apiKey: string;
        language: string;
        context: string;
        model?: string;
        batchSize?: number;
    };
}

class ServerState {
    private sessions: Map<string, Session> = new Map();
    private jobs: Map<string, TranslationJob> = new Map();

    createSession(): string {
        const sessionId = this.generateId();
        this.sessions.set(sessionId, {
            id: sessionId
        });
        return sessionId;
    }

    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }

    updateSession(sessionId: string, updates: Partial<Session>): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.set(sessionId, { ...session, ...updates });
        }
    }

    deleteSession(sessionId: string): boolean {
        // Clean up any associated jobs
        const session = this.sessions.get(sessionId);
        if (session?.translationJob) {
            this.jobs.delete(session.translationJob.id);
        }
        return this.sessions.delete(sessionId);
    }

    createJob(sessionId: string, options: TranslationJob['options']): string {
        const jobId = this.generateId();
        const job: TranslationJob = {
            id: jobId,
            status: 'pending',
            progress: 0,
            startedAt: new Date(),
            options
        };

        this.jobs.set(jobId, job);

        // Associate job with session
        const session = this.sessions.get(sessionId);
        if (session) {
            session.translationJob = job;
            this.sessions.set(sessionId, session);
        }

        return jobId;
    }

    getJob(jobId: string): TranslationJob | undefined {
        return this.jobs.get(jobId);
    }

    updateJob(jobId: string, updates: Partial<TranslationJob>): void {
        const job = this.jobs.get(jobId);
        if (job) {
            this.jobs.set(jobId, { ...job, ...updates });
        }
    }

    updateJobProgress(jobId: string, progress: number): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.progress = Math.min(1, Math.max(0, progress));
            if (job.status === 'pending') {
                job.status = 'in_progress';
            }
            this.jobs.set(jobId, job);
        }
    }

    completeJob(jobId: string, result: string): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = 'completed';
            job.progress = 1;
            job.completedAt = new Date();
            job.result = result;
            this.jobs.set(jobId, job);
        }
    }

    failJob(jobId: string, error: string): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = 'failed';
            job.error = error;
            job.completedAt = new Date();
            this.jobs.set(jobId, job);
        }
    }

    // Clean up old sessions and jobs (older than 1 hour)
    cleanup(): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Clean up completed/failed jobs
        for (const [jobId, job] of this.jobs.entries()) {
            if (job.completedAt && job.completedAt < oneHourAgo) {
                this.jobs.delete(jobId);
            }
        }

        // Clean up sessions without active jobs
        for (const [sessionId, session] of this.sessions.entries()) {
            if (!session.translationJob ||
                (session.translationJob.completedAt && session.translationJob.completedAt < oneHourAgo)) {
                this.sessions.delete(sessionId);
            }
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    getAllSessions(): Session[] {
        return Array.from(this.sessions.values());
    }

    getAllJobs(): TranslationJob[] {
        return Array.from(this.jobs.values());
    }
}

// Singleton instance
export const serverState = new ServerState();

// Run cleanup every 30 minutes
setInterval(() => {
    serverState.cleanup();
}, 30 * 60 * 1000);