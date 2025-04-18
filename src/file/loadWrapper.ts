import {ipcRenderer} from 'electron';
import { FileLoadResponse } from './types';

export const loadFileWrapper = (): Promise<FileLoadResponse> => {
    return ipcRenderer.invoke('file-load');
}

export default loadFileWrapper;