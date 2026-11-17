import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
      Shuffle,
      Sparkles,
      Clock,
      Flame,
      Activity,
      Sliders,
      Send,
      Eye,
      Info
    } from 'lucide-react';
import { executeAlgorithmApi } from '../../engine/api';
import { ExecutionStep, ExecutionTrace } from '../../engine/types';
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer';
import { ControlPanel } from '../common/ControlPanel';
import { StatBadge } from '../common/StatBadge';
import { CodeViewer } from '../code/CodeViewer';
import { C_SOURCE_REGISTRY } from '../../engine/cSourceRegistry';

const SORTING_ALGORITHMS = [
  { id: 'bubble-sort', name: 'Bubble Sort', time: 'O(n²)', space: 'O(1)' },
  { id: 'selection-sort', name: 'Selection Sort', time: 'O(n²)', space: 'O(1)' },
  { id: 'insertion-sort', name: 'Insertion Sort', time: 'O(n²)', space: 'O(1)' },
  { id: 'merge-sort', name: 'Merge Sort', time: 'O(n log n)', space: 'O(n)' },
  { id: 'quick-sort', name: 'Quick Sort', time: 'O(n log n)', space: 'O(log n)' },
  { id: 'heap-sort', name: 'Heap Sort', time: 'O(n log n)', space: 'O(1)' },
  { id: 'counting-sort', name: 'Counting Sort', time: 'O(n + k)', space: 'O(k)' },
  { id: 'radix-sort', name: 'Radix Sort', time: 'O(d(n+b))', space: 'O(n+b)' },
  { id: 'shell-sort', name: 'Shell Sort', time: 'O(n log² n)', space: 'O(1)' },
  { id: 'bucket-sort', name: 'Bucket Sort', time: 'O(n + k)', space: 'O(n)' },
];

export interface PointerBadge {
  name: string;
  index: number;
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  arrowBorderColor: string;
  role: string;
}

/**
 * Resolves active pointer positions (i, j, min, pivot, key, etc.)
 * Checks step.aux.pointers first, and falls back to algorithm heuristics.
 */
