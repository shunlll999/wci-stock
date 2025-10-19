// server.js (Node 18+)
import dotenv from "dotenv";
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
dotenv.config();

const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN;
if (!FINNHUB_TOKEN) {
  console.error("Missing FINNHUB_TOKEN");
  process.exit(1);
}

const FINNHUB_URL = `wss://ws.finnhub.io?token=${FINNHUB_TOKEN}`;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

// --- State ---
let fh; // Finnhub socket
let fhReady = false;
const subscribed = new Set(); // symbols subscribed on FH
const clients = new Map();    // ws -> { symbol: string|null }

function ensureFH() {
  if (fh && (fh.readyState === WebSocket.OPEN || fh.readyState === WebSocket.CONNECTING)) return;

  fhReady = false;
  fh = new WebSocket(FINNHUB_URL);

  fh.on("open", () => {
    fhReady = true;
    console.log("Connected to Finnhub");
    // resubscribe symbols after reconnect
    for (const sym of subscribed) {
      fh.send(JSON.stringify({ type: "subscribe", symbol: sym }));
    }
  });

  fh.on("message", (raw) => {
    // Broadcast เฉพาะให้ client ที่ต้องการ symbol นั้น
    console.log('FH message', raw.toString());
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "trade" && Array.isArray(msg.data)) {
        // กลุ่มตาม symbol
        const bySymbol = new Map();
        for (const t of msg.data) {
          if (!t || typeof t.s !== "string") continue;
          const arr = bySymbol.get(t.s) || [];
          arr.push(t);
          bySymbol.set(t.s, arr);
        }
        for (const [ws, meta] of clients.entries()) {
          if (ws.readyState !== WebSocket.OPEN) continue;
          if (!meta.symbol) continue;
          const pack = bySymbol.get(meta.symbol);
          if (pack && pack.length) {
            ws.send(JSON.stringify({ type: "trade", data: pack }));
          }
        }
      } else {
        // forward status/error ให้ทุก client เพื่อ debug ได้
        for (const ws of clients.keys()) {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  fh.on("close", () => {
    fhReady = false;
    console.log("Finnhub closed. Reconnecting in 2s...");
    setTimeout(ensureFH, 2000);
  });

  fh.on("error", (e) => {
    fhReady = false;
    console.error("Finnhub error:", e.message);
  });
}

ensureFH();

function subscribeSymbol(sym) {
  const symbol = String(sym || "").trim().toUpperCase();
  if (!symbol) return;
  if (subscribed.has(symbol)) return;
  subscribed.add(symbol);
  if (fhReady) fh.send(JSON.stringify({ type: "subscribe", symbol }));
}

function unsubscribeSymbol(sym) {
  const symbol = String(sym || "").trim().toUpperCase();
  if (!symbol) return;
  if (!subscribed.has(symbol)) return;
  subscribed.delete(symbol);
  if (fhReady) fh.send(JSON.stringify({ type: "unsubscribe", symbol }));
}

wss.on("connection", (ws) => {
  clients.set(ws, { symbol: null });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "setSymbol") {
        const next = String(msg.symbol || "").trim().toUpperCase();
        if (!next) {
          ws.send(JSON.stringify({ type: "error", msg: "symbol required" }));
          return;
        }
        const meta = clients.get(ws);
        const prev = meta?.symbol;

        // ปรับสถานะ client
        if (meta) meta.symbol = next; else clients.set(ws, { symbol: next });

        // จัดการ subscribe ที่ฝั่ง FH
        subscribeSymbol(next);

        // ถ้าไม่มี client คนอื่นใช้ prev แล้ว ค่อย unsubscribe เพื่อลด noise
        if (prev && prev !== next) {
          let stillUsed = false;
          for (const v of clients.values()) {
            if (v.symbol === prev) { stillUsed = true; break; }
          }
          if (!stillUsed) unsubscribeSymbol(prev);
        }

        ws.send(JSON.stringify({ type: "status", ok: true, symbol: next }));
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", msg: "Invalid client message" }));
    }
  });

  ws.on("close", () => {
    const meta = clients.get(ws);
    const prev = meta?.symbol;
    clients.delete(ws);

    // ถ้าไม่มี client ไหนใช้ prev แล้ว → unsubscribe ที่ FH
    if (prev) {
      let stillUsed = false;
      for (const v of clients.values()) {
        if (v.symbol === prev) { stillUsed = true; break; }
      }
      if (!stillUsed) unsubscribeSymbol(prev);
    }
  });
});

app.get("/health", (_req, res) => res.json({ ok: true, fhReady, subscribed: [...subscribed] }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
