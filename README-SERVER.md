# AI Subtitle Translator - Server Mode

This application can run in headless server mode on Linux servers without a GUI, exposing a JSON-RPC API for subtitle translation.

## Running in Server Mode

### Automatic Detection
On Linux systems without a display, the app automatically starts in server mode:
```bash
./ai-sub-translator
```

### Force Server Mode
You can force server mode on any platform using the `--headless` flag:
```bash
./ai-sub-translator --headless
```

### Custom Port
Set a custom port using the `API_PORT` environment variable:
```bash
API_PORT=8080 ./ai-sub-translator --headless
```

## API Endpoints

The server exposes a JSON-RPC 2.0 API on port 9090 (default).

### Available Methods

#### `ping`
Health check endpoint.
- **Parameters:** none
- **Returns:** `"pong"`

#### `info`
Get server information.
- **Parameters:** none
- **Returns:** Object with server details

#### `ffmpeg.initialize`
Initialize FFmpeg (downloads if needed).
- **Parameters:** none
- **Returns:** `{ path: string }` - Path to FFmpeg executable

#### `video.getInfo`
Get video information including subtitle tracks.
- **Parameters:** `[videoPath: string]`
- **Returns:** Video information object

#### `subtitle.extract`
Extract subtitle from video file.
- **Parameters:** `[videoPath: string, subtitleIndex: number]`
- **Returns:** Extracted subtitle content

#### `subtitle.loadFile`
Load subtitle file from disk.
- **Parameters:** `[filePath: string]`
- **Returns:** `{ content: string, path: string }`

#### `subtitle.translate`
Translate subtitle text.
- **Parameters:** `[options: object]`
  - `text: string` - Subtitle text in SRT format
  - `apiKey: string` - Gemini API key
  - `language: string` - Target language
  - `pieceNameOrContext?: string` - Context for better translation
  - `batchSize?: number` - Batch size (default: 50)
  - `model?: string` - Model name (default: "gemini-1.5-flash-8b")
- **Returns:** `{ translatedText: string }`

#### `subtitle.save`
Save subtitle to file.
- **Parameters:** `[filePath: string, content: string]`
- **Returns:** `{ success: boolean, path: string }`

## Example Client Usage

### Using curl
```bash
# Ping test
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","params":[],"id":1}'

# Get server info
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"info","params":[],"id":1}'

# Translate subtitle
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"subtitle.translate",
    "params":[{
      "text":"1\n00:00:00,000 --> 00:00:02,000\nHello world",
      "apiKey":"YOUR_API_KEY",
      "language":"Spanish",
      "pieceNameOrContext":"Test video"
    }],
    "id":1
  }'
```

### Using Node.js Client

See `test-client.js` for a complete example:

```javascript
const jayson = require('jayson');
const client = jayson.Client.http({ port: 9090 });

// Translate subtitle
client.request('subtitle.translate', [{
  text: subtitleContent,
  apiKey: 'YOUR_GEMINI_API_KEY',
  language: 'Spanish',
  pieceNameOrContext: 'The Last of Us S2E1'
}], (err, response) => {
  if (err) throw err;
  console.log('Translated:', response.result.translatedText);
});
```

## Python Client Example

```python
import json
import requests

def translate_subtitle(text, api_key, language, context=""):
    url = "http://localhost:9090"
    payload = {
        "jsonrpc": "2.0",
        "method": "subtitle.translate",
        "params": [{
            "text": text,
            "apiKey": api_key,
            "language": language,
            "pieceNameOrContext": context
        }],
        "id": 1
    }
    response = requests.post(url, json=payload)
    return response.json()["result"]["translatedText"]
```

## Building for Server Deployment

To build the app for Linux server deployment:

```bash
# Build for Linux x64
npm run make:linux:x64

# Build for Linux ARM64
npm run make:linux:arm64
```

The built binary will be in `out/make/` directory.

## Docker Deployment

You can also run the server in a Docker container:

```dockerfile
FROM node:18-slim

# Install dependencies for Electron
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY out/make/deb/x64/*.deb ./app.deb
RUN dpkg -i app.deb

EXPOSE 9090
CMD ["/usr/bin/ai-sub-translator", "--headless"]
```

## Notes

- FFmpeg is automatically downloaded on first run
- Progress is logged to console during translation
- The server keeps running until terminated with Ctrl+C
- All file paths must be absolute paths