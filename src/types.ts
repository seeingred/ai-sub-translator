import type { GoogleGenAI } from "@google/genai";

export interface SubtitleProps {
    language: string;
    pieceNameOrContext: string;
    model: string;
    batchSize?: number;
    apiKey?: string;
}

export interface HandleSubtitleProps extends SubtitleProps {
    text: string;
    signal?: AbortSignal;
}

export interface handleAiProps extends HandleSubtitleProps {
    ai: GoogleGenAI;
}

export interface TranslateBatchProps extends SubtitleProps {
    replicas: string[];
    ai: GoogleGenAI;
}