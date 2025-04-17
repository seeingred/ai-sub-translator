import { GoogleGenAI } from "@google/genai";
import { HandleSubtitleProps, TranslateBatchProps } from './types';

const apiKey = process.env.GOOGLE_API_KEY;

const ai = new GoogleGenAI({ apiKey });

async function aiCall({ text, language, pieceNameOrContext, model }: HandleSubtitleProps): Promise<string> {
    const response = await ai.models.generateContent({
        model,
        contents: `I'll give you subtitles batch is srt format. I need you to translate them to ${language}, understanding the context of the subtitles: ${pieceNameOrContext}. You answer should consist of only translated subtitles. Here is the subtitles batch: \n` + text,
    });
    return response.text;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


const translateBatch = async (props: TranslateBatchProps): Promise<string> => {
    const text = props.replicas.join('');
    let translatedText = '';
    try {
        translatedText = await aiCall({
            ...props,
            text
        });
    } catch (error) {
        console.error(error);
        await wait(10000);
        return translateBatch(props);
    }
    return translatedText;
}

export default translateBatch;