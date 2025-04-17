import { ipcRenderer } from "electron";

export const encrypt = (text: string): Promise<string> => {
    return ipcRenderer.invoke('encrypt', text);
}

export const decrypt = (hex: string): Promise<string> => {
    return ipcRenderer.invoke('decrypt', hex);
}