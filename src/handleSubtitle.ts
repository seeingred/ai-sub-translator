import translateBatch from './translateBatch';
import { HandleSubtitleProps } from './types';
import { ipcRenderer } from 'electron';

const handleSubtitle = async (props: HandleSubtitleProps): Promise<string> => {
    const { text, batchSize } = props;
    console.log(`batchSize`, batchSize);
    
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
    const batch = await translateBatch({
        replicas: replicas.slice(0, batchSize),
        ...props
    });

    return batch;
}

export default handleSubtitle;