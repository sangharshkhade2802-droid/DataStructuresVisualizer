import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  RotateCw,
  Plus,
  Trash2,
  Search,
  GitBranch,
  Info,
} from 'lucide-react';
import { executeAlgorithmApi } from '../../engine/api';
import { ExecutionTrace } from '../../engine/types';
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer';
import { ControlPanel } from '../common/ControlPanel';
import { CodeViewer } from '../code/CodeViewer';
import { C_SOURCE_REGISTRY } from '../../engine/cSourceRegistry';

/**
 * FIX SUMMARY (previously broken):
 * 1. Switching tree type did not rebuild the tree — `keys` state was shared
 *    across all tree types and never reset, so e.g. switching from BST to
 *    AVL just kept rendering the old BST-shaped layout data.
 * 2. `layoutTree()` used a fake "perfectly balanced binary heap" index
 *    formula (based on array position) that has NOTHING to do with actual
 *    BST/AVL structure — a tree built by inserting 50,30,70,20,40,60,80
 *    does NOT have node at array-index 3 as a child of array-index 1
 *    unless that happens to match the real insertion shape. This produced
 *    visually wrong trees for every non-coincidental key set.
 * 3. The component ignored `aux.nodes` entirely, even though the backend
 *    (and our corrected api.ts mirror) sends the REAL flattened tree shape
 *    with explicit parent/edge/height/bf per node — exactly what's needed
 *    to draw the tree correctly.
 * 4. Traversal modes sent the wrong payload (`op`+`value` instead of
 *    `type`) and never actually requested a traversal from the backend.
 * 5. Heap, Trie, LCA, B-Tree were listed in the tab bar but silently
 *    fell through to the BST/AVL endpoint shape — none of them worked.
 * 6. Delete was never disabled for AVL/Red-Black even though the backend
 *    silently no-ops delete for those two tree types.
 *
 * This rewrite:
 * - Keeps SEPARATE key/word state per structural family so switching tabs
 *   truly rebuilds from that family's own data.
 * - Renders directly from `aux.nodes` (parent/edge based) using a proper
 *   recursive layout (Reingold–Tilford-style simple variant) instead of
 *   array-index guessing.
 * - Wires Traversal/LCA/Heap/Trie/B-Tree to their real backend payload
 *   shapes per README §2.8.
 * - Disables Delete for AVL / Red-Black with an explanatory tooltip.
 */

const TREE_SUITE = [
  { id: 'bst', name: 'Binary Search Tree (BST)', family: 'bst' },
  { id: 'avl', name: 'AVL Tree (Self-Balancing)', family: 'bst' },
  { id: 'red-black', name: 'Red-Black Tree', family: 'bst' },
  { id: 'heap', name: 'Binary Max/Min Heap', family: 'heap' },
  { id: 'traversal-inorder', name: 'Inorder Traversal', family: 'traversal' },
  { id: 'traversal-preorder', name: 'Preorder Traversal', family: 'traversal' },
  { id: 'traversal-postorder', name: 'Postorder Traversal', family: 'traversal' },
  { id: 'traversal-levelorder', name: 'Level Order (BFS)', family: 'traversal' },
  { id: 'lca', name: 'Lowest Common Ancestor', family: 'bst' },
  { id: 'trie', name: 'Trie (Prefix Tree)', family: 'trie' },
  { id: 'btree', name: 'B-Tree (Simplified Demo)', family: 'btree' },
] as const;

interface FlatNode {
  id: number;
  key: number;
  parent: number;
  edge: 'left' | 'right' | 'root';
  height?: number;
  bf?: number;
  color?: 'red' | 'black';
}

interface LayoutNode extends FlatNode {
  x: number;
  y: number;
  childrenIds: number[];
  __canvasWidth?: number;
  __canvasHeight?: number;
}

/** Lays out a parent/edge-based node list into x/y coordinates by actually
 *  walking the tree structure (not by array index), so the picture always
 *  matches the real tree shape the backend describes. */
