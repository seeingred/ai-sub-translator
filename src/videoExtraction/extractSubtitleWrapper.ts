import {ipcRenderer} from 'electron';

export const extractSubtitleWrapper = (videoPath: string, subtitleIndex: number): Promise<string> => {
    return ipcRenderer.invoke('extract-subtitle', videoPath, subtitleIndex);
}

export default extractSubtitleWrapper;