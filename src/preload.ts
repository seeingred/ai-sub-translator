// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge } from 'electron'
import handle, { getProgressNumber, setTitle } from './handleSubtitle'
import { encrypt, decrypt } from './safeStorage'
import type { HandleSubtitleProps } from './types';
import loadFileWrapper from './file/loadWrapper';
import initializeFfmpegWrapper from './videoExtraction/initializeFfmpegWrapper';

contextBridge.exposeInMainWorld('subtitle', {
    appName: 'AI Subtitle Translator',
    handle,
    getProgressNumber,
    setTitle,
    encrypt,
    decrypt
})

contextBridge.exposeInMainWorld('file', {
    load: loadFileWrapper
})

contextBridge.exposeInMainWorld('video', {
    // getVideoInfo: async (videoPath: string) => getVideoInfoInternal(videoPath),
    // extractSubtitle: async (videoPath: string, subtitleIndex: number) => {
    //     const extractedPath = await extractSubtitleFromVideo(videoPath, subtitleIndex);
    //     // Use IPC to read the file instead of direct fs access
    //     return ipcRenderer.invoke('read-file', extractedPath);
    // },
    initializeFFmpeg: initializeFfmpegWrapper
})