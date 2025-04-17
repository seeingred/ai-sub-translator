import { useState } from "react";
import { HandleSubtitleProps } from "../types";
declare global {
    interface Window {
        subtitle: {
            handle: (props: HandleSubtitleProps) => Promise<string>
        }
    }
}


const Translation = ({ text }: { text: string }) => {
    const [language, setLanguage] = useState<string>("russian");
    const [pieceNameOrContext, setPieceNameOrContext] = useState<string>("last of us season 2 episode 1");
    const [model, setModel] = useState<string>("gemini-2.0-flash");
    const [loading, setLoading] = useState<boolean>(false);
    const [batchSize, setBatchSize] = useState<number>(80);
    const [translatedSubtitles, setTranslatedSubtitles] = useState<string>("");
    const handleTranslate = () => {
        setLoading(true);
        window.subtitle.handle({
            text,
            language,
            pieceNameOrContext,
            model,
            batchSize
        }).then((batch) => {
            setTranslatedSubtitles(batch);
            setLoading(false);
        });
    }
    const handleDownload = () => {
        const blob = new Blob([translatedSubtitles], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pieceNameOrContext} - ${language}.srt`;
        a.click();
    }
    return (
        <>
            <h2>Translation</h2>
            <div className="block">
                <label>Language</label>
                <input type="text" onChange={(e) => setLanguage(e.target.value)} value={language} />
            </div>
            <div className="block">
                <label>Piece Name or Context</label>
                <input type="text" onChange={(e) => setPieceNameOrContext(e.target.value)} value={pieceNameOrContext} />
            </div>
            <div className="block">
                <label>Model</label>
                <input type="text" disabled value={model} />
            </div>
            <div className="block">
                <label>Batch Size</label>
                <input type="number" disabled value={batchSize} />
            </div>
            <button onClick={handleTranslate} disabled={loading}>{loading ? "Translating..." : "Translate"}</button>
            " "
            {translatedSubtitles && <button onClick={handleDownload}>Download .srt file</button>}
        </>
    )
}

const TranslationInner = ({ text }: { text: string }) => {
    return (
        <div>
            <h2>Translation</h2>
        </div>
    )
}

const LoadSubtitle = () => {
    const [file, setFile] = useState<File | null>(null);
    const [text, setText] = useState<string>("");

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setText(text);
            }
            reader.readAsText(file);
        }
    }

    return (
        <div>
            <h2>Load Subtitle</h2>
            <input type="file" onChange={handleFileChange} />
            {!!text && <Translation text={text} />}
        </div>
    )
}

export default LoadSubtitle;