import { HandleSubtitleProps } from './types';
import { GoogleGenAI } from "@google/genai";

async function aiCall(text: string, language: string, pieceNameOrContext: string, model: string, apiKey: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model,
        contents: `I'll give you subtitles batch is srt format. I need you to translate them to ${language}, understanding the context of the subtitles: ${pieceNameOrContext}. You answer should consist of only translated subtitles. Here is the subtitles batch: \n` + text,
    });
    return response.text;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function translateBatch(replicas: string[], language: string, pieceNameOrContext: string, model: string, apiKey: string): Promise<string> {
    const text = replicas.join('');
    let translatedText = '';
    try {
        translatedText = await aiCall(text, language, pieceNameOrContext, model, apiKey);
    } catch (error) {
        console.error('Translation error, retrying in 10 seconds...', error);
        await wait(10000);
        return translateBatch(replicas, language, pieceNameOrContext, model, apiKey);
    }
    return translatedText;
}

const handleSubtitleServer = async (props: HandleSubtitleProps, onProgress?: (progress: number) => void): Promise<string> => {
    const { text, batchSize = 50, apiKey, language, pieceNameOrContext = '', model = 'gemini-1.5-flash-8b', signal } = props;

    let newText = text;
    let replicas: string[] = [];

    // Parse SRT format
    while (newText.includes('-->')) {
        const start = newText.indexOf('-->');
        // find the beginning of the previous line
        let replicaNumberLineEnd = newText.lastIndexOf('\n', start);
        if (replicaNumberLineEnd === -1) {
            replicaNumberLineEnd = newText.lastIndexOf('\r', start);
        }
        const replicaNumberLineStart = 0;
        const replicaNumberText = newText.slice(replicaNumberLineStart, replicaNumberLineEnd);
        const replicaNumber = parseInt(replicaNumberText);
        const remainingText = newText.slice(replicaNumberLineStart);
        let nextReplicaNumber = replicaNumber + 1;
        let nextReplicaNumberStart = remainingText.indexOf(nextReplicaNumber.toString() + "\n");
        if (nextReplicaNumberStart === -1) {
            nextReplicaNumberStart = remainingText.indexOf(nextReplicaNumber.toString() + "\r");
        }
        if (nextReplicaNumberStart === -1) {
            replicas.push(remainingText);
            break;
        } else {
            const nextReplicaNumberEnd = remainingText.indexOf('\n', nextReplicaNumberStart);
            const nextReplicaText = remainingText.slice(nextReplicaNumberStart, nextReplicaNumberEnd);
            const nextReplicaNumberParsed = parseInt(nextReplicaText);
            if (nextReplicaNumberParsed === nextReplicaNumber) {
                const replica = newText.slice(replicaNumberLineStart, nextReplicaNumberStart);
                replicas.push(replica);
                newText = newText.slice(replica.length);
            } else {
                replicas.push(remainingText);
                break;
            }
        }
    }

    let progressNumber = 0;
    const progressIncrease = batchSize / replicas.length;

    if (onProgress) {
        onProgress(progressNumber);
    }

    let newReplicas = [...replicas];
    let translatedText = '';

    while (newReplicas.length > 0) {
        // Check if translation was cancelled
        if (signal?.aborted) {
            console.log('Translation cancelled by user');
            throw new Error('Translation cancelled');
        }

        const nextBatch = newReplicas.slice(0, batchSize);
        newReplicas = newReplicas.slice(batchSize);

        const batchText = await translateBatch(nextBatch, language, pieceNameOrContext, model, apiKey);
        translatedText += batchText + '\n';

        progressNumber += progressIncrease;
        if (progressNumber < 1 && onProgress) {
            onProgress(progressNumber);
        }
    }

    if (onProgress) {
        onProgress(1);
    }

    return translatedText;
}

export default handleSubtitleServer;