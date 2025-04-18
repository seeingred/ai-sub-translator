import { BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import { promisify } from 'util';
import { FileType, FileLoadResponse } from './types';
const readFile = promisify(fs.readFile);

export const loadFile = async (window: BrowserWindow): Promise<FileLoadResponse> => {
    const res = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'createDirectory'],
        filters: [
            { name: 'Video / Subs', extensions: ['mp4', 'mkv', 'avi', 'srt'] },
        ]
    });
    const fileFath = res.filePaths[0];
    const fileExtension = fileFath.split('.').pop();
    let fileType = FileType.NONE;
    let text = ''
    if (fileExtension === 'mp4' || fileExtension === 'mkv' || fileExtension === 'avi') {
        fileType = FileType.VIDEO;
    } else if (fileExtension === 'srt') {
        fileType = FileType.SUBTITLE;
        text = await readFile(fileFath, 'utf8');
    }
    return {
        type: fileType,
        path: fileFath,
        text: text
    }
}

export default loadFile;