import { useState, useEffect, useRef } from "react";
import { HandleSubtitleProps } from "../types";
declare global {
    interface Window {
        subtitle: {
            appName: string,
            handle: (props: HandleSubtitleProps) => Promise<string>,
            getProgressNumber: () => number,
            setTitle: (title: string) => void,
            encrypt: (text: string) => Promise<string>,
            decrypt: (text: string) => Promise<string>
        }
    }
}


const Translation = ({ text }: { text: string }) => {
    const [language, setLanguage] = useState<string>("");
    const [pieceNameOrContext, setPieceNameOrContext] = useState<string>("");
    const [model, setModel] = useState<string>("gemini-2.0-flash");
    const [loading, setLoading] = useState<boolean>(false);
    const [batchSize, setBatchSize] = useState<number>(80);
    const [apiKey, setApiKey] = useState<string>("");
    const [translatedSubtitles, setTranslatedSubtitles] = useState<string>("");
    const [progressPercentage, setProgressPercentage] = useState<number>(0);
    const progressCheckInterval = useRef<NodeJS.Timeout | null>(null);
    const handleTranslate = () => {
        setLoading(true);
        window.subtitle.handle({
            text,
            language,
            pieceNameOrContext,
            model,
            batchSize,
            apiKey
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
    useEffect(() => {
        if (!loading) {
            clearInterval(progressCheckInterval.current);
            setProgressPercentage(0);
            return;
        }
        progressCheckInterval.current = setInterval(() => {
            const progressNumber = window.subtitle.getProgressNumber();
            setProgressPercentage(Math.round(progressNumber * 100));
        }, 1000);
    }, [loading])
    useEffect(() => {
        let newTitle = window.subtitle.appName;
        if (progressPercentage > 0) {
            newTitle = `${newTitle} (${progressPercentage}%)`
        }
        window.subtitle.setTitle(newTitle);
    }, [progressPercentage])

    useEffect(() => {
        if (!text) {
            return;
        }
        ; (async () => {
            const encrypted = localStorage.getItem("apiKey");
            if (encrypted) {
                try {
                    const decryptedTry = await window.subtitle.decrypt(encrypted)
                    setApiKey(decryptedTry);
                } catch (error) {
                    console.error(`error`, error);
                    setApiKey(encrypted);
                }
            }
            const language = localStorage.getItem("language");
            setLanguage(language);
        })()
    }, [text]);

    const properSetApiKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setApiKey(value);
        if (value) {
            try {
                const encryptedTry = await window.subtitle.encrypt(value);
                localStorage.setItem("apiKey", encryptedTry);
            } catch (error) {
                console.error(`error`, error);
                localStorage.setItem("apiKey", value);
            }
        }
    }

    const properSaveLanguage = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLanguage(e.target.value);
        localStorage.setItem("language", e.target.value);
    }

    return (
        <>
            <h2>Translation</h2>
            <div className="block">
                <label>Api Key</label>
                <input type="password" onChange={(e) => setApiKey(e.target.value)} onBlur={properSetApiKey} value={apiKey} />
            </div>
            <div className="block">
                <label>Language</label>
                <input type="text" onChange={(e) => setLanguage(e.target.value)} onBlur={properSaveLanguage} value={language} />
            </div>
            <div className="block">
                <label>Piece name or context</label>
                <input type="text" onChange={(e) => setPieceNameOrContext(e.target.value)} value={pieceNameOrContext} />
            </div>
            <div className="block">
                <label>Model</label>
                <input type="text" disabled value={model} />
            </div>
            <div className="block">
                <label>Batch size</label>
                <input type="number" disabled value={batchSize} />
            </div>
            <button onClick={handleTranslate} disabled={loading}>{loading ? "Translating... " + progressPercentage + "%" : "Translate"}</button>
            {translatedSubtitles && <><div className="gap" /><button onClick={handleDownload}>Download .srt file</button></>}
        </>
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