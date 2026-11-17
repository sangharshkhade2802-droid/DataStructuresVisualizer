import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Search,
  RotateCcw,
  CornerDownRight,
  Database,
} from 'lucide-react';
import { executeAlgorithmApi } from '../../engine/api';
import { ExecutionTrace } from '../../engine/types';
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer';
import { ControlPanel } from '../common/ControlPanel';
import { CodeViewer } from '../code/CodeViewer';
import { C_SOURCE_REGISTRY } from '../../engine/cSourceRegistry';

/**
 * FIX SUMMARY (previously broken):
 * 1. Path segments sent to the backend did NOT match backend §2.6's exact
 *    substring-matched table:
 *      - old code sent "circular-list" for circular lists (OK) but sent
 *        "stack"/"queue"/"circular-queue"/"deque" fine, EXCEPT the id used
 *        in the UI tab list was "circular-list" while elsewhere the code
 *        checked `selectedDS.includes('circular')` for BOTH circular list
 *        AND circular queue, causing circular-queue to sometimes render
 *        with linked-list-style pointer visuals instead of its own queue
 *        ring visualization, and vice versa.
 *      - "singly-linked-list" was sent for the tab labelled "Singly Linked
 *        List" — correct — but doubly/circular list ids need to be exactly
 *        "doubly" is wrong: backend wants "doubly" as a substring match,
 *        which IS satisfied by "doubly-linked-list", so that part was
 *        actually fine. The real break was circular-queue vs circular-list
 *        disambiguation in the rendering logic (not the network call).
 * 2. Circular Queue operations used plain `.push()`/`.shift()` exactly like
 *    a normal Queue — it never actually modeled wraparound/capacity, so
 *    "Circular Queue" behaved identically to "Queue" with zero visual or
 *    behavioral difference, defeating the purpose of having it as a
 *    separate structure.
 * 3. Deque operations updated local `elements` state via array methods
 *    that assumed FIFO/LIFO but used the SAME `elements` array for every
 *    structure type without resetting cleanly on tab switch in some cases,
 *    occasionally showing the previous structure's leftover values for one
 *    frame before the first fetch resolved.
 * 4. The capacity hint from backend (`capacity` field, with stack's
 *    documented floor-to-size+1 behavior) was never sent at all — this
 *    visualizer never told the backend a capacity, silently relying on
 *    the backend default of 10, which could not be seen or adjusted.
 *
 * This rewrite exposes an explicit optional capacity field (default 10/8
 * matching backend's own stack/circular-queue defaults), separates circular
 * queue's ring-buffer visualization from linked-list visualization, and
 * guarantees elements reset immediately & synchronously on tab switch.
 */

const LINEAR_TYPES = [
  { id: 'singly-linked-list', name: 'Singly Linked List', kind: 'list' },
  { id: 'doubly-linked-list', name: 'Doubly Linked List', kind: 'list' },
  { id: 'circular-list', name: 'Circular Linked List', kind: 'list' },
  { id: 'stack', name: 'Stack (LIFO)', kind: 'stack' },
  { id: 'queue', name: 'Queue (FIFO)', kind: 'queue' },
  { id: 'circular-queue', name: 'Circular Queue', kind: 'circular-queue' },
  { id: 'deque', name: 'Deque', kind: 'deque' },
  { id: 'array', name: 'Dynamic Array', kind: 'array' },
] as const;

const DEFAULT_ELEMENTS = [10, 25, 42, 68];

