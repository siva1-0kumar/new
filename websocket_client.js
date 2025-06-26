
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const SERVER_URL = 'ws://localhost:3020/ws'; // Updated to local server URL
const ws = new WebSocket(SERVER_URL);

console.log('🔄 Attempting to connect to WebSocket server:', SERVER_URL);

ws.on('open', () => {
  console.log('🟢 Connected to WebSocket server');
  ws.send(JSON.stringify({ type: "hello", message: "Client test connection" }));

  const filePath = path.resolve('./test_audio.ulaw');
  try {
    const audioBuffer = fs.readFileSync(filePath);
    console.log(`📤 Sending μ-law audio (${audioBuffer.length} bytes)`);
    ws.send(audioBuffer);
  } catch (err) {
    console.error('❌ Failed to load test_audio.ulaw:', err.message);
  }
});

ws.on('error', (err) => {
  console.error('💥 WebSocket connection error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`❎ WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`);
});

ws.on('error', (err) => {
  console.error('💥 WebSocket error:', err.message);
});

ws.on('message', (data, isBinary) => {
  console.log(`📥 Received message. Binary: ${isBinary}, Length: ${data.length}`);
  if (!isBinary) {
    try {
      const json = JSON.parse(data.toString());
      console.log('📥 Received JSON:', json);
    } catch (err) {
      console.log('📩 Received non-binary message:', data.toString());
    }
  } else {
    console.log('📥 Received audio response from ElevenLabs:', data.length, 'bytes');
    const outputPath = path.resolve('./output_response.ulaw');
    fs.appendFileSync(outputPath, data);
  }
});

ws.on('close', () => {
  console.log('❎ WebSocket connection closed');
});

ws.on('error', (err) => {
  console.error('💥 WebSocket error:', err.message);
});
