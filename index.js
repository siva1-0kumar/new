import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import dotenv from "dotenv";
import net from "net";

dotenv.config();
console.log("🔍 CHECKPOINT: index.js loaded");

const { ELEVENLABS_AGENT_ID, ELEVENLABS_API_KEY } = process.env;

console.log("🔐 API Key loaded:", ELEVENLABS_API_KEY ? "✅ SET" : "❌ MISSING");
console.log("🎙 Voice ID:", ELEVENLABS_AGENT_ID ? "✅ SET" : "❌ MISSING");

const fastify = Fastify();
fastify.register(fastifyWebsocket);
console.log("✅ WebSocket plugin registered");

fastify.get("/", async (req, reply) => {
  reply.send({ status: "✅ WebSocket server is running" });
});

fastify.get("/ws", { websocket: true }, (connection) => {
  const telecmiSocket = connection.socket;
  console.log("📞 TeleCMI connected");

  if (!ELEVENLABS_AGENT_ID || !ELEVENLABS_API_KEY) {
    console.error("❌ Missing ElevenLabs credentials");
    telecmiSocket.close();
    return;
  }

  const elevenLabsSocket = new WebSocket(
    `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}`,
    {
      headers: {
        Authorization: `Bearer ${ELEVENLABS_API_KEY}`,
      },
    }
  );

  elevenLabsSocket.on("open", () => {
    console.log("🟢 Connected to ElevenLabs");

    elevenLabsSocket.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
    elevenLabsSocket.send(JSON.stringify({
      type: "agent_output_audio_format",
      audio_format: {
        encoding: "mulaw",
        sample_rate: 8000,
      },
    }));
    console.log("🛠 Requested μ-law 8000Hz audio from ElevenLabs");
  });

  elevenLabsSocket.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "ping") {
        elevenLabsSocket.send(JSON.stringify({ type: "pong", event_id: msg.event_id }));
      } else if (msg.audio) {
        const audioBuffer = Buffer.from(msg.audio, "base64");
        console.log("🔊 Received audio from ElevenLabs:", audioBuffer.length);
        if (telecmiSocket.readyState === WebSocket.OPEN) {
          telecmiSocket.send(audioBuffer);
          console.log("📨 Sent audio back to TeleCMI");
        }
      } else {
        console.log("📩 ElevenLabs message:", msg);
      }
    } catch (err) {
      console.error("❌ ElevenLabs parse error:", err.message);
    }
  });

  telecmiSocket.on("message", (data) => {
    try {
      console.log("📥 Received audio chunk from TeleCMI:", data.length, "bytes");
      const base64 = data.toString("base64");
      elevenLabsSocket.send(JSON.stringify({ user_audio_chunk: base64 }));
      console.log("🎧 Sent audio from TeleCMI to ElevenLabs");
    } catch (err) {
      console.error("❌ Audio error:", err.message);
    }
  });

  elevenLabsSocket.on("close", () => {
    console.log("🔌 ElevenLabs disconnected");
    if (telecmiSocket.readyState === WebSocket.OPEN) telecmiSocket.close();
  });

  telecmiSocket.on("close", () => {
    console.log("❎ TeleCMI disconnected");
    if (elevenLabsSocket.readyState === WebSocket.OPEN) elevenLabsSocket.close();
  });

  elevenLabsSocket.on("error", (err) => {
    console.error("💥 ElevenLabs error:", err.message);
  });

  telecmiSocket.on("error", (err) => {
    console.error("💥 TeleCMI error:", err.message);
  });
});

// Port bind logic with retry
const tryListen = (port) => {
  return new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once('error', err => err.code === 'EADDRINUSE' ? reject() : resolve(port))
      .once('listening', () => tester.close(() => resolve(port)))
      .listen(port);
  });
};

const startServer = async () => {
  let port = parseInt(process.env.PORT, 10) || 3020;
  while (true) {
    try {
      await tryListen(port);
      fastify.listen({ port, host: "0.0.0.0" }, (err, address) => {
        if (err) {
          console.error("❌ Server failed to start:", err);
          process.exit(1);
        }
        console.log(`🚀 WebSocket Proxy Server running on ${address}/ws`);
        console.log(`🔗 WebSocket endpoint: ws://localhost:${port}/ws`);
        console.log(`❤ Health check: http://localhost:${port}/`);
      });
      break;
    } catch {
      console.warn(`⚠ Port ${port} in use. Trying ${port + 1}...`);
      port++;
    }
  }
};

startServer();