function getPointersForStep(
  step: ExecutionStep | null | undefined, 
  algoId: string, 
  arrLength: number
): PointerBadge[] {
  if (!step) return [];
  const badges: PointerBadge[] = [];

  const addBadge = (name: string, index: number, customRole?: string) => {
    if (typeof index !== 'number' || isNaN(index) || index < 0 || index >= arrLength) return;
    if (badges.some(b => b.name === name && b.index === index)) return;

    let style = {
      bgColor: 'bg-slate-700',
      borderColor: 'border-slate-500',
      textColor: 'text-slate-200',
      arrowBorderColor: '#64748b',
      role: customRole || `${name} pointer`,
    };

    if (name === 'i') {
      style = {
        bgColor: 'bg-sky-500/30',
        borderColor: 'border-sky-400',
        textColor: 'text-sky-300',
        arrowBorderColor: '#38bdf8',
        role: customRole || 'Outer loop / boundary pointer (i)',
      };
    } else if (name === 'j') {
      style = {
        bgColor: 'bg-amber-500/30',
        borderColor: 'border-amber-400',
        textColor: 'text-amber-300',
        arrowBorderColor: '#fbbf24',
        role: customRole || 'Inner loop scanning pointer (j)',
      };
    } else if (name === 'j+1') {
      style = {
        bgColor: 'bg-orange-500/30',
        borderColor: 'border-orange-400',
        textColor: 'text-orange-300',
        arrowBorderColor: '#fb923c',
        role: customRole || 'Adjacent comparison pointer (j + 1)',
      };
    } else if (name === 'min' || name === 'min_idx') {
      style = {
        bgColor: 'bg-rose-500/30',
        borderColor: 'border-rose-400',
        textColor: 'text-rose-300',
        arrowBorderColor: '#fb7185',
        role: customRole || 'Current minimum element (min_idx)',
      };
    } else if (name === 'key') {
      style = {
        bgColor: 'bg-yellow-500/30',
        borderColor: 'border-yellow-400',
        textColor: 'text-yellow-300',
        arrowBorderColor: '#facc15',
        role: customRole || 'Element being inserted (key)',
      };
    } else if (name === 'pivot') {
      style = {
        bgColor: 'bg-purple-500/30',
        borderColor: 'border-purple-400',
        textColor: 'text-purple-300',
        arrowBorderColor: '#c084fc',
        role: customRole || 'Partition pivot element',
      };
    } else if (name === 'low' || name === 'l') {
      style = {
        bgColor: 'bg-indigo-500/30',
        borderColor: 'border-indigo-400',
        textColor: 'text-indigo-300',
        arrowBorderColor: '#818cf8',
        role: customRole || 'Subarray start boundary (low)',
      };
    } else if (name === 'high' || name === 'r') {
      style = {
        bgColor: 'bg-fuchsia-500/30',
        borderColor: 'border-fuchsia-400',
        textColor: 'text-fuchsia-300',
        arrowBorderColor: '#e879f9',
        role: customRole || 'Subarray end boundary (high)',
      };
    } else if (name === 'mid' || name === 'm') {
      style = {
        bgColor: 'bg-teal-500/30',
        borderColor: 'border-teal-400',
        textColor: 'text-teal-300',
        arrowBorderColor: '#2dd4bf',
        role: customRole || 'Subarray midpoint (mid)',
      };
    } else if (name === 'k') {
      style = {
        bgColor: 'bg-emerald-500/30',
        borderColor: 'border-emerald-400',
        textColor: 'text-emerald-300',
        arrowBorderColor: '#34d399',
        role: customRole || 'Placement destination pointer (k)',
      };
    } else if (name === 'root') {
      style = {
        bgColor: 'bg-blue-500/30',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-300',
        arrowBorderColor: '#60a5fa',
        role: customRole || 'Heap root (max element)',
      };
    } else if (name === 'largest') {
      style = {
        bgColor: 'bg-amber-500/30',
        borderColor: 'border-amber-400',
        textColor: 'text-amber-300',
        arrowBorderColor: '#fbbf24',
        role: customRole || 'Largest child in heapify',
      };
    } else if (name === 'left') {
      style = {
        bgColor: 'bg-cyan-500/30',
        borderColor: 'border-cyan-400',
        textColor: 'text-cyan-300',
        arrowBorderColor: '#22d3ee',
        role: customRole || 'Left child index (2*i + 1)',
      };
    } else if (name === 'right') {
      style = {
        bgColor: 'bg-pink-500/30',
        borderColor: 'border-pink-400',
        textColor: 'text-pink-300',
        arrowBorderColor: '#f472b6',
        role: customRole || 'Right child index (2*i + 2)',
      };
    } else if (name === 'sorted') {
      style = {
        bgColor: 'bg-emerald-500/30',
        borderColor: 'border-emerald-400',
        textColor: 'text-emerald-300',
        arrowBorderColor: '#34d399',
        role: customRole || 'Locked sorted element',
      };
    }

    badges.push({
      name,
      index,
      label: name,
      bgColor: style.bgColor,
      borderColor: style.borderColor,
      textColor: style.textColor,
      arrowBorderColor: style.arrowBorderColor,
      role: style.role,
    });
  };

  // 1. First extract from step.aux?.pointers if provided
  if (step.aux && step.aux.pointers && typeof step.aux.pointers === 'object') {
    for (const [key, val] of Object.entries(step.aux.pointers)) {
      if (typeof val === 'number') {
        addBadge(key, val);
      }
    }
  }

  // 2. Fallback heuristic extraction
  const indices = step.indices || [];
  const action = step.action || '';

  if (badges.length === 0) {
    if (algoId.includes('bubble')) {
      if ((action === 'compare' || action === 'swap') && indices.length >= 2) {
        addBadge('j', indices[0]);
        addBadge('j+1', indices[1]);
      } else if (action === 'mark_sorted' && indices.length >= 1) {
        addBadge('sorted', indices[0]);
      }
    } else if (algoId.includes('selection')) {
      if (action === 'compare' && indices.length >= 2) {
        addBadge('j', indices[0]);
        addBadge('min', indices[1]);
      } else if (action === 'swap' && indices.length >= 2) {
        addBadge('i', indices[0]);
        addBadge('min', indices[1]);
      } else if (action === 'select' && indices.length >= 1) {
        addBadge('min', indices[0]);
      } else if (action === 'highlight' && indices.length >= 1) {
        addBadge('i', indices[0]);
      } else if (action === 'mark_sorted' && indices.length >= 1) {
        addBadge('sorted', indices[0]);
      }
    } else if (algoId.includes('insertion')) {
      if (action === 'select' && indices.length >= 1) {
        addBadge('key', indices[0]);
        addBadge('i', indices[0]);
      } else if ((action === 'compare' || action === 'shift') && indices.length >= 2) {
        addBadge('j', indices[0]);
        addBadge('j+1', indices[1]);
      } else if (action === 'insert' && indices.length >= 1) {
        addBadge('key', indices[0]);
      }
    } else if (algoId.includes('quick')) {
      if (action === 'pivot' && indices.length >= 1) {
        addBadge('pivot', indices[0]);
      } else if (action === 'compare' && indices.length >= 2) {
        addBadge('j', indices[0]);
        addBadge('pivot', indices[1]);
      } else if (action === 'swap' && indices.length >= 2) {
        addBadge('i', indices[0]);
        addBadge('j', indices[1]);
      } else if (action === 'mark_sorted' && indices.length >= 1) {
        addBadge('sorted', indices[0]);
      }
    } else if (algoId.includes('merge')) {
      if (action === 'split' && indices.length >= 2) {
        addBadge('low', indices[0]);
        addBadge('high', indices[1]);
      } else if (action === 'compare' && indices.length >= 2) {
        addBadge('i', indices[0]);
        addBadge('j', indices[1]);
      } else if (action === 'overwrite' && indices.length >= 1) {
        addBadge('k', indices[0]);
      }
    } else if (algoId.includes('heap')) {
      if (action === 'compare' && indices.length >= 2) {
        addBadge('left', indices[0]);
        addBadge('largest', indices[1]);
      } else if (action === 'swap' && indices.length >= 2) {
        addBadge('root', indices[0]);
        addBadge('i', indices[1]);
      } else if (action === 'mark_sorted' && indices.length >= 1) {
        addBadge('sorted', indices[0]);
      }
    } else if (algoId.includes('shell')) {
      if (action === 'select' && indices.length >= 1) {
        addBadge('i', indices[0]);
      } else if (action === 'compare' && indices.length >= 2) {
        addBadge('j-gap', indices[0]);
        addBadge('j', indices[1]);
      } else if (action === 'insert' && indices.length >= 1) {
        addBadge('j', indices[0]);
      }
    } else {
      if (indices.length >= 1) addBadge('i', indices[0]);
      if (indices.length >= 2) addBadge('j', indices[1]);
    }
  }

  return badges;
}

