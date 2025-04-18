export enum FileType {
    VIDEO = 'video',
    SUBTITLE = 'subtitle',
    NONE = 'none'
}

export type FileLoadResponse = {
    type: FileType,
    path: string,
    text: string
}