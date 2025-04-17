// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge } from 'electron'
import handleSubtitle, { getProgressNumber, setTitle } from './handleSubtitle'
import { encrypt, decrypt } from './safeStorage'
import type { HandleSubtitleProps } from './types';

contextBridge.exposeInMainWorld('subtitle', {
    appName: 'AI Subtitle Translator',
    handle: async (props: HandleSubtitleProps): Promise<string> => handleSubtitle(props),
    getProgressNumber: (): number => getProgressNumber(),
    setTitle: (title: string) => setTitle(title),
    encrypt: (text: string) => encrypt(text),
    decrypt: (text: string) => decrypt(text)
})