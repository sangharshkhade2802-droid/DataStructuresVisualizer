import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Clock,
  TrendingUp,
  Info,
} from 'lucide-react';
import { compareAlgorithmsApi } from '../../engine/api';
import { ComparisonResult } from '../../engine/types';

/**
 * FIX SUMMARY (previously broken):
 * 1. The UI let the user CHECK/UNCHECK which of 6 algorithms to compare and
 *    sent that list to the backend as `algorithms`. Per README §2.9, the
 *    backend's /api/analyzer/compare endpoint runs a FIXED set of exactly
 *    six algorithms (Bubble, Selection, Insertion, Merge, Quick, Heap) —
 *    it is NOT configurable. The checkboxes were pure UI theater; toggling
 *    them changed nothing about what ran server-side, which is misleading.
 *    Fixed: checkboxes now only control which of the (always-six) RESULTS
 *    are displayed/charted, which is an honest client-side filter instead
 *    of a fake "which algorithms to run" control.
 * 2. Without an explicit `array`, the backend generates 50 RANDOM ints on
 *    every single call — meaning the previous "Run Benchmark" button (and
 *    the auto-run on every size-slider tick) produced non-reproducible
 *    results each time, even with the array size unchanged between runs.
 *    This is now made explicit: we always pass an explicit array (so this
 *    endpoint's one documented non-deterministic-by-default behavior is
 *    avoided) and label the "Randomize array" action separately from the
 *    (now reproducible) "Run Benchmark" action.
 */

const ALL_ALGORITHMS = ['Bubble Sort', 'Selection Sort', 'Insertion Sort', 'Merge Sort', 'Quick Sort', 'Heap Sort'];

const THEORETICAL_CURVES = [
  { n: 1, 'O(1)': 1, 'O(log n)': 0, 'O(n)': 1, 'O(n log n)': 0, 'O(n²)': 1 },
  { n: 2, 'O(1)': 1, 'O(log n)': 1, 'O(n)': 2, 'O(n log n)': 2, 'O(n²)': 4 },
  { n: 4, 'O(1)': 1, 'O(log n)': 2, 'O(n)': 4, 'O(n log n)': 8, 'O(n²)': 16 },
  { n: 8, 'O(1)': 1, 'O(log n)': 3, 'O(n)': 8, 'O(n log n)': 24, 'O(n²)': 64 },
  { n: 16, 'O(1)': 1, 'O(log n)': 4, 'O(n)': 16, 'O(n log n)': 64, 'O(n²)': 256 },
  { n: 32, 'O(1)': 1, 'O(log n)': 5, 'O(n)': 32, 'O(n log n)': 160, 'O(n²)': 1024 },
];

export const ComplexityCharts: React.FC = () => {
  const [visibleAlgos, setVisibleAlgos] = useState<string[]>([...ALL_ALGORITHMS]);
  const [arraySize, setArraySize] = useState(60);
  const [seedArray, setSeedArray] = useState<number[]>(
    Array.from({ length: 60 }, () => Math.floor(Math.random() * 1000))
  );
  const [comparisonData, setComparisonData] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runBenchmark = async (arr = seedArray) => {
    setIsLoading(true);
    try {
      // Always pass an explicit array — avoids the backend's documented
      // "50 random ints if omitted" non-determinism.
      const result = await compareAlgorithmsApi(arr);
      setComparisonData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const randomizeArray = (size = arraySize) => {
    const next = Array.from({ length: size }, () => Math.floor(Math.random() * 1000));
    setSeedArray(next);
    runBenchmark(next);
  };

  useEffect(() => {
    runBenchmark(seedArray);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAlgo = (name: string) => {
    if (visibleAlgos.includes(name)) {
      if (visibleAlgos.length > 1) setVisibleAlgos(visibleAlgos.filter((a) => a !== name));
    } else {
      setVisibleAlgos([...visibleAlgos, name]);
    }
  };

  const filteredMetrics = comparisonData?.metrics.filter((m) => visibleAlgos.includes(m.name)) || [];
  const chartData = filteredMetrics.map((m) => ({
    name: m.name,
    'Time (μs)': m.time_us,
    Comparisons: m.comparisons,
    Swaps: m.swaps,
    Operations: m.operations,
  }));

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
            Empirical Benchmark Suite
          </span>
          <span className="text-xs text-slate-400 font-mono">Microsecond Timing</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Computational Complexity & Multi-Algorithm Analyzer
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Distinguish theoretical Big-O asymptotic bounds from actual measured C execution time across identical datasets.
        </p>
      </div>

      <div className="flex items-start gap-2 px-4 py-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-mono">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          The backend's analyzer always runs all six algorithms shown below on the same input array —
          the algorithm list isn't configurable server-side. The checkboxes here only filter which
          results are displayed, they don't change what the C engine executes.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl glass-panel text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-mono mr-1">Show:</span>
          {ALL_ALGORITHMS.map((algo) => {
            const isChecked = visibleAlgos.includes(algo);
            return (
              <button
                key={algo}
                onClick={() => toggleAlgo(algo)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  isChecked
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{algo}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono">Input Size (N): {arraySize}</span>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={arraySize}
            onChange={(e) => {
              const sz = parseInt(e.target.value, 10);
              setArraySize(sz);
              randomizeArray(sz);
            }}
            className="w-28 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
          />
          <button
            onClick={() => randomizeArray()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            New Random Array
          </button>
          <button
            onClick={() => runBenchmark()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
          >
            <Clock className="w-3.5 h-3.5" /> Re-run on Same Array
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-200 font-mono uppercase tracking-wider">
                Actual Measured C Execution Time (μs)
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              N = {arraySize}
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} itemStyle={{ color: '#34d399' }} />
                <Bar dataKey="Time (μs)" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-sm text-slate-200 font-mono uppercase tracking-wider">
                Comparisons vs. Swaps Count
              </h3>
            </div>
            <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              N = {arraySize}
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Comparisons" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Swaps" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-slate-200 font-mono uppercase tracking-wider">
              Asymptotic Growth Curves Comparison
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Theoretical Big-O Orders</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={THEORETICAL_CURVES} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="n" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="O(1)" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="O(log n)" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="O(n)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="O(n log n)" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="O(n²)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-xl overflow-x-auto">
        <h3 className="font-bold text-sm text-slate-200 font-mono uppercase tracking-wider mb-3">
          Detailed Performance Audit Matrix (Input N = {arraySize})
        </h3>
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 px-3">Algorithm</th>
              <th className="py-2.5 px-3">Time Complexity</th>
              <th className="py-2.5 px-3">Space Complexity</th>
              <th className="py-2.5 px-3">Comparisons</th>
              <th className="py-2.5 px-3">Swaps</th>
              <th className="py-2.5 px-3">Total Operations</th>
              <th className="py-2.5 px-3 text-right">C Exec Time (μs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredMetrics.map((m) => (
              <tr key={m.name} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-3 font-semibold text-slate-100">{m.name}</td>
                <td className="py-3 px-3 text-emerald-400 font-semibold">{m.time_complexity}</td>
                <td className="py-3 px-3 text-sky-400">{m.space_complexity}</td>
                <td className="py-3 px-3 text-slate-300">{m.comparisons.toLocaleString()}</td>
                <td className="py-3 px-3 text-slate-300">{m.swaps.toLocaleString()}</td>
                <td className="py-3 px-3 text-purple-400 font-semibold">{m.operations.toLocaleString()}</td>
                <td className="py-3 px-3 text-right font-bold text-emerald-400">{m.time_us.toFixed(2)} μs</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};