function layoutFromNodes(nodes: FlatNode[], viewWidth?: number): LayoutNode[] {
  if (!nodes.length) return [];

  const byKey = new Map<number, FlatNode>();
  nodes.forEach((n) => byKey.set(n.key, n));

  const childrenOf = new Map<number, { left?: number; right?: number }>();
  let rootKey: number | null = null;

  nodes.forEach((n) => {
    if (n.edge === 'root' || n.parent === -1) {
      rootKey = n.key;
    } else {
      const entry = childrenOf.get(n.parent) || {};
      if (n.edge === 'left') entry.left = n.key;
      else entry.right = n.key;
      childrenOf.set(n.parent, entry);
    }
  });

  if (rootKey === null) return [];

  // First pass: compute depth and in-order x-slot via simple in-order counter.
  const depth = new Map<number, number>();
  const xSlot = new Map<number, number>();
  let counter = 0;

  function assign(key: number | undefined, d: number) {
    if (key === undefined) return;
    const kids = childrenOf.get(key) || {};
    assign(kids.left, d + 1);
    depth.set(key, d);
    xSlot.set(key, counter++);
    assign(kids.right, d + 1);
  }
  assign(rootKey, 0);

  const totalSlots = Math.max(1, counter);
  const horizontalPad = 50;
  // Instead of cramming every tree into a fixed 760px canvas (causing
  // overlapping nodes past ~10 keys), size the canvas to the tree: at
  // least 90px per leaf-level slot, growing as the tree grows wider.
  const minWidth = viewWidth ?? 760;
  const neededWidth = Math.max(minWidth, totalSlots * 90 + horizontalPad * 2);
  const usableWidth = neededWidth - horizontalPad * 2;

  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  // Vertical size now also comes from the tree's actual depth instead of
  // a fixed 320px-tall viewBox that clipped anything past depth ~4.
  const neededHeight = 45 + (maxDepth + 1) * 62 + 40;

  const result: LayoutNode[] = nodes.map((n) => {
    const kids = childrenOf.get(n.key) || {};
    const childrenIds: number[] = [];
    if (kids.left !== undefined) childrenIds.push(kids.left);
    if (kids.right !== undefined) childrenIds.push(kids.right);
    const slot = xSlot.get(n.key) ?? 0;
    const d = depth.get(n.key) ?? 0;
    return {
      ...n,
      x: horizontalPad + (totalSlots <= 1 ? usableWidth / 2 : (slot / (totalSlots - 1)) * usableWidth),
      y: 45 + d * 62,
      childrenIds,
      __canvasWidth: neededWidth,
      __canvasHeight: neededHeight,
    };
  });

  return result;
}

