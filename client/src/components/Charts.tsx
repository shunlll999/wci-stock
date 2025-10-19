'use client';

import React, { useMemo } from 'react';
import { Radar, Bar, Scatter, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, BarElement, CategoryScale, LinearScale, Filler, Tooltip, Legend,
} from 'chart.js';
import { useSignalStore } from '@/lib/state';

ChartJS.register(
  RadialLinearScale, PointElement, LineElement, BarElement, CategoryScale, LinearScale, Filler, Tooltip, Legend
);

export function Charts() {
  const { factors, weights, coord, simSeries } = useSignalStore();

  const labels = useMemo(() => [
    'Sentiment ข่าว/โซเชียล', 'Technical', 'งบ/Valuation', 'มหภาค/ดอกเบี้ย', 'Volume/Flow'
  ], []);

  const radarData = useMemo(() => ({
    labels,
    datasets: [{ label: 'Factors (-1..+1)', data: [
      factors.sentiment, factors.technical, factors.fundamental, factors.macro, factors.volume,
    ], fill: true }],
  }), [factors, labels]);

  const barData = useMemo(() => ({
    labels,
    datasets: [{ label: 'Weights (0..1)', data: [
      weights.sentiment, weights.technical, weights.fundamental, weights.macro, weights.volume,
    ]}],
  }), [weights, labels]);

  const scatterData = useMemo(() => ({
    datasets: [{
      label: 'พิกัดการประเมิน (x=momentum, y=value+sentiment)',
      data: [{ x: coord.x, y: coord.y }],
      pointRadius: 6,
    }]
  }), [coord]);

  const lineData = useMemo(() => ({
    labels: simSeries.map((_, i) => i + 1),
    datasets: [{ label: 'จำลองราคา (normalized)', data: simSeries }]
  }), [simSeries]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-[#161a22] p-3"><Radar data={radarData} options={{ scales:{ r:{ suggestedMin:-1, suggestedMax:1 }}}} /></div>
      <div className="rounded-xl border border-slate-800 bg-[#161a22] p-3"><Bar data={barData} options={{ scales:{ y:{ suggestedMin:0, suggestedMax:1 }}}} /></div>
      <div className="rounded-xl border border-slate-800 bg-[#161a22] p-3"><Scatter data={scatterData} options={{ scales:{ x:{ suggestedMin:-1, suggestedMax:1 }, y:{ suggestedMin:-1, suggestedMax:1 }}}} /></div>
      <div className="rounded-xl border border-slate-800 bg-[#161a22] p-3"><Line data={lineData} options={{ scales:{ y:{ suggestedMin:0.8, suggestedMax:1.2 }}}} /></div>
    </div>
  );
}
