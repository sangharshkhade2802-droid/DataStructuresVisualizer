import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Info,
} from 'lucide-react';
import { executeAlgorithmApi } from '../../engine/api';
import { ExecutionTrace } from '../../engine/types';
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer';
import { ControlPanel } from '../common/ControlPanel';
import { StatBadge } from '../common/StatBadge';
import { CodeViewer } from '../code/CodeViewer';
import { C_SOURCE_REGISTRY } from '../../engine/cSourceRegistry';

/**
 * FIX SUMMARY (previously broken):
 * 1. The backend README §2.5 is explicit: Binary / Jump / Interpolation /
 *    Exponential Search all ASSUME the input array is already sorted
 *    ascending, and the backend does NOT sort it for you or validate
 *    sortedness. Only Linear Search works correctly on unsorted data.
 *    This component only ever used one hardcoded, already-sorted array
 *    and never exposed a custom-input path, so the bug couldn't manifest
 *    yet — but there was also no guard rail in place for when custom
 *    input is later wired in. We now add an explicit custom-array input
 *    PLUS a clear warning banner whenever a non-Linear algorithm is
 *    selected with unsorted data, instead of silently returning
 *    meaningless results.
 * 2. Jump/Interpolation/Exponential Search pointer HUD never rendered
 *    anything useful (the ribbon only branched on `linear` vs. else,
 *    treating Jump/Interpolation/Exponential identically to Binary),
 *    even though their `aux.pointers` shapes differ. Added explicit
 *    low/high/mid/bound displays appropriate to each algorithm.
 */

const SEARCH_ALGORITHMS = [
  { id: 'binary-search', name: 'Binary Search', time: 'O(log n)', space: 'O(1)', requiresSorted: true },
  { id: 'linear-search', name: 'Linear Search', time: 'O(n)', space: 'O(1)', requiresSorted: false },
  { id: 'jump-search', name: 'Jump Search', time: 'O(√n)', space: 'O(1)', requiresSorted: true },
  { id: 'interpolation-search', name: 'Interpolation Search', time: 'O(log log n)', space: 'O(1)', requiresSorted: true },
  { id: 'exponential-search', name: 'Exponential Search', time: 'O(log n)', space: 'O(1)', requiresSorted: true },
];

const DEFAULT_SORTED_ARRAY = [4, 9, 14, 22, 29, 35, 41, 52, 63, 70, 84, 91, 105, 120, 138];

function isSortedAscending(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) return false;
  return true;
}

