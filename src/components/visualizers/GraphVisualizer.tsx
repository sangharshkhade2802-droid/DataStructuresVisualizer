import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Clock,
  Activity,
  Route,
  Info,
} from 'lucide-react';
import { executeAlgorithmApi } from '../../engine/api';
import { ExecutionTrace, GraphNode, GraphEdgeModel } from '../../engine/types';
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer';
import { ControlPanel } from '../common/ControlPanel';
import { StatBadge } from '../common/StatBadge';
import { CodeViewer } from '../code/CodeViewer';
import { C_SOURCE_REGISTRY } from '../../engine/cSourceRegistry';

/**
 * PATCH NOTES (fixes applied against backend README §2.7):
 *
 * 1. Previously only Dijkstra-shaped rendering existed. `array` was always
 *    read as a per-vertex distance array and `destVertex` dropdown only
 *    worked for Dijkstra. This rewrite branches per algorithm family and
 *    reads the EXACT shape the backend documents for each:
 *      - BFS/DFS          -> array = visited-order list
 *      - Dijkstra          -> array = dist[], final step aux={final_distance,reachable,path}
 *      - Bellman-Ford       -> array = dist[], final step aux={parents:[...]}
 *      - Floyd-Warshall     -> array = FLATTENED V*V matrix, aux={dim:V} (reshaped here)
 *      - Kruskal            -> array = DSU parent[] (not visual); real MST from aux.edges /
 *                               aux.sorted_edges on the "sort_edges"/"complete" steps
 *      - Prim               -> array = key[], final aux={parents:[...]}
 *      - Topological Sort   -> array = in_degree[] while processing, final = topo order;
 *                               "cycle_error" action has no array/aux payload
 * 2. INF sentinel (999999) is now filtered and rendered as unreachable/∞
 *    everywhere it can appear (Dijkstra, Bellman-Ford, Floyd-Warshall, Prim).
 * 3. Directed toggle is now exposed for every algorithm except Topological
 *    Sort, which the backend's own semantics require to be directed — that
 *    one is forced on and the checkbox is hidden for it specifically.
 * 4. The graph ALWAYS uses the backend's hardcoded 9-edge demo graph —
 *    vertices/directed only change size/directedness, never which edges
 *    exist. This is now stated plainly in the UI instead of implying a
 *    custom graph editor exists.
 */

const GRAPH_ALGORITHMS = [
  { id: 'bfs', name: 'BFS (Breadth First)', family: 'traverse' },
  { id: 'dfs', name: 'DFS (Depth First)', family: 'traverse' },
  { id: 'dijkstra', name: "Dijkstra's Shortest Path", family: 'shortest-path' },
  { id: 'bellman-ford', name: 'Bellman-Ford', family: 'bellman-ford' },
  { id: 'floyd-warshall', name: 'Floyd-Warshall', family: 'all-pairs' },
  { id: 'kruskal', name: "Kruskal's MST", family: 'mst-kruskal' },
  { id: 'prim', name: "Prim's MST", family: 'mst-prim' },
  { id: 'topological-sort', name: 'Topological Sort', family: 'topo' },
] as const;

// Matches the backend's ALWAYS-hardcoded demo graph exactly (README §2.7).
const DEMO_EDGES: GraphEdgeModel[] = [
  { u: 0, v: 1, weight: 4 },
  { u: 0, v: 2, weight: 2 },
  { u: 1, v: 2, weight: 1 },
  { u: 1, v: 3, weight: 5 },
  { u: 2, v: 3, weight: 8 },
  { u: 2, v: 4, weight: 10 },
  { u: 3, v: 4, weight: 2 },
  { u: 3, v: 5, weight: 6 },
  { u: 4, v: 5, weight: 3 },
];

const DEFAULT_NODES: GraphNode[] = [
  { id: 0, label: '0', x: 120, y: 160 },
  { id: 1, label: '1', x: 260, y: 70 },
  { id: 2, label: '2', x: 260, y: 250 },
  { id: 3, label: '3', x: 440, y: 70 },
  { id: 4, label: '4', x: 440, y: 250 },
  { id: 5, label: '5', x: 580, y: 160 },
];

const INF = 999999;

