import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  RotateCcw,
  Info,
} from 'lucide-react';
import { executeAlgorithmApi } from '../../engine/api';
import { ExecutionTrace } from '../../engine/types';
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer';
import { ControlPanel } from '../common/ControlPanel';

/**
 * FIX SUMMARY (previously broken):
 * 1. The component ALWAYS rendered `player.currentStep.array` as the bucket
 *    contents, for every mode. The backend README §2.6 explicitly states
 *    that in chaining mode, `array` only shows the HEAD key of each
 *    bucket's chain (or -1) — the real multi-key chain contents are in
 *    `aux.chain`. This made multi-key buckets look like they only ever
 *    held one element, silently hiding every collision in chaining mode.
 * 2. There was no visual difference between "empty slot" and "chain head
 *    only" in chaining mode, and no indication that a bucket held more
 *    than one key.
 * 3. Quadratic probing's expected "overflow before full" behavior
 *    (a documented non-bug of quadratic probing on non-prime table sizes)
 *    was not explained anywhere in the UI.
 *
 * This rewrite renders each bucket differently depending on `aux.mode`:
 * - linear / quadratic: flat slot = exactly one key, from `array`.
 * - chaining: slot shows ALL keys in `aux.chain` for the bucket that was
 *   just touched; for buckets not touched this step we fall back to
 *   showing just the head (consistent with what the backend provides
 *   per-step) but label it clearly as "chain head only" so it's not
 *   mistaken for an empty bucket when it might hold more.
 */

