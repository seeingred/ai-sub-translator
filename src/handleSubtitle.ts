import translateBatch from './translateBatch';
import { HandleSubtitleProps } from './types';
import { ipcMain, ipcRenderer } from 'electron';

let progressNumber = 0;



export const getProgressNumber = (): number => {
    return progressNumber;
}

import { GoogleGenAI } from "@google/genai";

const handleSubtitle = async (props: HandleSubtitleProps): Promise<string> => {
    
    const { text, batchSize, apiKey } = props;
    let newText = text;
    let replicas: string[] = [];
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

    const ai = new GoogleGenAI({ apiKey });

    progressNumber = 0;
    const progressIncrease = batchSize / replicas.length;
    ipcRenderer.invoke('progress', progressNumber);
    let newReplicas = [...replicas];
    let translatedText = '';
    while (newReplicas.length > 0) {
        const nextBatch = newReplicas.slice(0, batchSize);
        newReplicas = newReplicas.slice(batchSize);
        const text = await translateBatch({
            replicas: nextBatch,
            ai,
            ...props
        });
        translatedText += text + '\n';
        progressNumber += progressIncrease;
        if (progressNumber < 1) {
            ipcRenderer.invoke('progress', progressNumber);
        }
    }
    ipcRenderer.invoke('progress', -1);
    progressNumber = 0;
    return translatedText;
}

export const setTitle = (title: string) => {
    ipcRenderer.invoke('set-title', title);
}

export default handleSubtitle;