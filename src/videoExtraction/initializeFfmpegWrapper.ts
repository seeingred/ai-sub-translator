import {ipcRenderer} from 'electron';

export const loadFileWrapper = (): Promise<string> => {
    return ipcRenderer.invoke('initialize-ffmpeg');
}

export default loadFileWrapper;