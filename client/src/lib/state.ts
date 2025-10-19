import { create } from 'zustand';

type FactorKey = 'sentiment' | 'technical' | 'fundamental' | 'macro' | 'volume';

type Factors = Record<FactorKey, number>;
type Weights = Record<FactorKey, number>;

const DEFAULT_FACTORS: Factors = {
  sentiment: 0.1,
  technical: -0.1,
  fundamental: 0.2,
  macro: 0.0,
  volume: 0.1,
};

const DEFAULT_WEIGHTS: Weights = {
  sentiment: 0.4,
  technical: 0.3,
  fundamental: 0.4,
  macro: 0.2,
  volume: 0.3,
};

const K = 2.2; // sigmoid sharpness

function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }

export const useSignalStore = create<{
  factors: Factors;
  weights: Weights;
  simSeries: number[];
  setFactor: (k: FactorKey, v: number) => void;
  setWeight: (k: FactorKey, v: number) => void;
  randomize: () => void;
  resetAll: () => void;
  score: number;
  prob: number;
  coord: { x: number; y: number };
  pushSimPoint: (v: number) => void;
  updateFromLiveTick: (price: number) => void;
}>((set, get) => ({
  factors: { ...DEFAULT_FACTORS },
  weights: { ...DEFAULT_WEIGHTS },
  simSeries: [],

  setFactor: (k, v) => set(s => ({ factors: { ...s.factors, [k]: v } })),
  setWeight: (k, v) => set(s => ({ weights: { ...s.weights, [k]: v } })),

  randomize: () => set(() => {
    const f: Partial<Factors> = {};
    const w: Partial<Weights> = {};
    (['sentiment','technical','fundamental','macro','volume'] as FactorKey[]).forEach(k => {
      f[k] = +(Math.random()*2 - 1).toFixed(2);
      w[k] = +(Math.random()*0.6 + 0.1).toFixed(2); // 0.1–0.7
    });
    return { factors: f as Factors, weights: w as Weights, simSeries: [] };
  }),

  resetAll: () => set(() => ({ factors: { ...DEFAULT_FACTORS }, weights: { ...DEFAULT_WEIGHTS }, simSeries: [] })),

  get score() {
    const { factors, weights } = get();
    const wsum = Object.values(weights).reduce((a,b)=>a+Math.abs(b),0) || 1;
    let s = 0;
    (Object.keys(factors) as FactorKey[]).forEach(k => { s += factors[k] * (weights[k] || 0); });
    return s / wsum;
  },

  get prob() {
    return sigmoid(K * get().score);
  },

  get coord() {
    const { factors } = get();
    const x = (factors.technical + factors.volume) / 2;
    const y = (factors.fundamental + factors.sentiment) / 2;
    return { x, y };
  },

  pushSimPoint: (v) => set(s => ({ simSeries: [...s.simSeries, v] })),

  // ใช้ราคาสดเป็นโมเมนตัมง่าย ๆ: ปรับ technical/volume ค่อย ๆ เข้าหาแนวโน้ม
  updateFromLiveTick: (() => {
    let lastPrice: number | null = null;
    return (price: number) => {
      set((s) => {
        if (lastPrice == null) lastPrice = price;
        const change = (price - lastPrice) / lastPrice;

        const technical = Math.max(-1, Math.min(1,
          s.factors.technical * 0.8 +
          Math.sign(change) * Math.min(Math.abs(change)*50, 1) * 0.2
        ));
        const volume = Math.max(-1, Math.min(1,
          s.factors.volume * 0.85 + (Math.abs(change)*80)
        ));

        // อัปเดต series ให้เห็นทิศ
        const L = s.simSeries.length;
        const base = L ? s.simSeries[L-1] : 1;
        const next = +(base * (1 + change)).toFixed(4);

        lastPrice = price;
        return { factors: { ...s.factors, technical, volume }, simSeries: [...s.simSeries, next] };
      });
    };
  })(),
}));