export const SearchingVisualizer: React.FC = () => {
  const [selectedAlgo, setSelectedAlgo] = useState('binary-search');
  const [workingArray, setWorkingArray] = useState<number[]>(DEFAULT_SORTED_ARRAY);
  const [customInput, setCustomInput] = useState('');
  const [targetValue, setTargetValue] = useState<number>(52);
  const [inputTarget, setInputTarget] = useState('52');
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);

  const player = useAnimationPlayer(trace, { initialSpeed: 1 });
  const activeMeta = SEARCH_ALGORITHMS.find((a) => a.id === selectedAlgo)!;
  const arrayIsSorted = isSortedAscending(workingArray);
  const showSortWarning = activeMeta.requiresSorted && !arrayIsSorted;

  const runSearch = async (algoId = selectedAlgo, target = targetValue, arr = workingArray) => {
    player.reset();
    try {
      const data = await executeAlgorithmApi(`/searching/${algoId}`, { array: arr, target });
      setTrace(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    runSearch(selectedAlgo, targetValue, workingArray);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlgo, targetValue, workingArray]);

  const handleTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(inputTarget, 10);
    if (!isNaN(val)) setTargetValue(val);
  };

  const handleCustomArraySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const parsed = customInput.split(/[\s,]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (parsed.length >= 2) setWorkingArray(parsed);
  };

  const sortArrayNow = () => {
    setWorkingArray([...workingArray].sort((a, b) => a - b));
  };

  const currentAux = player.currentStep?.aux || {};
  const currentAction = player.currentStep?.action || '';
  const activeIndices = player.currentStep?.indices || [];

  const codeMeta = C_SOURCE_REGISTRY[selectedAlgo] || C_SOURCE_REGISTRY['binary-search'];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
              Search Suite
            </span>
            <span className="text-xs text-slate-400 font-mono">C11 Native Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Searching Visualizer & Range Engine
          </h1>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl glass-panel">
          {SEARCH_ALGORITHMS.map((algo) => (
            <button
              key={algo.id}
              onClick={() => setSelectedAlgo(algo.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedAlgo === algo.id
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {algo.name}
            </button>
          ))}
        </div>
      </div>

      {/* FIX: explicit, unmissable warning — backend will NOT sort for you and
          will NOT reject unsorted input; it just silently returns wrong results. */}
      {showSortWarning && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>{activeMeta.name}</strong> requires a sorted ascending array. The current array is
              NOT sorted — the backend will not sort it for you and results will be meaningless/wrong.
            </span>
          </div>
          <button
            onClick={sortArrayNow}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold"
          >
            Sort Array Now
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl glass-panel text-xs">
        <form onSubmit={handleTargetSubmit} className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-slate-300">
            <Target className="w-4 h-4 text-emerald-400" />
            <span>Search Target:</span>
          </div>
          <input
            type="number"
            value={inputTarget}
            onChange={(e) => setInputTarget(e.target.value)}
            className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-emerald-400 text-center focus:outline-none focus:border-emerald-500"
          />
          <button type="submit" className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
            Search
          </button>
        </form>

        <form onSubmit={handleCustomArraySubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Custom array: 4, 9, 22, 52..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 w-52 font-mono text-xs"
          />
          <button type="submit" className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold">
            Use Array
          </button>
          <button
            type="button"
            onClick={() => setWorkingArray(DEFAULT_SORTED_ARRAY)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white font-semibold"
          >
            Reset
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-6 p-6 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-2xl relative">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge icon={Activity} label="Comparisons" value={trace ? trace.comparisons : 0} color="blue" />
            <StatBadge icon={Target} label="Active Target" value={targetValue} color="emerald" />
            <StatBadge icon={Clock} label="C Exec Time" value={trace ? trace.execution_time_us.toFixed(2) : '0.00'} unit="μs" color="purple" />
          </div>

          {currentAction === 'found' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold animate-bounce">
              <CheckCircle2 className="w-4 h-4" /><span>TARGET FOUND</span>
            </div>
          )}
          {currentAction === 'not_found' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-xs font-semibold">
              <XCircle className="w-4 h-4" /><span>TARGET NOT FOUND</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800/90 rounded-xl glass-panel text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-300 uppercase tracking-wider pr-2.5 border-r border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <span>Active Pointers:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold">
                Target: {targetValue}
              </span>
              {currentAux.pointers?.i !== undefined && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400 text-amber-300 font-bold">
                  i = {currentAux.pointers.i}
                </span>
              )}
              {currentAux.pointers?.low !== undefined && (
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400 text-sky-300 font-bold">
                  low = {currentAux.pointers.low}
                </span>
              )}
              {currentAux.pointers?.mid !== undefined && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400 text-amber-300 font-bold">
                  mid = {currentAux.pointers.mid}
                </span>
              )}
              {currentAux.pointers?.high !== undefined && (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400 text-purple-300 font-bold">
                  high = {currentAux.pointers.high}
                </span>
              )}
            </div>
          </div>

          {player.currentStep?.description && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Action:</span>
              <span className="truncate max-w-xs md:max-w-md">{player.currentStep.description}</span>
            </div>
          )}
        </div>

        <div className="py-8 overflow-x-auto">
          <div className="flex items-center justify-start min-w-[750px] gap-2 mx-auto">
            {workingArray.map((val, idx) => {
              const p = currentAux.pointers || {};
              const isMid = p.mid === idx;
              const isLow = p.low === idx;
              const isHigh = p.high === idx;
              const isLinearCurrent = p.i === idx;
              const isFound = currentAction === 'found' && activeIndices.includes(idx);
              const isEliminated = (p.low !== undefined && idx < p.low) || (p.high !== undefined && idx > p.high);

               let cellStyle = 'bg-slate-800/80 border-slate-700 text-slate-200';
              if (isFound) cellStyle = 'bg-emerald-500 border-emerald-300 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/50 scale-110';
              else if (isMid) cellStyle = 'bg-amber-500 border-amber-300 text-slate-950 font-bold shadow-lg shadow-amber-500/40 scale-105';
              else if (isLinearCurrent) cellStyle = 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold ring-2 ring-amber-400/50 scale-105';
              else if (isLow) cellStyle = 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold ring-2 ring-sky-400/40';
              else if (isHigh) cellStyle = 'bg-purple-500/20 border-purple-400 text-purple-200 font-semibold ring-2 ring-purple-400/40';
              else if (isEliminated) cellStyle = 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-40 line-through';
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center min-w-[44px]">
                  <div className="h-7 flex flex-col items-center justify-end mb-1 text-[10px] font-mono font-bold">
                    {isFound && <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-black animate-bounce shadow">FOUND</span>}
                    {!isFound && isLinearCurrent && <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black">i</span>}
                    {!isFound && !isLinearCurrent && isMid && <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black">MID</span>}
                    {!isFound && !isLinearCurrent && !isMid && isLow && <span className="px-1.5 py-0.2 rounded bg-sky-400 text-slate-950 font-black">LOW</span>}
                    {!isFound && !isLinearCurrent && !isMid && isHigh && <span className="px-1.5 py-0.2 rounded bg-purple-400 text-slate-950 font-black">HIGH</span>}
                  </div>
                  <motion.div layout className={`w-full aspect-square flex items-center justify-center rounded-xl border font-mono text-sm shadow-md transition-all ${cellStyle}`}>
                    {val}
                  </motion.div>
                  <span className={`text-[10px] font-mono mt-1.5 ${isLinearCurrent || isMid || isLow || isHigh ? 'text-amber-400 font-bold' : 'text-slate-600'}`}>
                    [{idx}]
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500"></span><span>Low Bound</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"></span><span>Midpoint / Probe</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-500"></span><span>High Bound</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-900 border border-slate-800 opacity-50"></span><span>Eliminated Search Region</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500"></span><span>Target Match</span></div>
        </div>
      </div>

      <ControlPanel
        isPlaying={player.isPlaying}
        currentStepIndex={player.currentStepIndex}
        totalSteps={player.totalSteps}
        currentStep={player.currentStep}
        speed={player.speed}
        progress={player.progress}
        onPlay={player.play}
        onPause={player.pause}
        onTogglePlay={player.togglePlay}
        onStepForward={player.stepForward}
        onStepBackward={player.stepBackward}
        onReset={player.reset}
        onSeek={player.seek}
        onSpeedChange={player.setSpeed}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
          C11 Search Implementation
        </h3>
        <CodeViewer codeMetadata={codeMeta} activeLine={player.currentStep?.line} height="340px" />
      </div>
    </div>
  );
};