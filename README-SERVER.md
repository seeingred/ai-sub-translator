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

## API Design

The server uses a **simplified single-state design**:
- No session management needed
- Only one translation job at a time (Gemini API isn't scalable)
- Loading a new file automatically clears the previous one
- Straightforward workflow: Load → Extract → Translate → Save

## API Endpoints

The server exposes a JSON-RPC 2.0 API on port 9090 (default).

### Available Methods

#### `file.load`
Load a video or subtitle file (replaces any existing file).
- **Parameters:** `[filePath: string]`
- **Returns:** File info with type and available subtitles (for video)

#### `file.info`
Get information about the currently loaded file.
- **Parameters:** none
- **Returns:** Current file details

#### `subtitle.extract`
Extract subtitle from loaded video file.
- **Parameters:** `[subtitleIndex: number]` - The stream index from ffmpeg
- **Returns:** Success status and content length
- **Note:** Stream indices are from ffmpeg output, not array indices

#### `translation.start`
Start translation (cancels any existing translation).
- **Parameters:** `[options: object]`
  - `apiKey: string` - Gemini API key
  - `language: string` - Target language
  - `context?: string` - Context for better translation
  - `model?: string` - Model name (default: "gemini-1.5-flash-8b")
  - `batchSize?: number` - Batch size (default: 50)
- **Returns:** Job ID and status

#### `translation.status`
Check translation progress.
- **Parameters:** none
- **Returns:** Status, progress percentage, timestamps

#### `translation.result`
Get translated text (only when completed).
- **Parameters:** none
- **Returns:** Translated subtitle text

#### `translation.save`
Save translation to file.
- **Parameters:** `[filePath: string]`
- **Returns:** Success status and file info

#### `clear`
Clear current file and job.
- **Parameters:** none
- **Returns:** Success status

#### `ping`
Health check.
- **Parameters:** none
- **Returns:** `"pong"`

#### `info`
Get server information.
- **Parameters:** none
- **Returns:** Server details, current file, and job status

## Complete Workflow Example

### Video File Workflow

```bash
# 1. Load video file
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"file.load",
    "params":["/path/to/video.mkv"],
    "id":1
  }'

# Response includes available subtitles with their indices

# 2. Extract subtitle (use actual stream index from ffmpeg)
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"subtitle.extract",
    "params":[18],
    "id":2
  }'

# 3. Start translation
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"translation.start",
    "params":[{
      "apiKey":"YOUR_GEMINI_API_KEY",
      "language":"Russian",
      "context":"Movie Name Season 1"
    }],
    "id":3
  }'

# 4. Check progress (repeat until status is "completed")
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"translation.status",
    "params":[],
    "id":4
  }'

# 5. Save translated subtitle
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"translation.save",
    "params":["/path/to/output.srt"],
    "id":5
  }'
```

### Direct Subtitle File Workflow

```bash
# 1. Load SRT file
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"file.load",
    "params":["/path/to/subtitle.srt"],
    "id":1
  }'

# 2. Start translation (skip extraction)
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"translation.start",
    "params":[{
      "apiKey":"YOUR_GEMINI_API_KEY",
      "language":"Spanish",
      "context":"Series Name"
    }],
    "id":2
  }'

# 3. Monitor and save (same as video workflow)
```

## Client Examples

### Node.js Client

```javascript
const jayson = require('jayson');
const client = jayson.Client.http({ port: 9090 });

// Load file
client.request('file.load', ['/path/to/video.mkv'], (err, response) => {
  console.log('Available subtitles:', response.result.subtitles);

  // Extract subtitle
  client.request('subtitle.extract', [18], (err, response) => {

    // Start translation
    client.request('translation.start', [{
      apiKey: 'YOUR_KEY',
      language: 'Russian',
      context: 'Movie Name'
    }], (err, response) => {

      // Monitor progress...
    });
  });
});
```

### Python Client

```python
import json
import requests
import time

def translate_subtitle(video_path, api_key, language):
    url = "http://localhost:9090"

    # Load video
    response = requests.post(url, json={
        "jsonrpc": "2.0",
        "method": "file.load",
        "params": [video_path],
        "id": 1
    })
    subtitles = response.json()["result"]["subtitles"]

    # Extract first English subtitle
    eng_sub = next((s for s in subtitles if s["language"] == "eng"), None)
    if eng_sub:
        requests.post(url, json={
            "jsonrpc": "2.0",
            "method": "subtitle.extract",
            "params": [eng_sub["id"]],
            "id": 2
        })

    # Start translation
    response = requests.post(url, json={
        "jsonrpc": "2.0",
        "method": "translation.start",
        "params": [{
            "apiKey": api_key,
            "language": language,
            "context": "Movie"
        }],
        "id": 3
    })

    # Monitor progress
    while True:
        response = requests.post(url, json={
            "jsonrpc": "2.0",
            "method": "translation.status",
            "params": [],
            "id": 4
        })
        status = response.json()["result"]
        print(f"Progress: {status['progress']}%")

        if status["status"] == "completed":
            break
        elif status["status"] == "failed":
            raise Exception(status.get("error"))

        time.sleep(2)

    # Save result
    requests.post(url, json={
        "jsonrpc": "2.0",
        "method": "translation.save",
        "params": [video_path.replace('.mkv', '_translated.srt')],
        "id": 5
    })
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

You can run the server in a Docker container:

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

Build and run:
```bash
docker build -t ai-sub-translator .
docker run -p 9090:9090 ai-sub-translator
```

## Important Notes

- **FFmpeg**: Automatically downloaded on first run
- **Single Job**: Only one translation can run at a time
- **Auto-cleanup**: Loading a new file clears the previous one
- **Stream Indices**: Use actual ffmpeg stream numbers, not array indices
- **Progress**: Based on batch completion, not time
- **File Paths**: Must be absolute paths
- **Memory**: Large subtitle files are kept in memory during processing

## Error Handling

The API returns standard JSON-RPC error codes:
- `-32602`: Invalid parameters
- `-32603`: Internal error (file not found, no file loaded, etc.)
- `-32000`: Server error (extraction failed, translation failed, etc.)

Example error response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "No file loaded. Load a video file first."
  }
}
```

## Typical Translation Times

- ~50 subtitles: 30-60 seconds
- ~500 subtitles: 2-3 minutes
- ~1000 subtitles: 4-5 minutes

Times depend on Gemini API response speed and network conditions.