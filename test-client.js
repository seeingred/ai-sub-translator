#!/usr/bin/env node

const jayson = require('jayson');

// Create a client
const client = jayson.Client.http({
  port: 9090
});

// Example usage functions
async function testPing() {
  return new Promise((resolve, reject) => {
    client.request('ping', [], (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function getInfo() {
  return new Promise((resolve, reject) => {
    client.request('info', [], (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function initializeFFmpeg() {
  return new Promise((resolve, reject) => {
    client.request('ffmpeg.initialize', [], (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function loadSubtitle(filePath) {
  return new Promise((resolve, reject) => {
    client.request('subtitle.loadFile', [filePath], (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function translateSubtitle(text, apiKey, language, context) {
  return new Promise((resolve, reject) => {
    const options = {
      text,
      apiKey,
      language,
      pieceNameOrContext: context,
      batchSize: 50,
      model: 'gemini-1.5-flash-8b'
    };
    client.request('subtitle.translate', [options], (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function saveSubtitle(filePath, content) {
  return new Promise((resolve, reject) => {
    client.request('subtitle.save', [filePath, content], (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// Main test function
async function main() {
  try {
    console.log('Testing AI Subtitle Translator API...\n');

    // Test ping
    console.log('1. Testing ping...');
    const pingResult = await testPing();
    console.log('   Response:', pingResult.result);

    // Get server info
    console.log('\n2. Getting server info...');
    const info = await getInfo();
    console.log('   Info:', info.result);

    // Initialize FFmpeg
    console.log('\n3. Initializing FFmpeg...');
    const ffmpegResult = await initializeFFmpeg();
    console.log('   FFmpeg path:', ffmpegResult.result.path);

    // Example: Load, translate, and save a subtitle
    // Uncomment and modify the following to test with real files:
    /*
    console.log('\n4. Loading subtitle file...');
    const loaded = await loadSubtitle('/path/to/subtitle.srt');
    console.log('   Loaded:', loaded.result.path);

    console.log('\n5. Translating subtitle...');
    const translated = await translateSubtitle(
      loaded.result.content,
      'YOUR_GEMINI_API_KEY',
      'Spanish',
      'The Last of Us Season 2 Episode 1'
    );
    console.log('   Translation complete!');

    console.log('\n6. Saving translated subtitle...');
    const saved = await saveSubtitle(
      '/path/to/subtitle_translated.srt',
      translated.result.translatedText
    );
    console.log('   Saved to:', saved.result.path);
    */

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export functions for use as module
module.exports = {
  testPing,
  getInfo,
  initializeFFmpeg,
  loadSubtitle,
  translateSubtitle,
  saveSubtitle
};