function getAlgorithmPointerDescriptions(algoId: string) {
  if (algoId.includes('bubble')) {
    return [
      { pointer: 'i', name: 'Pass Boundary', desc: 'Tracks the sorted boundary; each pass locks the largest element at the end.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
      { pointer: 'j', name: 'Scanner Pointer', desc: 'Current element in the inner loop being compared with arr[j+1].', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
      { pointer: 'j+1', name: 'Adjacent Partner', desc: 'Adjacent element compared with j. If arr[j] > arr[j+1], they swap.', badgeClass: 'bg-orange-500/20 text-orange-300 border border-orange-400' },
    ];
  }
  if (algoId.includes('selection')) {
    return [
      { pointer: 'i', name: 'Sorted Target Slot', desc: 'Starting index of unsorted partition where the minimum will be placed.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
      { pointer: 'j', name: 'Scanner Pointer', desc: 'Iterates through the remaining unsorted elements looking for a smaller value.', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
      { pointer: 'min', name: 'Current Minimum', desc: 'Index holding the smallest element found so far in the current pass.', badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-400' },
    ];
  }
  if (algoId.includes('insertion')) {
    return [
      { pointer: 'key / i', name: 'Key Element', desc: 'Element currently extracted from index i to be inserted into the sorted subarray.', badgeClass: 'bg-yellow-500/20 text-yellow-300 border border-yellow-400' },
      { pointer: 'j', name: 'Shift Scanner', desc: 'Scans backward through sorted portion; shifts elements greater than key to the right.', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
      { pointer: 'j+1', name: 'Insertion Slot', desc: 'Exact slot where key is inserted once all larger elements have shifted.', badgeClass: 'bg-orange-500/20 text-orange-300 border border-orange-400' },
    ];
  }
  if (algoId.includes('quick')) {
    return [
      { pointer: 'pivot', name: 'Pivot Element', desc: 'Benchmark element chosen (usually high index) to partition array into smaller/larger halves.', badgeClass: 'bg-purple-500/20 text-purple-300 border border-purple-400' },
      { pointer: 'i', name: 'Partition Boundary', desc: 'Index boundary marking the rightmost element known to be smaller than pivot.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
      { pointer: 'j', name: 'Scanner Pointer', desc: 'Iterates through subarray; elements smaller than pivot are swapped into position i+1.', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
    ];
  }
  if (algoId.includes('merge')) {
    return [
      { pointer: 'low / high', name: 'Subarray Bounds', desc: 'Range [low..high] currently being divided or merged.', badgeClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-400' },
      { pointer: 'mid', name: 'Midpoint', desc: 'Center index splitting the subarray into left and right halves.', badgeClass: 'bg-teal-500/20 text-teal-300 border border-teal-400' },
      { pointer: 'i / j', name: 'Left / Right Pointers', desc: 'Pointers traversing the left and right halves to pick the next smallest element.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
      { pointer: 'k', name: 'Merged Index', desc: 'Destination position in main array where the chosen element is written.', badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400' },
    ];
  }
  if (algoId.includes('heap')) {
    return [
      { pointer: 'root', name: 'Max Root', desc: 'Index 0 holding the maximum element of the max-heap.', badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-400' },
      { pointer: 'i', name: 'Heap End', desc: 'Shrinking boundary of unsorted heap; maximum elements are swapped here.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
      { pointer: 'largest', name: 'Largest Child', desc: 'Tracks the largest value between parent (i), left child, and right child in heapify.', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
    ];
  }
  if (algoId.includes('shell')) {
    return [
      { pointer: 'gap', name: 'Gap Distance', desc: 'Interval spacing between elements compared in current pass (e.g., n/2, n/4, 1).', badgeClass: 'bg-slate-500/20 text-slate-300 border border-slate-400' },
      { pointer: 'i', name: 'Current Element', desc: 'Index of element being inserted across gap spacing.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
      { pointer: 'j', name: 'Gap Step Pointer', desc: 'Jumps backward by gap to compare and shift elements in interleaved subarrays.', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
    ];
  }
  return [
    { pointer: 'i', name: 'Primary Pointer', desc: 'Primary iterator traversing array elements.', badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-400' },
    { pointer: 'j', name: 'Secondary Pointer', desc: 'Secondary comparison or scanning pointer.', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-400' },
  ];
}

export const SortingVisualizer: React.FC = () => {
  const [selectedAlgo, setSelectedAlgo] = useState('bubble-sort');
  const [arraySize, setArraySize] = useState(14);
  const [currentArray, setCurrentArray] = useState<number[]>([29, 10, 14, 37, 13, 42, 18, 25, 5, 48, 31, 22, 19, 34]);
  const [customInput, setCustomInput] = useState('');
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [, setIsLoading] = useState(false);

  // Player hook
  const player = useAnimationPlayer(trace, { initialSpeed: 1 });

  // Generate presets
  const generateRandom = (size = arraySize) => {
    const newArr = Array.from({ length: size }, () => Math.floor(Math.random() * 85) + 10);
    setCurrentArray(newArr);
    runAlgorithm(selectedAlgo, newArr);
  };

  const generateNearlySorted = () => {
    const arr = Array.from({ length: arraySize }, (_, i) => (i + 1) * 6);
    const i1 = Math.floor(Math.random() * (arraySize - 2));
    const t = arr[i1]; arr[i1] = arr[i1 + 1]; arr[i1 + 1] = t;
    setCurrentArray(arr);
    runAlgorithm(selectedAlgo, arr);
  };

  const generateReversed = () => {
    const arr = Array.from({ length: arraySize }, (_, i) => (arraySize - i) * 6 + 10);
    setCurrentArray(arr);
    runAlgorithm(selectedAlgo, arr);
  };

  const runAlgorithm = async (algoId = selectedAlgo, arr = currentArray) => {
    setIsLoading(true);
    player.reset();
    try {
      const data = await executeAlgorithmApi(`/sorting/${algoId}`, { array: arr });
      setTrace(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runAlgorithm(selectedAlgo, currentArray);
  }, [selectedAlgo]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const parsed = customInput
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0 && n <= 200);
    if (parsed.length >= 3) {
      setCurrentArray(parsed);
      setArraySize(parsed.length);
      runAlgorithm(selectedAlgo, parsed);
    }
  };

  // Determine current display array and highlights
  const displayArray = player.currentStep?.array?.length ? player.currentStep.array : currentArray;
  const activeIndices = player.currentStep?.indices || [];
  const activeAction = player.currentStep?.action || '';
  const maxVal = Math.max(...displayArray, 1);

  // Active Pointers for current step
  const activePointers = getPointersForStep(player.currentStep, selectedAlgo, displayArray.length);

  const codeMeta = C_SOURCE_REGISTRY[selectedAlgo] || C_SOURCE_REGISTRY['quick-sort'];
  const hasNegativeValues = currentArray.some((v) => v < 0);
    const showRadixWarning = selectedAlgo === 'radix-sort' && hasNegativeValues;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header Title & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Sorting Suite
            </span>
            <span className="text-xs text-slate-400 font-mono">C11 Native Engine • Step Execution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sorting Visualizer & Pointer Tracer
          </h1>
        </div>

        {/* Algorithm Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl glass-panel">
          {SORTING_ALGORITHMS.map((algo) => (
            <button
              key={algo.id}
              onClick={() => setSelectedAlgo(algo.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedAlgo === algo.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {algo.name}
            </button>
          ))}
        </div>
      </div>

      {/* Array Configuration & Generator Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl glass-panel text-xs">
        {/* Preset Generators */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => generateRandom()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all font-medium"
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Randomize</span>
          </button>
          <button
            onClick={generateNearlySorted}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
          >
            Nearly Sorted
          </button>
          <button
            onClick={generateReversed}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
          >
            Reversed
          </button>
        </div>

        {/* Size Slider */}
        <div className="flex items-center gap-2.5">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Size: {arraySize}</span>
          <input
            type="range"
            min={6}
            max={28}
            value={arraySize}
            onChange={(e) => {
              const sz = parseInt(e.target.value, 10);
              setArraySize(sz);
              generateRandom(sz);
            }}
            className="w-24 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Custom Input Form */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Custom: 50, 20, 80, 10"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 w-44 font-mono text-xs"
          />
          <button
            type="submit"
            className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
            title="Apply custom array"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
 
    {showRadixWarning && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            Radix Sort assumes non-negative integers. Your custom array contains negative
            values — the backend will sort these INCORRECTLY (documented limitation,
            not a bug). Switch algorithms or remove negative values.
          </span>
        </div>
      )}

      {/* Main Visualizer Stage */}

      <div className="flex flex-col gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-2xl relative overflow-hidden">
        {/* Metric Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge
              icon={Activity}
              label="Comparisons"
              value={trace ? trace.comparisons : 0}
              color="blue"
            />
            <StatBadge
              icon={Flame}
              label="Swaps"
              value={trace ? trace.swaps : 0}
              color="amber"
            />
            <StatBadge
              icon={Sparkles}
              label="Operations"
              value={trace ? trace.operations : 0}
              color="purple"
            />
            <StatBadge
              icon={Clock}
              label="C Exec Time"
              value={trace ? trace.execution_time_us.toFixed(2) : '0.00'}
              unit="μs"
              color="emerald"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Time: <span className="text-emerald-400 font-semibold">{SORTING_ALGORITHMS.find(a => a.id === selectedAlgo)?.time}</span></span>
            <span>•</span>
            <span>Space: <span className="text-sky-400 font-semibold">{SORTING_ALGORITHMS.find(a => a.id === selectedAlgo)?.space}</span></span>
          </div>
        </div>

        {/* Live Active Pointers HUD Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/90 border border-slate-800 rounded-xl glass-panel text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-200 uppercase tracking-wider pr-2.5 border-r border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" />
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Pointers:</span>
            </div>

            {activePointers.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {activePointers.map((p) => {
                  const valAtIdx = displayArray[p.index];
                  return (
                    <motion.div
                      key={`${p.name}-${p.index}`}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs shadow-md"
                      title={p.role}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${p.bgColor} ${p.borderColor} ${p.textColor} border`}>
                        {p.name}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-200">
                        arr[<span className="text-white font-bold">{p.index}</span>] = <span className="text-amber-300 font-extrabold">{valAtIdx}</span>
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <span className="font-mono text-slate-500 italic">No scanning pointers active in this state</span>
            )}
          </div>

          {/* Current Step Description Pill */}
          {player.currentStep?.description && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 max-w-full">
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Action:</span>
              <span className="truncate max-w-xs md:max-w-md">{player.currentStep.description}</span>
            </div>
          )}
        </div>

        {/* Animated Bar Canvas with Fixed Height Track (Guarantees visible vertical bars) */}
        <div className="flex items-end justify-center gap-1.5 sm:gap-2 pt-6 px-2 pb-2 overflow-x-auto min-h-[380px]">
          {displayArray.map((val, idx) => {
            const isComparing = activeAction === 'compare' && activeIndices.includes(idx);
            const isSwapping = (activeAction === 'swap' || activeAction === 'shift' || activeAction === 'overwrite') && activeIndices.includes(idx);
            const isPivot = activeAction === 'pivot' && activeIndices.includes(idx);
            const isSorted = activeAction === 'mark_sorted' && activeIndices.includes(idx);

            // Get pointers pointing to this index
            const pointersAtIdx = activePointers.filter(p => p.index === idx);
            const hasPointers = pointersAtIdx.length > 0;

            let barColor = 'from-slate-700 to-slate-800 border-slate-600/80 text-slate-300';
            if (isComparing) {
              barColor = 'from-amber-400 to-amber-600 border-amber-300 shadow-lg shadow-amber-500/40 text-amber-950 font-bold';
            } else if (isSwapping) {
              barColor = 'from-rose-500 to-rose-600 border-rose-400 shadow-lg shadow-rose-500/50 text-white font-bold';
            } else if (isPivot) {
              barColor = 'from-purple-500 to-purple-600 border-purple-400 shadow-lg shadow-purple-500/50 text-white font-bold';
            } else if (isSorted) {
              barColor = 'from-emerald-400 to-emerald-600 border-emerald-300 shadow-lg shadow-emerald-500/40 text-emerald-950 font-bold';
            }

            // Calculate height percentage (min 10% to max 100%)
            const heightPct = Math.max(10, Math.round((val / maxVal) * 100));

            return (
              <div key={idx} className="flex-1 flex flex-col items-center max-w-[48px] min-w-[28px] justify-end group relative">
                {/* Value pill atop bar */}
                <motion.div 
                  animate={{ y: isComparing || isSwapping ? -4 : 0 }}
                  className="h-6 flex items-end justify-center mb-1.5"
                >
                  <span className={`text-[11px] font-mono transition-colors ${
                    isComparing ? 'text-amber-300 font-extrabold' : 
                    isSwapping ? 'text-rose-400 font-extrabold' : 
                    isPivot ? 'text-purple-400 font-extrabold' : 
                    hasPointers ? 'text-white font-bold' : 'text-slate-400'
                  }`}>
                    {val}
                  </span>
                </motion.div>

                {/* Explicit Height Bar Track (260px) guaranteeing bars are always visible */}
                <div className="h-[260px] w-full flex items-end justify-center relative">
                  <motion.div
                    layout
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-xl bg-gradient-to-t border transition-all relative ${barColor} ${
                      hasPointers ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-lg shadow-amber-500/30' : ''
                    }`}
                  />
                </div>

                {/* Pointer Indicators Directly Below Bar Track */}
                <div className="flex flex-col items-center justify-start mt-2 w-full min-h-[48px]">
                  {hasPointers ? (
                    <motion.div 
                      initial={{ y: 2, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="flex flex-col items-center w-full"
                    >
                      {/* Arrowhead pointing up to bar */}
                      <div 
                        className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] mb-1 transition-all"
                        style={{ borderBottomColor: pointersAtIdx[0].arrowBorderColor || '#fbbf24' }}
                      />
                      
                      {/* Pointer Name Badges (i, j, min, pivot, etc.) */}
                      <div className="flex flex-wrap items-center justify-center gap-1 max-w-full">
                        {pointersAtIdx.map(p => (
                          <span
                            key={p.name}
                            className={`px-1.5 py-0.5 text-[10px] font-mono font-black rounded border shadow-sm uppercase tracking-wider transition-all scale-105 ${p.bgColor} ${p.borderColor} ${p.textColor}`}
                            title={`${p.name} → arr[${idx}] = ${val} (${p.role})`}
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-6" />
                  )}

                  {/* Array Index Subscript */}
                  <span className={`text-[10px] font-mono mt-1 transition-colors ${
                    hasPointers ? 'text-amber-400 font-extrabold' : 'text-slate-600 group-hover:text-slate-300'
                  }`}>
                    {idx}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-700 border border-slate-600"></span>
            <span>Default</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 border border-amber-400"></span>
            <span>Comparing (j, j+1)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 border border-rose-400"></span>
            <span>Swapping / Shift</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-500 border border-purple-400"></span>
            <span>Pivot</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-400"></span>
            <span>Sorted</span>
          </div>
        </div>

        {/* Algorithm Pointer Variables Reference Guide */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs font-mono">
          <div className="text-slate-300 font-bold mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <span className="uppercase tracking-wider text-[11px]">Active Pointer Roles in {SORTING_ALGORITHMS.find(a => a.id === selectedAlgo)?.name}:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-slate-400">
            {getAlgorithmPointerDescriptions(selectedAlgo).map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${item.badgeClass}`}>
                  {item.pointer}
                </span>
                <div className="flex flex-col">
                  <span className="text-slate-200 font-semibold text-[11px]">{item.name}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Control Panel */}
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

      {/* Synchronized C Source Code Viewer */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
            Synchronized C11 Source Implementation
          </h3>
          <span className="text-xs text-slate-400">
            Monaco editor line automatically highlights active executing C instruction
          </span>
        </div>
        <CodeViewer
          codeMetadata={codeMeta}
          activeLine={player.currentStep?.line}
          height="380px"
        />
      </div>
    </div>
  );
};
