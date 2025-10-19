'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useSignalStore } from '@/lib/state';
import { Charts } from '@/components/Charts';

export default function Page() {
  const {
    factors, weights, setFactor, setWeight,
    score, prob, coord, randomize, resetAll,
    pushSimPoint, updateFromLiveTick,
  } = useSignalStore();

  const [symbol, setSymbol] = useState('NVDA');
  const wsRef = useRef<WebSocket | null>(null);

  const factorList = useMemo(() => ([
    { key: 'sentiment', label: 'Sentiment ข่าว/โซเชียล' },
    { key: 'technical', label: 'Technical (RSI/MACD)' },
    { key: 'fundamental', label: 'งบ/Valuation' },
    { key: 'macro', label: 'มหภาค/ดอกเบี้ย' },
    { key: 'volume', label: 'Volume/Flow' },
  ] as const), []);

  const connectWS = () => {
    const url = process.env.NEXT_PUBLIC_STREAM_URL!;
    if (!url) { alert('NEXT_PUBLIC_STREAM_URL is not set'); return; }
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(url);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'setSymbol', symbol }));
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        // Finnhub: { type:"trade", data:[{ p, s, t, v }, ... ] }
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          const last = msg.data[msg.data.length - 1];
          if (last && typeof last.p === 'number') {
            updateFromLiveTick(last.p);
          }
        }
      } catch {}
    };
    ws.onclose = () => {};
    ws.onerror = () => {};
    wsRef.current = ws;
  };

  const simulate30 = () => {
    // ใช้ prob เป็น bias เดินแบบ random walk 30 จุด (normalized)
    const steps = 30;
    let last = 1;
    for (let t=0; t<steps; t++) {
      const dir = Math.random() < prob ? 1 : -1;
      const vol = 0.005 + Math.random()*0.01; // 0.5% - 1.5%
      last = +(last * (1 + dir*vol)).toFixed(4);
      pushSimPoint(last);
    }
  };

  return (
    <div className="min-h-dvh text-slate-100" style={{background:'linear-gradient(180deg,#0d0f14,#0f1115)'}}>
      <header className="sticky top-0 z-10 backdrop-blur bg-black/30 border-b border-slate-800">
        <div className="px-4 py-3 font-semibold">
          📈 Stock Signal Playground — <span className="text-slate-400">พิกัดการประเมิน AI (Next.js)</span>
        </div>
      </header>

      <main className="grid gap-4 px-4 py-4 lg:grid-cols-[360px_1fr]">
        {/* Controls */}
        <section className="rounded-xl border border-slate-800 bg-[#161a22] p-4">
          <h3 className="text-lg font-semibold mb-1">ตั้งค่าปัจจัย (Factors)</h3>
          <p className="text-xs text-slate-400 mb-3">ช่วงค่า: -1 → +1</p>

          <div className="flex flex-col gap-3">
            {factorList.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="w-40 text-sm">{f.label}</div>
                <input
                  type="range" min={-1} max={1} step={0.01}
                  value={factors[f.key]}
                  onChange={e => setFactor(f.key, parseFloat(e.target.value))}
                  className="flex-1"
                />
                <div className="tabular-nums w-16 text-right">{factors[f.key].toFixed(2)}</div>
              </div>
            ))}
          </div>

          <hr className="border-slate-800/50 my-4" />

          <h3 className="text-lg font-semibold mb-2">น้ำหนัก (Weights)</h3>
          <div className="flex flex-col gap-3">
            {factorList.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="w-40 text-sm">{f.label}</div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={weights[f.key]}
                  onChange={e => setWeight(f.key, parseFloat(e.target.value))}
                  className="flex-1"
                />
                <div className="tabular-nums w-16 text-right">{weights[f.key].toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="justify-between items-center mt-4">
            <div className="flex gap-2 items-center">
              <input
                className="px-2 py-1 rounded-md bg-transparent border border-slate-700 text-sm"
                placeholder="เช่น AAPL"
                value={symbol}
                onChange={(e)=>setSymbol(e.target.value.toUpperCase())}
              />
              <button onClick={connectWS} className="px-3 py-2 rounded-lg font-bold border border-slate-700 text-blue-300">
                Connect WS
              </button>
            </div>

            <div className="gap-2">
              <button onClick={randomize} className="px-3 py-2 rounded-lg font-bold border border-slate-700 text-blue-300">Randomize</button>
              <button onClick={resetAll} className="px-3 py-2 rounded-lg font-bold border border-slate-700 text-blue-300">Reset</button>
              <button onClick={simulate30} className="px-3 py-2 rounded-lg font-bold bg-blue-400/90 text-slate-950">Simulate 30 วัน</button>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-2">
            สูตรตัวอย่าง: score = Σ (factor × weight) / Σ|weight| → probability = σ(k·score)
          </p>
        </section>

        {/* Visuals */}
        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-[#161a22] p-4 text-center">
              <div className="text-xs text-slate-400">สรุปคะแนน (Score)</div>
              <div className="text-3xl font-extrabold tabular-nums">{score.toFixed(3)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#161a22] p-4 text-center">
              <div className="text-xs text-slate-400">โอกาสขึ้น (Prob Up)</div>
              <div className="text-3xl font-extrabold tabular-nums">{(prob*100).toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#161a22] p-4 text-center">
              <div className="text-xs text-slate-400">พิกัดการประเมิน (x,y)</div>
              <div className="text-3xl font-extrabold tabular-nums">
                ({coord.x.toFixed(2)}, {coord.y.toFixed(2)})
              </div>
            </div>
          </div>

          <Charts />
        </section>
      </main>

      <footer className="px-4 py-6 text-center text-slate-400">
        ตัวอย่างเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน © 2025
      </footer>
    </div>
  );
}