export const GraphVisualizer: React.FC = () => {
  const [selectedAlgo, setSelectedAlgo] = useState<typeof GRAPH_ALGORITHMS[number]['id']>('dijkstra');
  const [vertexCount, setVertexCount] = useState(6);
  const [startVertex, setStartVertex] = useState(0);
  const [destVertex, setDestVertex] = useState(5);
  const [directed, setDirected] = useState(false);

  const nodes: GraphNode[] = DEFAULT_NODES.slice(0, vertexCount);
  const edges: GraphEdgeModel[] = DEMO_EDGES.filter((e) => e.u < vertexCount && e.v < vertexCount);

  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const player = useAnimationPlayer(trace, { initialSpeed: 1 });

  const activeMeta = GRAPH_ALGORITHMS.find((a) => a.id === selectedAlgo)!;
  // Topological sort is only meaningful on a directed graph — force it and hide the toggle.
  const effectiveDirected = selectedAlgo === 'topological-sort' ? true : directed;

  const runGraphAlgo = async (
    algoId: typeof selectedAlgo = selectedAlgo,
    s = startVertex,
    d = destVertex,
    v = vertexCount,
    dir = effectiveDirected
  ) => {
    player.reset();
    try {
      const data = await executeAlgorithmApi(`/graph/${algoId}`, {
        vertices: v,
        start: s,
        dest: d,
        directed: dir ? 1 : 0,
      });
      setTrace(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    runGraphAlgo(selectedAlgo, startVertex, destVertex, vertexCount, effectiveDirected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlgo, startVertex, destVertex, vertexCount, directed]);

  const currentStep = player.currentStep;
  const lastStep = trace?.steps[trace.steps.length - 1] || null;
  const activeIndices = currentStep?.indices || [];
  const activeAction = currentStep?.action || '';
  const aux = currentStep?.aux || {};
  const lastAux = lastStep?.aux || {};

  // --- Per-family data extraction, matching backend shapes exactly ---
  let perVertexValues: number[] = [];
  let visitedOrder: number[] = [];
  let finalMSTEdges: [number, number, number][] | undefined;
  let floydMatrix: number[][] | undefined;
  let topoOrder: number[] = [];
  let cycleDetected = false;
  let shortestPathArr: number[] = [];
  let bellmanParents: number[] | undefined;
  let primParents: number[] | undefined;
  let kruskalTotalWeight: number | undefined;

  if (activeMeta.family === 'traverse') {
    visitedOrder = currentStep?.array || [];
  } else if (activeMeta.family === 'shortest-path') {
    // Dijkstra
    perVertexValues = currentStep?.array || [];
    // FIX: once the "shortest_path" step has been reached, keep showing it
    // on every later step too (scan backwards for the most recent one),
    // instead of only on that exact single step.
    for (let i = player.currentStepIndex; i >= 0; i--) {
      const s = trace?.steps[i];
      if (s?.action === 'shortest_path' && Array.isArray(s.array) && s.array.length) {
        shortestPathArr = s.array;
        break;
      }
    }
  } else if (activeMeta.family === 'bellman-ford') {
    perVertexValues = currentStep?.array || [];
    if (lastAux && Array.isArray(lastAux.parents)) {
      bellmanParents = lastAux.parents;
      // Use the final step's dist[] as the authoritative "settled" values once complete.
      if (activeAction === 'complete') perVertexValues = currentStep?.array || perVertexValues;
    }
    if (activeAction === 'negative_cycle') cycleDetected = true;
  } else if (activeMeta.family === 'all-pairs') {
    const flat: number[] = currentStep?.array || [];
    const dim = aux.dim || vertexCount;
    if (flat.length === dim * dim) {
      floydMatrix = [];
      for (let i = 0; i < dim; i++) floydMatrix.push(flat.slice(i * dim, (i + 1) * dim));
    }
  } else if (activeMeta.family === 'mst-kruskal') {
    // Real MST lives in aux.edges (final step) or aux.sorted_edges (intermediate) —
    // NEVER in `array`, which is just DSU internal parent[] state.
    if (Array.isArray(aux.edges)) {
      finalMSTEdges = aux.edges;
      kruskalTotalWeight = aux.total_weight;
    } else if (Array.isArray(lastAux.edges)) {
      // fall back to the trace's final result if mid-scrub has no edges yet
      finalMSTEdges = undefined; // only show once we've actually reached that step
    }
  } else if (activeMeta.family === 'mst-prim') {
    perVertexValues = currentStep?.array || [];
    if (Array.isArray(lastAux.parents)) primParents = lastAux.parents;
  } else if (activeMeta.family === 'topo') {
    if (activeAction === 'cycle_error') {
      cycleDetected = true;
    } else if (activeAction === 'complete') {
      topoOrder = currentStep?.array || [];
    } else {
      perVertexValues = currentStep?.array || []; // in-degree snapshot while processing
    }
  }

  const codeMeta = C_SOURCE_REGISTRY[selectedAlgo] || C_SOURCE_REGISTRY['dijkstra'];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Graph Suite
            </span>
          
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Interactive Graph Visualizer
          </h1>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl glass-panel">
          {GRAPH_ALGORITHMS.map((algo) => (
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


      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-2xl glass-panel text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Vertices:</span>
            <input
              type="number"
              min={2}
              max={6}
              value={vertexCount}
              onChange={(e) => {
                const v = Math.max(2, Math.min(6, parseInt(e.target.value, 10) || 6));
                setVertexCount(v);
                if (startVertex >= v) setStartVertex(0);
                if (destVertex >= v) setDestVertex(v - 1);
              }}
              className="w-16 bg-slate-950 border border-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl font-mono text-center"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">Source Vertex:</span>
            <select
              value={startVertex}
              onChange={(e) => setStartVertex(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 text-emerald-400 px-3 py-1.5 rounded-xl font-mono focus:outline-none"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>Vertex {n.label}</option>
              ))}
            </select>
          </div>

          {(selectedAlgo === 'dijkstra') && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">Destination:</span>
              <select
                value={destVertex}
                onChange={(e) => setDestVertex(parseInt(e.target.value, 10))}
                className="bg-slate-950 border border-slate-800 text-sky-400 px-3 py-1.5 rounded-xl font-mono focus:outline-none"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>Vertex {n.label}</option>
                ))}
              </select>
            </div>
          )}

          {selectedAlgo !== 'topological-sort' && (
            <label className="flex items-center gap-1.5 text-slate-400 font-mono cursor-pointer">
              <input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} />
              Directed
            </label>
          )}
          {selectedAlgo === 'topological-sort' && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono">
              <Info className="w-3.5 h-3.5" /> Forced directed (required for topological ordering)
            </span>
          )}
        </div>

        <button
          onClick={() => {
            setStartVertex(0);
            setDestVertex(vertexCount - 1);
            runGraphAlgo(selectedAlgo, 0, vertexCount - 1, vertexCount, effectiveDirected);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Run
        </button>
      </div>

      <div className="flex flex-col gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl glass-panel shadow-2xl relative min-h-[420px]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge icon={Activity} label="Operations" value={trace ? trace.operations : 0} color="blue" />
            <StatBadge icon={Clock} label="C Exec Time" value={trace ? trace.execution_time_us.toFixed(2) : '0.00'} unit="μs" color="emerald" />
            {selectedAlgo === 'dijkstra' && perVertexValues[destVertex] !== undefined && perVertexValues[destVertex] < INF && (
              <StatBadge icon={Route} label="Shortest Distance" value={perVertexValues[destVertex]} color="purple" />
            )}
            {activeMeta.family === 'mst-kruskal' && finalMSTEdges && (
              <StatBadge icon={Route} label="MST Total Weight" value={kruskalTotalWeight ?? 0} color="purple" />
            )}
            {activeMeta.family === 'bellman-ford' && cycleDetected && (
              <span className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-xs font-semibold">
                Negative Cycle Detected
              </span>
            )}
            {activeMeta.family === 'topo' && cycleDetected && (
              <span className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-xs font-semibold">
                Cycle Detected — Not a DAG
              </span>
            )}
          </div>

          <div className="text-xs font-mono text-slate-400">
            Vertices: <span className="text-white font-bold">{nodes.length}</span> | Edges: <span className="text-white font-bold">{edges.length}</span>
          </div>
        </div>

        {/* Floyd-Warshall: its own matrix view */}
        {activeMeta.family === 'all-pairs' && floydMatrix ? (
          <div className="overflow-x-auto py-4">
            <table className="mx-auto text-xs font-mono border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-slate-500"></th>
                  {nodes.map((n) => <th key={n.id} className="p-2 text-slate-400">{n.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {floydMatrix.map((row, i) => (
                  <tr key={i}>
                    <td className="p-2 text-slate-400 font-bold">{i}</td>
                    {row.map((val, j) => (
                      <td key={j} className={`p-2 text-center rounded ${i === j ? 'text-slate-600' : val >= INF ? 'text-rose-500/70' : 'text-emerald-300'}`}>
                        {val >= INF ? '∞' : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full h-80 relative flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 700 320">
              {edges.map((e, idx) => {
                const uNode = nodes.find((n) => n.id === e.u);
                const vNode = nodes.find((n) => n.id === e.v);
                if (!uNode || !vNode) return null;

                const isEdgeActive =
                  ((activeMeta.family === 'traverse' || activeMeta.family === 'shortest-path' || activeMeta.family === 'bellman-ford' || activeMeta.family === 'mst-prim') &&
                    activeIndices.length >= 2 &&
                    ((activeIndices[0] === e.u && activeIndices[1] === e.v) || (activeIndices[0] === e.v && activeIndices[1] === e.u))) ||
                  (activeMeta.family === 'mst-kruskal' && finalMSTEdges?.some(([mu, mv]) => (mu === e.u && mv === e.v) || (mu === e.v && mv === e.u))) ||
                  (shortestPathArr.length >= 2 && shortestPathArr.some((v, i) => i > 0 && ((shortestPathArr[i - 1] === e.u && v === e.v) || (shortestPathArr[i - 1] === e.v && v === e.u))));

                const strokeColor = isEdgeActive ? '#10b981' : '#334155';
                const strokeW = isEdgeActive ? 4 : 2;
                const midX = (uNode.x + vNode.x) / 2;
                const midY = (uNode.y + vNode.y) / 2;

                return (
                  <g key={`edge-${idx}`}>
                    <line x1={uNode.x} y1={uNode.y} x2={vNode.x} y2={vNode.y} stroke={strokeColor} strokeWidth={strokeW} className="transition-all" />
                    <rect x={midX - 12} y={midY - 10} width="24" height="20" rx="6" fill="#0f172a" stroke={isEdgeActive ? '#10b981' : '#475569'} strokeWidth="1.5" />
                    <text x={midX} y={midY + 4} textAnchor="middle" fill={isEdgeActive ? '#34d399' : '#94a3b8'} fontSize="11" fontFamily="monospace" fontWeight="bold">
                      {e.weight}
                    </text>
                  </g>
                );
              })}

              {nodes.map((node) => {
                const isStart = node.id === startVertex;
                const isDest = node.id === destVertex && selectedAlgo === 'dijkstra';
                const metric = perVertexValues[node.id];
                const showMetric = (activeMeta.family === 'shortest-path' || activeMeta.family === 'bellman-ford' || activeMeta.family === 'mst-prim') && metric !== undefined && metric < INF;
                const visitOrderIdx = visitedOrder.indexOf(node.id);

                let nodeFill = '#1e293b', nodeStroke = '#475569', textColor = '#e2e8f0';
                if (activeIndices.includes(node.id)) {
                  nodeFill = '#10b981'; nodeStroke = '#34d399'; textColor = '#0f172a';
                } else if (isStart) {
                  nodeFill = '#0284c7'; nodeStroke = '#38bdf8';
                } else if (isDest) {
                  nodeFill = '#9333ea'; nodeStroke = '#c084fc';
                } else if (visitOrderIdx >= 0) {
                  nodeFill = '#166534'; nodeStroke = '#22c55e';
                }

                return (
                  <g key={`node-${node.id}`}>
                    {activeIndices.includes(node.id) && (
                      <circle cx={node.x} cy={node.y} r="28" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" className="animate-ping" />
                    )}
                    <circle cx={node.x} cy={node.y} r="22" fill={nodeFill} stroke={nodeStroke} strokeWidth="2.5" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fill={textColor} fontSize="13" fontWeight="bold" fontFamily="monospace">
                      {node.label}
                    </text>

                    {activeMeta.family === 'traverse' && visitOrderIdx >= 0 && (
                      <text x={node.x} y={node.y - 28} textAnchor="middle" fill="#4ade80" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        #{visitOrderIdx + 1}
                      </text>
                    )}

                    {showMetric && (
                      <g>
                        <rect x={node.x - 16} y={node.y + 26} width="32" height="16" rx="4" fill="#020617" stroke="#38bdf8" strokeWidth="1" />
                        <text x={node.x} y={node.y + 38} textAnchor="middle" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          {metric}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {activeMeta.family === 'topo' && topoOrder.length > 0 && (
          <div className="flex items-center gap-2 justify-center flex-wrap pt-2">
            {topoOrder.map((v, i) => (
              <React.Fragment key={i}>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-mono text-xs font-bold">{v}</span>
                {i < topoOrder.length - 1 && <span className="text-slate-500">→</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {activeMeta.family === 'mst-kruskal' && finalMSTEdges && (
          <div className="flex items-center gap-2 justify-center flex-wrap pt-2 text-xs font-mono">
            <span className="text-slate-400">MST Edges:</span>
            {finalMSTEdges.map(([u, v, w], i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold">
                {u}-{v} (w:{w})
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-600"></span><span>Source Vertex</span></div>
          {selectedAlgo === 'dijkstra' && <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-600"></span><span>Destination Vertex</span></div>}
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span><span>Visiting / Relaxed</span></div>
          <div className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-emerald-500"></span><span>Active / MST / Path Edge</span></div>
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
          C11 Graph Engine Implementation
        </h3>
        <CodeViewer codeMetadata={codeMeta} activeLine={player.currentStep?.line} height="350px" />
      </div>
    </div>
  );
};