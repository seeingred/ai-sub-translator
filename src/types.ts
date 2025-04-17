export interface SubtitleProps {
    language: string;
    pieceNameOrContext: string;
    model: string;
    batchSize?: number;
    apiKey?: string;
}

export interface HandleSubtitleProps extends SubtitleProps {
    text: string;
}

export interface TranslateBatchProps extends SubtitleProps {
    replicas: string[];
}