export const TreeVisualizer: React.FC = () => {
  const [selectedTree, setSelectedTree] = useState<typeof TREE_SUITE[number]['id']>('avl');

  // Separate state per family so switching families truly rebuilds from scratch.
  const [bstKeys, setBstKeys] = useState<number[]>([50, 30, 70, 20, 40, 60, 80]);
  const [heapKeys, setHeapKeys] = useState<number[]>([50, 30, 70, 20, 40, 60, 80]);
  const [heapType, setHeapType] = useState<'max' | 'min'>('max');
  const [trieWords, setTrieWords] = useState<string>('cat,car,card,dog');
  const [trieWord, setTrieWord] = useState<string>('cart');
  const [btreeKeys, setBtreeKeys] = useState<number[]>([10, 20, 30, 40]);
  const [btreeOrder, setBtreeOrder] = useState<number>(4);

  const [inputValue, setInputValue] = useState('25');
  const [lcaN1, setLcaN1] = useState('20');
  const [lcaN2, setLcaN2] = useState('40');

  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const player = useAnimationPlayer(trace, { initialSpeed: 1 });

  const activeMeta = TREE_SUITE.find((t) => t.id === selectedTree)!;
  const isAVLorRB = selectedTree === 'avl' || selectedTree === 'red-black';

  const runTreeOp = async (
    treeId: typeof selectedTree = selectedTree,
    op: string = 'insert',
    val = parseInt(inputValue, 10)
  ) => {
    player.reset();
    try {
      let endpoint = '';
      let payload: any = {};

      if (treeId === 'bst') {
        endpoint = '/tree/bst';
        payload = { keys: bstKeys, op, value: isNaN(val) ? 25 : val };
      } else if (treeId === 'avl') {
        endpoint = '/tree/avl';
        payload = { keys: bstKeys, op, value: isNaN(val) ? 25 : val };
      } else if (treeId === 'red-black') {
        endpoint = '/tree/red-black';
        payload = { keys: bstKeys, op, value: isNaN(val) ? 25 : val };
      } else if (treeId === 'heap') {
        endpoint = '/tree/heap';
        payload = { keys: heapKeys, op, value: isNaN(val) ? 25 : val, heapType };
      } else if (treeId.startsWith('traversal-')) {
        endpoint = '/tree/traversal';
        const tname = treeId.replace('traversal-', '');
        payload = {
          keys: bstKeys,
          type:
            tname === 'inorder' ? 'Inorder Traversal' :
            tname === 'preorder' ? 'Preorder Traversal' :
            tname === 'postorder' ? 'Postorder Traversal' : 'Level Order Traversal',
        };
      } else if (treeId === 'lca') {
        endpoint = '/tree/lca';
        payload = { keys: bstKeys, n1: parseInt(lcaN1, 10) || 20, n2: parseInt(lcaN2, 10) || 40 };
      } else if (treeId === 'trie') {
        endpoint = '/tree/trie';
        payload = { wordsCsv: trieWords, op: op === 'delete' ? 'insert' : op, word: trieWord };
      } else if (treeId === 'btree') {
        endpoint = '/tree/btree';
        payload = { keys: btreeKeys, order: btreeOrder, op, value: isNaN(val) ? 25 : val };
      }

      const data = await executeAlgorithmApi(endpoint, payload);
      setTrace(data);

      // Keep local mirror of keys in sync so the NEXT call starts from the
      // backend's latest state (backend is stateless — see README §1).
      if (op === 'insert') {
        if (treeId === 'bst' || treeId === 'avl' || treeId === 'red-black') {
          if (!isNaN(val) && !bstKeys.includes(val)) setBstKeys([...bstKeys, val]);
        } else if (treeId === 'heap') {
          if (!isNaN(val)) setHeapKeys([...heapKeys, val]);
        } else if (treeId === 'btree') {
          if (!isNaN(val)) setBtreeKeys([...btreeKeys, val]);
        }
      } else if (op === 'delete' && !isAVLorRB && (treeId === 'bst')) {
        setBstKeys(bstKeys.filter((k) => k !== val));
      } else if (op === 'extract' && treeId === 'heap') {
        // Root was removed server-side; trust the trace's final array for new heap contents.
        const lastStep = data.steps[data.steps.length - 1];
        if (lastStep?.array) setHeapKeys(lastStep.array);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX: tree now genuinely rebuilds whenever the tab changes, using that
  // family's own key state, instead of reusing stale layout data.
  useEffect(() => {
    runTreeOp(selectedTree, 'insert', parseInt(inputValue, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTree]);

  const aux = player.currentStep?.aux || {};
  const currentFocus = aux.focus;
  const flatNodes: FlatNode[] = aux.nodes || [];
  const layout = useMemo(() => layoutFromNodes(flatNodes), [flatNodes]);

  const codeLookupId = selectedTree.startsWith('traversal-') ? 'traversal' : selectedTree;
  const codeMeta = C_SOURCE_REGISTRY[codeLookupId] || C_SOURCE_REGISTRY['avl'];

  const resetCurrentFamily = () => {
    if (activeMeta.family === 'bst') {
      setBstKeys([50, 30, 70, 20, 40, 60, 80]);
      runTreeOp(selectedTree, 'insert', 25);
    } else if (activeMeta.family === 'heap') {
      setHeapKeys([50, 30, 70, 20, 40, 60, 80]);
      runTreeOp(selectedTree, 'insert', 25);
    } else if (activeMeta.family === 'trie') {
      setTrieWords('cat,car,card,dog');
      setTrieWord('cart');
      runTreeOp(selectedTree, 'insert', 25);
    } else if (activeMeta.family === 'btree') {
      setBtreeKeys([10, 20, 30, 40]);
      runTreeOp(selectedTree, 'insert', 25);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Tree Data Structures
            </span>
            <span className="text-xs text-slate-400 font-mono">Rebuilds fresh per structure type</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Tree Visualizer & Rotations Engine
          </h1>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl glass-panel">
          {TREE_SUITE.map((tree) => (
            <button
              key={tree.id}
              onClick={() => setSelectedTree(tree.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTree === tree.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tree.name}
            </button>
          ))}
        </div>
      </div>

      {/* Operation Bar — differs per family, matching backend fields exactly */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl glass-panel text-xs">
        {activeMeta.family === 'bst' && selectedTree !== 'lca' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Key Value:</span>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center"
              />
            </div>

            <button
              onClick={() => runTreeOp(selectedTree, 'insert', parseInt(inputValue, 10))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Insert Key
            </button>

            <button
              onClick={() => runTreeOp(selectedTree, 'search', parseInt(inputValue, 10))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>

            {/* FIX: Delete disabled for AVL / Red-Black — backend silently no-ops it */}
            <button
              onClick={() => runTreeOp(selectedTree, 'delete', parseInt(inputValue, 10))}
              disabled={isAVLorRB}
              title={isAVLorRB ? 'Delete is not implemented server-side for AVL / Red-Black trees' : 'Delete key'}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-rose-500"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>

            {isAVLorRB && (
              <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono">
                <Info className="w-3.5 h-3.5" /> Delete unsupported for this tree type on the backend
              </span>
            )}
          </div>
        )}

        {selectedTree === 'lca' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Node 1:</span>
              <input value={lcaN1} onChange={(e) => setLcaN1(e.target.value)} className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Node 2:</span>
              <input value={lcaN2} onChange={(e) => setLcaN2(e.target.value)} className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-sky-400 text-center" />
            </div>
            <button
              onClick={() => runTreeOp('lca')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md"
            >
              <Search className="w-3.5 h-3.5" /> Find LCA
            </button>
          </div>
        )}

        {activeMeta.family === 'heap' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              {(['max', 'min'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setHeapType(t); setTimeout(() => runTreeOp('heap', 'insert', parseInt(inputValue, 10)), 0); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heapType === t ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                >
                  {t === 'max' ? 'Max Heap' : 'Min Heap'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Value:</span>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center"
              />
            </div>
            <button
              onClick={() => runTreeOp('heap', 'insert', parseInt(inputValue, 10))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Insert
            </button>
            <button
              onClick={() => runTreeOp('heap', 'extract')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Extract Root
            </button>
          </div>
        )}

        {activeMeta.family === 'trie' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Dictionary (CSV):</span>
              <input
                value={trieWords}
                onChange={(e) => setTrieWords(e.target.value)}
                className="w-56 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Word:</span>
              <input
                value={trieWord}
                onChange={(e) => setTrieWord(e.target.value)}
                className="w-28 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center"
              />
            </div>
            <button
              onClick={() => runTreeOp('trie', 'insert')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Insert Word
            </button>
            <button
              onClick={() => runTreeOp('trie', 'search')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
            >
              <Search className="w-3.5 h-3.5" /> Search Word
            </button>
          </div>
        )}

        {activeMeta.family === 'btree' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Order (3-8):</span>
              <input
                type="number"
                min={3}
                max={8}
                value={btreeOrder}
                onChange={(e) => setBtreeOrder(Math.min(8, Math.max(3, parseInt(e.target.value, 10) || 4)))}
                className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 text-center"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono">Value:</span>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center"
              />
            </div>
            <button
              onClick={() => runTreeOp('btree', 'insert', parseInt(inputValue, 10))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Insert
            </button>
            <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Simplified single-node split demo, not a full B-Tree
            </span>
          </div>
        )}

        {activeMeta.family === 'traversal' && (
          <span className="text-xs text-slate-400 font-mono">
            Traverses the current BST-shaped key set: [{bstKeys.join(', ')}]
          </span>
        )}

        <button
          onClick={resetCurrentFamily}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          <RotateCw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Tree SVG Stage — driven by real aux.nodes layout */}
      <div className="flex flex-col gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-2xl relative min-h-[400px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/70 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span>Active Structure: <span className="text-emerald-400 font-bold">{activeMeta.name}</span></span>
          </div>
          <div>Nodes Drawn: <span className="text-white font-bold">{layout.length}</span></div>
        </div>

        {activeMeta.family === 'trie' || activeMeta.family === 'heap' || activeMeta.family === 'btree' ? (
          /* These families don't have the same parent/edge tree shape — show their own simple view */
          <div className="w-full min-h-[280px] flex items-center justify-center">
            {activeMeta.family === 'heap' && (
              <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
                {(player.currentStep?.array || heapKeys).map((v: number, i: number) => (
                  <div key={i} className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center font-mono text-sm ${
                    player.currentStep?.indices?.includes(i) ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}>
                    <span className="text-[9px] text-slate-500">[{i}]</span>
                    <span className="font-bold">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {activeMeta.family === 'trie' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  {(aux.words || trieWords.split(',')).map((w: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-slate-200">
                      {w.trim()}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Target word: <span className="text-emerald-400 font-bold">{aux.word || trieWord}</span>
                </span>
              </div>
            )}
            {activeMeta.family === 'btree' && (
              <div className="flex items-center gap-2">
                {(player.currentStep?.array || btreeKeys).map((v: number, i: number) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 font-mono text-sm text-slate-200">
                    {v}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full relative overflow-auto flex items-start justify-center" style={{ maxHeight: '560px', minHeight: '320px' }}>
            <svg
              className="shrink-0"
              style={{
                width: `${layout[0]?.__canvasWidth ?? 760}px`,
                height: `${layout[0]?.__canvasHeight ?? 320}px`,
                minWidth: '100%',
              }}
              viewBox={`0 0 ${layout[0]?.__canvasWidth ?? 760} ${layout[0]?.__canvasHeight ?? 320}`}
            >
              {layout.map((node) =>
                node.childrenIds.map((childKey) => {
                  const child = layout.find((n) => n.key === childKey);
                  if (!child) return null;
                  return (
                    <line
                      key={`line-${node.key}-${childKey}`}
                      x1={node.x} y1={node.y} x2={child.x} y2={child.y}
                      stroke="#334155" strokeWidth="2.5"
                    />
                  );
                })
              )}

              {layout.map((node) => {
                const isFocused = currentFocus === node.key;
                let fillColor = '#1e293b';
                let strokeColor = '#475569';
                let textColor = '#e2e8f0';

                if (isFocused) {
                  fillColor = '#10b981'; strokeColor = '#34d399'; textColor = '#0f172a';
                } else if (selectedTree === 'red-black' && node.color) {
                  fillColor = node.color === 'red' ? '#e11d48' : '#0f172a';
                  strokeColor = node.color === 'red' ? '#f43f5e' : '#475569';
                }

                return (
                  <g key={`node-${node.key}`} className="cursor-pointer transition-all">
                    {isFocused && (
                      <circle cx={node.x} cy={node.y} r="26" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" className="animate-ping" />
                    )}
                    <circle cx={node.x} cy={node.y} r="20" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fill={textColor} fontSize="12" fontWeight="bold" fontFamily="monospace">
                      {node.key}
                    </text>
                    {selectedTree === 'avl' && typeof node.bf === 'number' && (
                      <text x={node.x + 22} y={node.y - 8} fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        BF:{node.bf}
                      </text>
                    )}
                  </g>
                );
              })}

              {layout.length === 0 && (
                <text x="380" y="160" textAnchor="middle" fill="#475569" fontSize="13" fontFamily="monospace">
                  Tree is empty
                </text>
              )}
            </svg>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-800 border border-slate-600"></span>
            <span>Standard Node</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-400"></span>
            <span>Active / Target Node</span>
          </div>
          {selectedTree === 'red-black' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-600 border border-rose-500"></span>
              <span>Red Node</span>
            </div>
          )}
          {selectedTree === 'avl' && (
            <div className="flex items-center gap-1.5">
              <span className="text-sky-400 font-bold">BF</span>
              <span>Balance Factor (left height − right height)</span>
            </div>
          )}
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
          C11 Tree Implementation
        </h3>
        <CodeViewer
          codeMetadata={codeMeta}
          activeLine={player.currentStep?.line}
          height="350px"
        />
      </div>
    </div>
  );
};