export const HashVisualizer: React.FC = () => {
  const [collisionMode, setCollisionMode] = useState<'linear' | 'quadratic' | 'chaining'>('linear');
  const [tableSize, setTableSize] = useState<number>(10);
  const [initialKeys, setInitialKeys] = useState<number[]>([15, 25, 35, 42]);
  const [inputKey, setInputKey] = useState('55');
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);

  const player = useAnimationPlayer(trace, { initialSpeed: 1 });

  const runHashOp = async (op = 'insert', key = parseInt(inputKey, 10)) => {
    player.reset();
    try {
      const data = await executeAlgorithmApi('/data-structures/hash', {
        initial: initialKeys,
        capacity: tableSize,
        mode: collisionMode,
        op,
        value: isNaN(key) ? 55 : key,
      });
      setTrace(data);

      if (op === 'insert' && !isNaN(key) && !initialKeys.includes(key)) {
        setInitialKeys([...initialKeys, key]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX: rebuild whenever EITHER collision mode OR table size changes —
  // previously table size changes were silently ignored after first load.
  useEffect(() => {
    runHashOp('insert', parseInt(inputKey, 10) || 55);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collisionMode, tableSize]);

  const currentArray: number[] = player.currentStep?.array?.length ? player.currentStep.array : new Array(tableSize).fill(-1);
  const activeIndices: number[] = player.currentStep?.indices || [];
  const currentAction = player.currentStep?.action || '';
  const currentAux = player.currentStep?.aux || {};
  const activeBucketChain: number[] | undefined = currentAux.chain;
  const activeBucketIdx: number | undefined = currentAux.bucket;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Hash-Based Structures
            </span>
            <span className="text-xs text-slate-400 font-mono">Collision Resolution Strategies</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Hash Table & Collision Resolution Engine
          </h1>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl glass-panel text-xs">
          {[
            { id: 'linear', label: 'Linear Probing' },
            { id: 'quadratic', label: 'Quadratic Probing' },
            { id: 'chaining', label: 'Separate Chaining' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setCollisionMode(mode.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                collisionMode === mode.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl glass-panel text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono">Table Size:</span>
            <input
              type="number"
              min={4}
              max={20}
              value={tableSize}
              onChange={(e) => setTableSize(Math.max(4, Math.min(20, parseInt(e.target.value, 10) || 10)))}
              className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 text-center"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono">Insert Key:</span>
            <input
              type="number"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center"
            />
          </div>

          <button
            onClick={() => runHashOp('insert')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md"
          >
            <Plus className="w-3.5 h-3.5" /> Insert & Resolve Collisions
          </button>

          <button
            onClick={() => runHashOp('search')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
          >
            <Search className="w-3.5 h-3.5" /> Search Key
          </button>
        </div>

        <button
          onClick={() => {
            setInitialKeys([15, 25, 35, 42]);
            runHashOp('insert', 55);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Table
        </button>
      </div>

      <div className="flex flex-col gap-6 p-6 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-2xl min-h-[350px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/70 text-xs font-mono text-slate-400">
          <div>
            Primary Hash Function: <span className="text-emerald-400 font-bold">h(k) = k % {tableSize}</span>
          </div>
          <div>
            Active Strategy:{' '}
            <span className="text-sky-400 font-bold uppercase">{collisionMode}</span>
          </div>
        </div>

        {collisionMode === 'quadratic' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              Quadratic probing can report "overflow" even when the table isn't completely full —
              this is a known mathematical limitation with non-prime table sizes, not a bug.
            </span>
          </div>
        )}

        {collisionMode === 'chaining' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-mono">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              In chaining mode, each slot can hold multiple keys. The bucket most recently touched
              shows its full chain below; other slots show only their chain's head key.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2.5 py-4">
          {currentArray.map((slotVal, slotIdx) => {
            const isTarget = activeIndices.includes(slotIdx);
            const isCollision = currentAction === 'collision' && isTarget;
            const isInserted = (currentAction === 'insert' || currentAction === 'chain_link') && isTarget;
            const isEmpty = slotVal === -1;

            // FIX: in chaining mode, show the FULL chain for the bucket this
            // step actually touched (aux.chain), not just the flat head value.
            const showFullChain =
              collisionMode === 'chaining' && activeBucketIdx === slotIdx && Array.isArray(activeBucketChain);
            const chainContents: number[] = showFullChain
              ? (activeBucketChain as number[])
              : (isEmpty ? [] : [slotVal]);
            const hasMultiple = chainContents.length > 1;

            let borderStyle = 'border-slate-800 bg-slate-950/60';
            let textColor = 'text-slate-400';

            if (isCollision) {
              borderStyle = 'border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse';
              textColor = 'text-rose-300 font-bold';
            } else if (isInserted) {
              borderStyle = 'border-emerald-400 bg-emerald-500/20 text-emerald-300';
              textColor = 'text-emerald-300 font-bold';
            } else if (!isEmpty) {
              borderStyle = 'border-slate-700 bg-slate-800/80 text-white font-bold';
            }

            return (
              <motion.div
                key={slotIdx}
                layout
                className={`flex flex-col rounded-2xl border p-3 items-center justify-between min-h-[100px] shadow-lg transition-all ${borderStyle}`}
              >
                <span className="text-[10px] font-mono text-slate-500">Slot #{slotIdx}</span>

                {collisionMode === 'chaining' ? (
                  <div className="flex flex-col items-center gap-1">
                    {chainContents.length === 0 ? (
                      <span className="text-slate-700 text-xs">EMPTY</span>
                    ) : (
                      <div className="flex flex-col items-center">
                        {chainContents.map((v, i) => (
                          <React.Fragment key={i}>
                            <span className={`text-base font-mono ${textColor}`}>{v}</span>
                            {i < chainContents.length - 1 && (
                              <span className="text-[10px] text-slate-500">↓</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`text-base font-mono ${textColor}`}>
                    {isEmpty ? <span className="text-slate-700 text-xs">EMPTY</span> : slotVal}
                  </div>
                )}

                {collisionMode === 'chaining' && !isEmpty && (
                  <span className={`text-[9px] font-mono px-1 rounded ${
                    hasMultiple ? 'text-amber-300 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
                  }`}>
                    {showFullChain
                      ? `Chain: ${chainContents.length} node${chainContents.length !== 1 ? 's' : ''}`
                      : 'Chain head (may hold more)'}
                  </span>
                )}
                {(collisionMode !== 'chaining' || isEmpty) && <span className="h-4"></span>}
              </motion.div>
            );
          })}
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
    </div>
  );
};