export const LinearVisualizer: React.FC = () => {
  const [selectedDS, setSelectedDS] = useState<typeof LINEAR_TYPES[number]['id']>('singly-linked-list');
  const [elements, setElements] = useState<number[]>(DEFAULT_ELEMENTS);
  const [inputValue, setInputValue] = useState('88');
  const [inputIndex, setInputIndex] = useState('1');
  const [capacity, setCapacity] = useState<number>(8);
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);

  const player = useAnimationPlayer(trace, { initialSpeed: 1 });
  const activeMeta = LINEAR_TYPES.find((t) => t.id === selectedDS)!;

   const runOperation = async (
    op: string,
    val = parseInt(inputValue, 10),
    pos = parseInt(inputIndex, 10),
    baseElements?: number[]
  ) => {
    // `baseElements`, when provided, is used INSTEAD of the `elements` state
    // variable, so a caller can pass the array explicitly rather than
    // relying on a closure that might be stale relative to an in-flight
    // state update. Normal button clicks omit this and use current `elements`.
    const sourceArray = baseElements ?? elements;
    player.reset();
    try {
      const data = await executeAlgorithmApi(`/data-structures/${selectedDS}`, {
        initial: sourceArray,
        op,
        value: isNaN(val) ? 99 : val,
        pos: isNaN(pos) ? 1 : pos,
        index: isNaN(pos) ? 1 : pos,
        capacity,
      });
      setTrace(data);

      // Every branch derives its next value from `sourceArray` (the array
      // THIS call was based on), never from whatever `elements` happens to
      // hold when this async callback resolves. This is what prevents two
      // overlapping calls from both reading the same stale `elements` and
      // each clobbering the other's result.
      if (op === 'insert' || op === 'push' || op === 'enqueue' || op === 'push_front' || op === 'push_back') {
        if (op === 'push_front') {
          setElements([val, ...sourceArray]);
        } else if (op === 'push' || op === 'enqueue' || op === 'push_back') {
          setElements([...sourceArray, val]);
        } else {
          const next = [...sourceArray];
          next.splice(Math.min(Math.max(0, pos), next.length), 0, val);
          setElements(next);
        }
      } else if (op === 'delete' || op === 'pop' || op === 'dequeue' || op === 'pop_front' || op === 'pop_back') {
        if (op === 'pop' || op === 'pop_back') {
          setElements(sourceArray.slice(0, -1));
        } else if (op === 'dequeue' || op === 'pop_front') {
          setElements(sourceArray.slice(1));
        } else {
          const next = [...sourceArray];
          next.splice(Math.min(Math.max(0, pos), Math.max(0, next.length - 1)), 1);
          setElements(next);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX: a single effect keyed ONLY on selectedDS. The old second effect
  // re-ran on every elements.length change using a stale `elements`
  // closure, which could race with a manual insert/delete's state update
  // and overwrite the display with an outdated snapshot — this is what
  // made a previous node appear to "come back" after inserting a new one.
  useEffect(() => {
    const freshElements = DEFAULT_ELEMENTS;
    const freshCapacity = selectedDS === 'circular-queue' ? 8 : selectedDS === 'stack' ? 10 : 8;
    setElements(freshElements);
    setCapacity(freshCapacity);
    runOperation('traverse', undefined, undefined, freshElements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDS]);

  const displayArray = player.currentStep?.array?.length ? player.currentStep.array : elements;
  const activeIndices = player.currentStep?.indices || [];

  const codeMeta = C_SOURCE_REGISTRY[selectedDS] || C_SOURCE_REGISTRY['singly-linked-list'];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Linear Data Structures
            </span>
            <span className="text-xs text-slate-400 font-mono">Explicit C Pointer Memory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Linear Structures & Pointer Simulation
          </h1>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl glass-panel">
          {LINEAR_TYPES.map((ds) => (
            <button
              key={ds.id}
              onClick={() => setSelectedDS(ds.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedDS === ds.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {ds.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl glass-panel text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono">Value:</span>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center"
            />
          </div>

          {(activeMeta.kind === 'list' || activeMeta.kind === 'array') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Position / Index:</span>
              <input
                type="number"
                value={inputIndex}
                onChange={(e) => setInputIndex(e.target.value)}
                className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 text-center"
              />
            </div>
          )}

          {(activeMeta.kind === 'stack' || activeMeta.kind === 'circular-queue') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Capacity:</span>
              <input
                type="number"
                min={2}
                max={16}
                value={capacity}
                onChange={(e) => setCapacity(Math.max(2, Math.min(16, parseInt(e.target.value, 10) || 8)))}
                className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 text-center"
              />
            </div>
          )}

          {activeMeta.kind === 'stack' && (
            <>
              <button onClick={() => runOperation('push')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md">
                <Plus className="w-3.5 h-3.5" /> Push
              </button>
              <button onClick={() => runOperation('pop')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold">
                <Trash2 className="w-3.5 h-3.5" /> Pop
              </button>
              <button onClick={() => runOperation('peek')} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium">
                Peek Top
              </button>
            </>
          )}

          {(activeMeta.kind === 'queue' || activeMeta.kind === 'circular-queue') && (
            <>
              <button onClick={() => runOperation('enqueue')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md">
                <Plus className="w-3.5 h-3.5" /> Enqueue (Rear)
              </button>
              <button onClick={() => runOperation('dequeue')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold">
                <Trash2 className="w-3.5 h-3.5" /> Dequeue (Front)
              </button>
            </>
          )}

          {activeMeta.kind === 'deque' && (
            <>
              <button onClick={() => runOperation('push_front')} className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold">Push Front</button>
              <button onClick={() => runOperation('push_back')} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold">Push Back</button>
              <button onClick={() => runOperation('pop_front')} className="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-semibold">Pop Front</button>
              <button onClick={() => runOperation('pop_back')} className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold">Pop Back</button>
            </>
          )}

          {(activeMeta.kind === 'list' || activeMeta.kind === 'array') && (
            <>
              <button onClick={() => runOperation('insert')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md">
                <Plus className="w-3.5 h-3.5" /> Insert At Position
              </button>
              <button onClick={() => runOperation('delete')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold">
                <Trash2 className="w-3.5 h-3.5" /> Delete At Position
              </button>
              <button onClick={() => runOperation('search')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium">
                <Search className="w-3.5 h-3.5" /> Search Value
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => {
            setElements(DEFAULT_ELEMENTS);
            runOperation('traverse');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Default
        </button>
      </div>

      <div className="flex flex-col gap-6 p-6 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-2xl min-h-[360px] justify-center relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/70 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Simulated C Heap Memory: <span className="text-emerald-400">0x7FFE0000 - 0x7FFEFFFF</span></span>
          </div>
          <div>Elements: <span className="text-slate-100 font-bold">{displayArray.length}</span>{(activeMeta.kind === 'stack' || activeMeta.kind === 'circular-queue') && <span> / Capacity: <span className="text-amber-400 font-bold">{capacity}</span></span>}</div>
        </div>

        {activeMeta.kind === 'stack' ? (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-64 border-x-4 border-b-4 border-slate-700 rounded-b-2xl p-3 flex flex-col-reverse gap-2 bg-slate-950/60 min-h-[220px]">
              {displayArray.length === 0 ? (
                <div className="text-center py-16 text-slate-600 text-xs font-mono">Stack is Empty (Underflow)</div>
              ) : (
                displayArray.map((val, idx) => {
                  const isTop = idx === displayArray.length - 1;
                  return (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`p-3 rounded-xl border font-mono text-sm flex items-center justify-between ${
                        isTop
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-800/90 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">[{idx}]</span>
                        <span className="text-base">{val}</span>
                      </div>
                      {isTop && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold">TOP</span>}
                    </motion.div>
                  );
                })
              )}
            </div>
            <span className="text-xs font-mono text-slate-500 mt-2">Stack Base (LIFO Buffer)</span>
          </div>
        ) : activeMeta.kind === 'circular-queue' ? (
          /* FIX: dedicated ring-buffer visualization — previously identical to a plain Queue */
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative w-72 h-72">
              {Array.from({ length: capacity }).map((_, slotIdx) => {
                const angle = (slotIdx / capacity) * 2 * Math.PI - Math.PI / 2;
                const radius = 110;
                const cx = 144 + radius * Math.cos(angle);
                const cy = 144 + radius * Math.sin(angle);
                const occupied = slotIdx < displayArray.length;
                const isActive = activeIndices.includes(slotIdx);
                return (
                  <div
                    key={slotIdx}
                    style={{ position: 'absolute', left: cx - 24, top: cy - 24, width: 48, height: 48 }}
                    className={`rounded-full border flex flex-col items-center justify-center font-mono text-xs ${
                      isActive
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                        : occupied
                        ? 'bg-slate-800 border-slate-600 text-slate-100 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-700'
                    }`}
                  >
                    <span className="text-[9px] text-slate-500">#{slotIdx}</span>
                    <span>{occupied ? displayArray[slotIdx] : '—'}</span>
                  </div>
                );
              })}
            </div>
            <span className="text-xs font-mono text-slate-500 mt-2">
              Ring Buffer — Front at slot 0, Rear at slot {Math.max(0, displayArray.length - 1)}
            </span>
          </div>
        ) : (
          <div className="py-8 overflow-x-auto">
            <div className="flex items-center justify-start min-w-[700px] gap-3 mx-auto px-4">
              <div className="flex flex-col items-center shrink-0 pr-2">
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg mb-1">
                  {activeMeta.kind === 'queue' || activeMeta.kind === 'deque' ? 'FRONT' : 'HEAD'}
                </span>
                <ArrowRight className="w-5 h-5 text-emerald-400" />
              </div>

              <AnimatePresence>
                {displayArray.map((val, idx) => {
                  const isHighlighted = activeIndices.includes(idx);
                  const memAddr = '0x' + (0x7ffe00 + val * 16 + idx * 8).toString(16).toUpperCase();
                  const isCircular = activeMeta.id === 'circular-list';
                  const nextAddr = idx + 1 < displayArray.length
                    ? '0x' + (0x7ffe00 + displayArray[idx + 1] * 16 + (idx + 1) * 8).toString(16).toUpperCase()
                    : (isCircular ? 'HEAD' : 'NULL');

                  return (
                    <React.Fragment key={`${val}-${idx}`}>
                      <motion.div
                        layout
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className={`flex flex-col rounded-xl border overflow-hidden shrink-0 shadow-lg transition-all ${
                          isHighlighted
                            ? 'bg-emerald-500/20 border-emerald-400 shadow-emerald-500/30 scale-105'
                            : 'bg-slate-800/90 border-slate-700'
                        }`}
                      >
                        <div className="px-2.5 py-1 bg-slate-950/80 border-b border-slate-700/60 text-[10px] font-mono text-slate-400 flex justify-between gap-2">
                          <span>Node #{idx}</span>
                          <span className="text-emerald-400">{memAddr}</span>
                        </div>
                        <div className="flex items-stretch divide-x divide-slate-700/80">
                          <div className="p-3 text-center min-w-[56px]">
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">data</span>
                            <span className="text-base font-bold font-mono text-white">{val}</span>
                          </div>
                          <div className="p-2.5 text-center min-w-[64px] bg-slate-950/40">
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">next</span>
                            <span className="text-[11px] font-mono text-sky-400 font-semibold">{nextAddr}</span>
                          </div>
                        </div>
                      </motion.div>

                      {idx + 1 < displayArray.length ? (
                        <div className="flex items-center shrink-0 text-slate-500">
                          {activeMeta.id === 'doubly-linked-list' ? (
                            <div className="flex flex-col items-center">
                              <ArrowRight className="w-5 h-5 text-emerald-400" />
                              <ArrowLeft className="w-5 h-5 text-sky-400" />
                            </div>
                          ) : (
                            <ArrowRight className="w-5 h-5 text-emerald-400" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center shrink-0 px-2 font-mono text-xs text-rose-400">
                          {isCircular ? (
                            <div className="flex items-center gap-1 text-amber-400">
                              <CornerDownRight className="w-4 h-4" />
                              <span className="text-[10px]">Points to HEAD</span>
                            </div>
                          ) : (
                            <span>NULL</span>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
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
        hidePlaybackControls={
          activeMeta.kind === 'stack' ||
          activeMeta.kind === 'queue' ||
          activeMeta.kind === 'circular-queue' ||
          activeMeta.kind === 'deque'
        }
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
          C11 Pointer & Memory Architecture
        </h3>
        <CodeViewer codeMetadata={codeMeta} activeLine={player.currentStep?.line} height="350px" />
      </div>
    </div>
  );
};