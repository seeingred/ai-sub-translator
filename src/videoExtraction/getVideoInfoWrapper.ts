import {ipcRenderer} from 'electron';

export const getVideoInfoWrapper = (videoPath: string): Promise<string> => {
    return ipcRenderer.invoke('get-video-info', videoPath);
}

export default getVideoInfoWrapper;