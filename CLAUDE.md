# AI Subtitle Translator - Development Notes

## Architecture Overview

This is an Electron-based desktop application that translates subtitles using Google's Gemini AI. The app supports both GUI mode (default) and headless server mode for Linux servers.

## Key Features

1. **Dual Mode Operation**
   - GUI mode: Standard Electron desktop app with React frontend
   - Headless mode: JSON-RPC API server for server deployments

2. **Automatic FFmpeg Management**
   - Downloads appropriate FFmpeg binary for the platform on first run
   - Stores in user data directory (`~/Library/Application Support/ai-sub-translator/` on macOS)
   - Supports macOS (x64/arm64), Windows (x64/arm64), Linux (x64/arm64)

3. **Subtitle Extraction**
   - Can extract subtitles from video files (MKV, MP4, etc.)
   - Filters for SRT format subtitles
   - Preserves language and title metadata

## Project Structure

```
src/
├── index.ts                    # Main Electron entry point
├── renderer.ts                 # React app entry
├── handleSubtitle.ts          # GUI subtitle handling
├── handleSubtitleServer.ts    # Server subtitle handling
├── simpleServerApi.ts         # Simplified API handlers
├── simpleServerState.ts       # Single global state management
├── videoExtraction/
│   ├── ffmpeg.ts              # FFmpeg download and management
│   ├── subtitleExtractor.ts   # Extract subtitles from videos
│   └── types.ts               # TypeScript interfaces
└── file/
    └── load.ts                # File loading for GUI
```

## Headless Server Mode

### Activation
- Automatically activates on Linux without display (`!process.env.DISPLAY`)
- Force with `--headless` flag on any platform
- Custom port via `API_PORT` environment variable (default: 9090)
- Run packaged app: `./out/ai-sub-translator-darwin-arm64/ai-sub-translator.app/Contents/MacOS/ai-sub-translator --headless`

### API Design Philosophy
- **Single global state** - No session management needed
- **No job IDs** - Single active translation, no ID tracking needed
- **One job at a time** - Gemini API isn't scalable for parallel requests
- **Automatic cleanup** - Loading new file clears previous state
- **Simple workflow** - Load → Extract (if video) → Translate → Save

### API Endpoints

```javascript
// Load video or subtitle file (replaces any existing)
file.load(filePath)

// Get current file info
file.info()

// Extract subtitle from video by stream index
subtitle.extract(subtitleIndex)

// Start translation (cancels any existing)
translation.start({apiKey, language, context, model?, batchSize?})

// Check translation progress
translation.status()

// Get completed translation
translation.result()

// Save translation to file
translation.save(filePath)

// Clear everything
clear()
```

### Workflow Example

```bash
# Note: All requests require JSON-RPC 2.0 format with jsonrpc field

# 1. Load video
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"file.load","params":["/path/to/video.mkv"],"id":1}'

# 2. Extract subtitle (use actual stream index from response)
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"subtitle.extract","params":[6],"id":2}'

# 3. Start translation (no job ID returned)
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"translation.start","params":[{
    "apiKey":"YOUR_KEY",
    "language":"Russian",
    "context":"Movie Name",
    "model":"gemini-1.5-flash-8b",
    "batchSize":50
  }],"id":3}'

# 4. Monitor progress (no job ID needed)
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"translation.status","params":[],"id":4}'

# 5. Save result
curl -X POST http://localhost:9090 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"translation.save","params":["/path/output.srt"],"id":5}'
```

## Translation Process

1. **Parsing**: Splits SRT file into individual subtitle entries
2. **Batching**: Groups subtitles into batches (default: 50 entries)
3. **API Calls**: Sends each batch to Gemini with context
4. **Progress Tracking**: Updates progress after each batch
5. **Error Handling**: Retries failed batches with 10-second delay

## Building and Deployment

### Development
```bash
npm start              # Start in dev mode with DevTools
npm start -- --headless # Test headless mode locally
```

### Production Build
```bash
npm run package        # Build for current platform
npm run make:linux:x64 # Build for Linux servers
npm run make:all       # Build for all platforms
```

### Linux Server Deployment
```bash
# Copy the built binary to server
scp out/make/deb/x64/*.deb server:/tmp/

# Install on server
sudo dpkg -i /tmp/ai-sub-translator*.deb

# Run in headless mode
/usr/bin/ai-sub-translator --headless

# Or with custom port
API_PORT=8080 /usr/bin/ai-sub-translator --headless
```

## Important Implementation Details

1. **Stream Indexing**: FFmpeg stream indices don't match array indices. Always use the actual stream index from ffmpeg output.

2. **Progress Calculation**: Based on batch processing, not time. Progress = (processed_batches / total_batches)

3. **State Management**: Single global state prevents race conditions and simplifies API

4. **Error Recovery**: Translation automatically retries failed batches after 10 seconds

5. **Memory Management**: Subtitle content is kept in memory during processing. Large files (>100MB) may need special handling.

## Testing

### Unit Testing
Currently no automated tests. Main testing is done through:
- Manual GUI testing
- API testing with curl/test clients
- Real-world subtitle translation

### Test Files
- Use Foundation series episodes for testing (complex multilingual tracks)
- Test with both .srt files directly and video extraction
- Verify Russian/Ukrainian translations for quality
- Successfully tested with Oppenheimer (2023) - 3 hour movie, 2908 subtitles

## Recent Updates (Sept 2025)

### Code Cleanup
- Removed obsolete `serverApi.ts` and `serverState.ts` files (session-based API)
- Eliminated job ID tracking from `simpleServerState.ts`
- Simplified API responses to remove unnecessary job IDs
- True single-threaded, stateless implementation achieved

### Gemini API Quota Notes
- **Free Tier**: Limited to 50 requests/day - insufficient for full movies
- **Tier 1 (Paid)**: Successfully handles full-length movies (~3000 subtitles)
- Full movie translation takes approximately 4-5 minutes with Tier 1 API
- Batch size of 50 subtitles per request is optimal

## Known Issues

1. FFmpeg download progress not properly reported
2. State not cleared when loading new subtitles in GUI
3. Some subtitle formats (non-SRT) filtered out but could be supported

## Future Improvements

1. Support for .ass, .vtt subtitle formats
2. Multiple AI model support (OpenAI, Anthropic)
3. Subtitle sync adjustment
4. Batch file processing
5. Translation caching/resume capability