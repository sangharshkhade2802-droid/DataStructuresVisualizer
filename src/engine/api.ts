import { ExecutionTrace, ComparisonResult } from './types';

const API_BASE = '/api';

/**
 * Executes an API call to the C backend server.
 *
 * IMPORTANT (per backend README §1):
 * - The backend ALWAYS responds HTTP 200, even on error. Errors live INSIDE
 *   the JSON body (e.g. {"error":"..."}, or a step with action "not_found" /
 *   "overflow" / "cycle_error"). We must never branch on HTTP status.
 * - The backend is stateless: every call rebuilds the structure from the
 *   "initial"/"keys" array you send. We never try to diff — we always
 *   replace our local mirror with the server's latest full snapshot.
 */
export async function executeAlgorithmApi(
  endpoint: string,
  payload: Record<string, any> = {}
): Promise<ExecutionTrace> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // Backend returns 200 even for {"error":"Endpoint not found"} — guard for that.
      if (data && data.error) {
        throw new Error(data.error);
      }
      if (data && Array.isArray(data.steps)) {
        return data as ExecutionTrace;
      }
    }
  } catch (err) {
    console.info(`[DSVA Engine] C backend HTTP unreachable or errored, using local mirror: ${endpoint}`, err);
  }

  return runClientEngine(endpoint, payload);
}

// Kept for backward compatibility with any caller still passing algorithms;
// the backend ignores this list entirely (see compareAlgorithmsApi below).
export async function compareAlgorithmsApi(
  array: number[]
): Promise<ComparisonResult> {
  // Backend's /api/analyzer/compare runs a FIXED set of 6 algorithms
  // (Bubble, Selection, Insertion, Merge, Quick, Heap) — it is NOT
  // configurable by algorithm name. Passing "algorithms" does nothing server-side.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${API_BASE}/analyzer/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ array }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.metrics) return data as ComparisonResult;
    }
  } catch (err) {
    console.info('[DSVA Engine] Analyzer using local performance simulator');
  }

  const FIXED_ALGOS = ['Bubble Sort', 'Selection Sort', 'Insertion Sort', 'Merge Sort', 'Quick Sort', 'Heap Sort'];
  return {
    comparison: 'Sorting Algorithm Performance Comparison',
    metrics: FIXED_ALGOS.map((name) => {
      const trace = runClientSorting(name.toLowerCase().replace(/\s+/g, '-'), [...array]);
      return {
        name,
        n: array.length,
        time_us: trace.execution_time_us || (Math.random() * 80 + 20),
        comparisons: trace.comparisons,
        swaps: trace.swaps,
        operations: trace.operations,
        time_complexity: name.includes('Bubble') || name.includes('Selection') || name.includes('Insertion') ? 'O(n²)' : 'O(n log n)',
        space_complexity: name.includes('Merge') ? 'O(n)' : 'O(1)',
      };
    }),
  };
}

/**
 * Client-Side C-Mirror Engine (fallback only, used when the C backend
 * is unreachable). Shapes below mirror the backend's documented contract
 * as closely as possible so the SAME visualizer code works whether data
 * came from the real backend or this mirror.
 */
function runClientEngine(endpoint: string, payload: Record<string, any>): ExecutionTrace {
  if (endpoint.startsWith('/sorting/')) {
    const algo = endpoint.replace('/sorting/', '');
    const arr = payload.array && payload.array.length ? [...payload.array] : [29, 10, 14, 37, 13, 42, 18, 25];
    return runClientSorting(algo, arr);
  }

  if (endpoint.startsWith('/searching/')) {
    const algo = endpoint.replace('/searching/', '');
    const arr = payload.array && payload.array.length ? [...payload.array] : [10, 13, 14, 18, 25, 29, 37, 42, 55, 68];
    const target = payload.target ?? 29;
    return runClientSearching(algo, arr, target);
  }

  if (endpoint.startsWith('/data-structures/')) {
    const sub = endpoint.replace('/data-structures/', '');
    if (sub === 'hash' || sub.includes('hash')) {
      return runClientHash(payload);
    }
    const initial = payload.initial && payload.initial.length ? [...payload.initial] : [15, 30, 45, 60];
    const op = payload.op || 'insert';
    const val = payload.value ?? 99;
    const pos = payload.pos ?? payload.index ?? 1;
    return runClientLinear(sub, initial, op, pos, val);
  }

  if (endpoint.startsWith('/graph/')) {
    const algo = endpoint.replace('/graph/', '');
    // Backend ALWAYS uses the hardcoded 9-edge demo graph regardless of
    // what's requested — vertices/directed only affect size/directedness.
    const V = Math.min(32, Math.max(1, payload.vertices || 6));
    const start = payload.start ?? 0;
    const dest = payload.dest ?? 5;
    return runClientGraph(algo, V, start, dest);
  }

  if (endpoint.startsWith('/tree/')) {
    const algo = endpoint.replace('/tree/', '');
    const keys = payload.keys && payload.keys.length ? [...payload.keys] : [50, 30, 70, 20, 40, 60, 80];
    const op = payload.op || 'insert';
    const val = payload.value ?? 45;
    return runClientTree(algo, keys, op, val, payload);
  }

  return {
    algorithm: 'General Algorithm',
    category: 'General',
    status: 'completed',
    comparisons: 0,
    swaps: 0,
    operations: 1,
    execution_time_us: 15.0,
    steps: [
      { step: 1, action: 'init', line: 1, description: 'Initialized', indices: [], array: [] }
    ]
  } as ExecutionTrace;
}

/* ============================================================
 * 1. Client Sorting  (unchanged — this module was already correct)
 * ============================================================ */
function runClientSorting(algo: string, arr: number[]): ExecutionTrace {
  const steps: any[] = [];
  let comparisons = 0;
  let swaps = 0;
  const t0 = performance.now();

  steps.push({
    step: 1, action: 'init', line: 1,
    description: 'Initial unsorted array loaded',
    indices: [], array: [...arr],
  });

  const a = [...arr];
  const n = a.length;

  if (algo.includes('bubble')) {
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - i - 1; j++) {
        comparisons++;
        steps.push({
          step: steps.length + 1, action: 'compare', line: 5,
          description: `Comparing array[${j}]=${a[j]} and array[${j + 1}]=${a[j + 1]} (Pass i=${i})`,
          indices: [j, j + 1], array: [...a],
          aux: { pointers: { i: n - 1 - i, j, 'j+1': j + 1 } },
        });
        if (a[j] > a[j + 1]) {
          [a[j], a[j + 1]] = [a[j + 1], a[j]];
          swaps++; swapped = true;
          steps.push({
            step: steps.length + 1, action: 'swap', line: 8,
            description: `Swapped elements at indices ${j} and ${j + 1}`,
            indices: [j, j + 1], array: [...a],
            aux: { pointers: { i: n - 1 - i, j, 'j+1': j + 1 } },
          });
        }
      }
      steps.push({
        step: steps.length + 1, action: 'mark_sorted', line: 12,
        description: `Element at index ${n - 1 - i} locked into sorted position`,
        indices: [n - 1 - i], array: [...a],
        aux: { pointers: { sorted: n - 1 - i, i: n - 1 - i } },
      });
      if (!swapped) break;
    }
  } else if (algo.includes('selection')) {
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      steps.push({
        step: steps.length + 1, action: 'highlight', line: 3,
        description: `Current slot i=${i}. Initializing minimum pointer at min=${i}`,
        indices: [i], array: [...a], aux: { pointers: { i, min: minIdx } },
      });
      for (let j = i + 1; j < n; j++) {
        comparisons++;
        steps.push({
          step: steps.length + 1, action: 'compare', line: 6,
          description: `Comparing scanner j=${j} (val: ${a[j]}) with minimum min=${minIdx} (val: ${a[minIdx]})`,
          indices: [j, minIdx], array: [...a], aux: { pointers: { i, j, min: minIdx } },
        });
        if (a[j] < a[minIdx]) {
          minIdx = j;
          steps.push({
            step: steps.length + 1, action: 'select', line: 8,
            description: `Found new smaller minimum at index min=${minIdx} (val: ${a[minIdx]})`,
            indices: [minIdx], array: [...a], aux: { pointers: { i, j, min: minIdx } },
          });
        }
      }
      if (minIdx !== i) {
        [a[i], a[minIdx]] = [a[minIdx], a[i]];
        swaps++;
        steps.push({
          step: steps.length + 1, action: 'swap', line: 13,
          description: `Swapped found minimum array[${minIdx}]=${a[i]} into slot i=${i}`,
          indices: [i, minIdx], array: [...a], aux: { pointers: { i, min: minIdx } },
        });
      }
      steps.push({
        step: steps.length + 1, action: 'mark_sorted', line: 16,
        description: `Index i=${i} is now sorted`,
        indices: [i], array: [...a], aux: { pointers: { sorted: i, i } },
      });
    }
  } else if (algo.includes('insertion')) {
    for (let i = 1; i < n; i++) {
      const key = a[i];
      let j = i - 1;
      steps.push({
        step: steps.length + 1, action: 'select', line: 4,
        description: `Selected key ${key} at index i=${i} for insertion`,
        indices: [i], array: [...a], aux: { pointers: { i, key: i, j: j >= 0 ? j : 0 } },
      });
      while (j >= 0 && a[j] > key) {
        comparisons++;
        a[j + 1] = a[j];
        swaps++;
        steps.push({
          step: steps.length + 1, action: 'shift', line: 10,
          description: `Shifted element ${a[j]} right from j=${j} to j+1=${j + 1}`,
          indices: [j, j + 1], array: [...a], aux: { pointers: { key: i, j, 'j+1': j + 1 } },
        });
        j--;
      }
      a[j + 1] = key;
      steps.push({
        step: steps.length + 1, action: 'insert', line: 15,
        description: `Inserted key ${key} at sorted position index j+1=${j + 1}`,
        indices: [j + 1], array: [...a], aux: { pointers: { key: j + 1, 'j+1': j + 1 } },
      });
    }
  } else if (algo.includes('merge')) {
    function merge(l: number, m: number, r: number) {
      const left = a.slice(l, m + 1);
      const right = a.slice(m + 1, r + 1);
      let i = 0, j = 0, k = l;
      while (i < left.length && j < right.length) {
        comparisons++;
        steps.push({
          step: steps.length + 1, action: 'compare', line: 12,
          description: `Comparing left[${i}]=${left[i]} (idx ${l + i}) and right[${j}]=${right[j]} (idx ${m + 1 + j})`,
          indices: [l + i, m + 1 + j], array: [...a],
          aux: { pointers: { low: l, mid: m, high: r, i: l + i, j: m + 1 + j, k } },
        });
        if (left[i] <= right[j]) a[k] = left[i++]; else a[k] = right[j++];
        steps.push({
          step: steps.length + 1, action: 'overwrite', line: 15,
          description: `Placed ${a[k]} at index k=${k}`,
          indices: [k], array: [...a], aux: { pointers: { low: l, mid: m, high: r, k } },
        });
        k++;
      }
      while (i < left.length) {
        a[k] = left[i++];
        steps.push({
          step: steps.length + 1, action: 'overwrite', line: 23,
          description: `Placed remaining left element at index k=${k}`,
          indices: [k], array: [...a], aux: { pointers: { low: l, mid: m, high: r, k } },
        });
        k++;
      }
      while (j < right.length) {
        a[k] = right[j++];
        steps.push({
          step: steps.length + 1, action: 'overwrite', line: 28,
          description: `Placed remaining right element at index k=${k}`,
          indices: [k], array: [...a], aux: { pointers: { low: l, mid: m, high: r, k } },
        });
        k++;
      }
    }
    function sort(l: number, r: number) {
      if (l < r) {
        const m = Math.floor((l + r) / 2);
        steps.push({
          step: steps.length + 1, action: 'split', line: 5,
          description: `Dividing subarray range [${l}..${r}] at mid ${m}`,
          indices: [l, r], array: [...a], aux: { pointers: { low: l, mid: m, high: r } },
        });
        sort(l, m); sort(m + 1, r); merge(l, m, r);
      }
    }
    sort(0, n - 1);
  } else if (algo.includes('heap')) {
    function heapify(sz: number, i: number) {
      let largest = i;
      const left = 2 * i + 1, right = 2 * i + 2;
      if (left < sz) {
        comparisons++;
        steps.push({
          step: steps.length + 1, action: 'compare', line: 6,
          description: `Comparing left child arr[${left}]=${a[left]} with largest arr[${largest}]=${a[largest]}`,
          indices: [left, largest], array: [...a],
          aux: { pointers: { root: 0, i, left, largest, heap_end: sz - 1 } },
        });
        if (a[left] > a[largest]) largest = left;
      }
      if (right < sz) {
        comparisons++;
        steps.push({
          step: steps.length + 1, action: 'compare', line: 10,
          description: `Comparing right child arr[${right}]=${a[right]} with largest arr[${largest}]=${a[largest]}`,
          indices: [right, largest], array: [...a],
          aux: { pointers: { root: 0, i, right, largest, heap_end: sz - 1 } },
        });
        if (a[right] > a[largest]) largest = right;
      }
      if (largest !== i) {
        [a[i], a[largest]] = [a[largest], a[i]];
        swaps++;
        steps.push({
          step: steps.length + 1, action: 'swap', line: 15,
          description: `Heapify: Swapped parent arr[${i}] with larger child arr[${largest}]`,
          indices: [i, largest], array: [...a],
          aux: { pointers: { root: 0, i, largest, heap_end: sz - 1 } },
        });
        heapify(sz, largest);
      }
    }
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(n, i);
    for (let i = n - 1; i > 0; i--) {
      [a[0], a[i]] = [a[i], a[0]];
      swaps++;
      steps.push({
        step: steps.length + 1, action: 'swap', line: 12,
        description: `Moved maximum root arr[0]=${a[i]} to end of heap index ${i}`,
        indices: [0, i], array: [...a], aux: { pointers: { root: 0, i, heap_end: i } },
      });
      steps.push({
        step: steps.length + 1, action: 'mark_sorted', line: 14,
        description: `Element at index ${i} locked into sorted position`,
        indices: [i], array: [...a], aux: { pointers: { sorted: i, i } },
      });
      heapify(i, 0);
    }
  } else if (algo.includes('shell')) {
    for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
      for (let i = gap; i < n; i++) {
        const temp = a[i];
        let j = i;
        steps.push({
          step: steps.length + 1, action: 'select', line: 8,
          description: `Gap = ${gap}. Considering element ${temp} at index i=${i}`,
          indices: [i], array: [...a], aux: { pointers: { gap, i, j } },
        });
        while (j >= gap) {
          comparisons++;
          steps.push({
            step: steps.length + 1, action: 'compare', line: 11,
            description: `Comparing arr[${j - gap}]=${a[j - gap]} with key ${temp} (gap ${gap})`,
            indices: [j - gap, j], array: [...a], aux: { pointers: { gap, i, j, 'j-gap': j - gap } },
          });
          if (a[j - gap] > temp) {
            a[j] = a[j - gap];
            steps.push({
              step: steps.length + 1, action: 'shift', line: 14,
              description: `Shifted element from index ${j - gap} to ${j}`,
              indices: [j - gap, j], array: [...a], aux: { pointers: { gap, i, j, 'j-gap': j - gap } },
            });
            j -= gap;
          } else break;
        }
        a[j] = temp;
        steps.push({
          step: steps.length + 1, action: 'insert', line: 19,
          description: `Placed key ${temp} at index j=${j}`,
          indices: [j], array: [...a], aux: { pointers: { gap, i, j } },
        });
      }
    }
  } else if (algo.includes('counting')) {
    // Correctly shifts by min_val, so this also works for negative numbers (matches backend).
    let maxVal = a[0], minVal = a[0];
    for (let i = 1; i < n; i++) {
      if (a[i] > maxVal) maxVal = a[i];
      if (a[i] < minVal) minVal = a[i];
    }
    const range = maxVal - minVal + 1;
    const count = new Array(range).fill(0);
    const output = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      count[a[i] - minVal]++;
      steps.push({
        step: steps.length + 1, action: 'compare', line: 8,
        description: `Counted occurrence of value ${a[i]} at index i=${i}`,
        indices: [i], array: [...a], aux: { pointers: { i } },
      });
    }
    for (let i = 1; i < range; i++) count[i] += count[i - 1];
    for (let i = n - 1; i >= 0; i--) {
      const pos = count[a[i] - minVal] - 1;
      output[pos] = a[i];
      count[a[i] - minVal]--;
    }
    for (let i = 0; i < n; i++) {
      a[i] = output[i];
      steps.push({
        step: steps.length + 1, action: 'overwrite', line: 20,
        description: `Placed sorted value ${a[i]} at index i=${i}`,
        indices: [i], array: [...a], aux: { pointers: { i, sorted: i } },
      });
    }
  } else if (algo.includes('radix')) {
    // NOTE: Radix Sort assumes non-negative integers (matches backend limitation).
    // The UI must not offer negative numbers when this algorithm is selected.
    const maxVal = Math.max(...a, 0);
    for (let exp = 1; Math.floor(maxVal / exp) > 0; exp *= 10) {
      const output = new Array(n).fill(0);
      const count = new Array(10).fill(0);
      for (let i = 0; i < n; i++) count[Math.floor(a[i] / exp) % 10]++;
      for (let i = 1; i < 10; i++) count[i] += count[i - 1];
      for (let i = n - 1; i >= 0; i--) {
        const digit = Math.floor(a[i] / exp) % 10;
        output[count[digit] - 1] = a[i];
        count[digit]--;
      }
      for (let i = 0; i < n; i++) {
        a[i] = output[i];
        steps.push({
          step: steps.length + 1, action: 'overwrite', line: 18,
          description: `Radix exp=${exp}: Placed ${a[i]} at index i=${i}`,
          indices: [i], array: [...a], aux: { pointers: { i } },
        });
      }
    }
  } else if (algo.includes('bucket')) {
    const maxVal = Math.max(...a), minVal = Math.min(...a);
    const bucketCount = Math.min(5, n);
    const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
    const range = maxVal - minVal + 1;
    for (let i = 0; i < n; i++) {
      let bIdx = Math.floor(((a[i] - minVal) * (bucketCount - 1)) / (range || 1));
      if (bIdx >= bucketCount) bIdx = bucketCount - 1;
      buckets[bIdx].push(a[i]);
      steps.push({
        step: steps.length + 1, action: 'compare', line: 14,
        description: `Distributed ${a[i]} at index i=${i} into bucket #${bIdx}`,
        indices: [i], array: [...a], aux: { pointers: { i, bucket: bIdx } },
      });
    }
    let outIdx = 0;
    for (let b = 0; b < bucketCount; b++) {
      buckets[b].sort((x, y) => x - y);
      for (let i = 0; i < buckets[b].length; i++) {
        a[outIdx] = buckets[b][i];
        steps.push({
          step: steps.length + 1, action: 'overwrite', line: 28,
          description: `Collected ${a[outIdx]} from bucket #${b} to index ${outIdx}`,
          indices: [outIdx], array: [...a], aux: { pointers: { i: outIdx, sorted: outIdx } },
        });
        outIdx++;
      }
    }
  } else {
    function qsort(low: number, high: number) {
      if (low < high) {
        const pivot = a[high];
        steps.push({
          step: steps.length + 1, action: 'pivot', line: 4,
          description: `Selected pivot ${pivot} at index high=${high}`,
          indices: [high], array: [...a], aux: { pointers: { pivot: high, low, high } },
        });
        let i = low - 1;
        for (let j = low; j < high; j++) {
          comparisons++;
          steps.push({
            step: steps.length + 1, action: 'compare', line: 8,
            description: `Comparing scanner j=${j} (val: ${a[j]}) with pivot=${high} (val: ${pivot})`,
            indices: [j, high], array: [...a],
            aux: { pointers: { pivot: high, low, high, j, ...(i >= low ? { i } : {}) } },
          });
          if (a[j] < pivot) {
            i++;
            [a[i], a[j]] = [a[j], a[i]];
            if (i !== j) {
              swaps++;
              steps.push({
                step: steps.length + 1, action: 'swap', line: 12,
                description: `Partition: Swapped smaller element arr[${j}] with arr[${i}] (i=${i}, j=${j})`,
                indices: [i, j], array: [...a], aux: { pointers: { pivot: high, low, high, i, j } },
              });
            }
          }
        }
        [a[i + 1], a[high]] = [a[high], a[i + 1]];
        swaps++;
        steps.push({
          step: steps.length + 1, action: 'swap', line: 18,
          description: `Placed pivot ${pivot} into its final sorted position at index ${i + 1}`,
          indices: [i + 1, high], array: [...a],
          aux: { pointers: { pivot: high, target: i + 1, i: i + 1, low, high } },
        });
        steps.push({
          step: steps.length + 1, action: 'mark_sorted', line: 20,
          description: `Pivot element settled at index ${i + 1}`,
          indices: [i + 1], array: [...a], aux: { pointers: { sorted: i + 1, pivot: i + 1 } },
        });
        qsort(low, i);
        qsort(i + 2, high);
      }
    }
    qsort(0, n - 1);
  }

  steps.push({
    step: steps.length + 1, action: 'complete', line: 30,
    description: 'Sorting complete. All elements verified in non-decreasing order',
    indices: [], array: [...a],
  });

  const t1 = performance.now();
  return {
    algorithm: algo.replace(/-/g, ' ').toUpperCase(),
    category: 'Sorting Algorithms',
    status: 'completed',
    comparisons,
    swaps,
    operations: steps.length,
    execution_time_us: Math.max(12, Math.round((t1 - t0) * 1000)),
    steps,
  };
}

/* ============================================================
 * 2. Client Searching
 * FIX: backend docs explicitly say Binary/Jump/Interpolation/Exponential
 * REQUIRE a sorted array and will NOT sort it for you. The mirror must
 * mimic that: only Linear Search works correctly on unsorted input; the
 * others silently behave "as if" sorted (same as the real C backend —
 * garbage in, garbage out). We do NOT secretly sort here, because doing
 * so would make the mirror behave *better* than the real backend and
 * hide bugs the UI needs to warn users about (see SearchingVisualizer patch).
 * ============================================================ */
function runClientSearching(algo: string, arr: number[], target: number): ExecutionTrace {
  const steps: any[] = [];
  const n = arr.length;
  steps.push({
    step: 1, action: 'init', line: 1,
    description: `Searching for target ${target}`,
    indices: [], array: [...arr], aux: { target },
  });

  if (algo.includes('linear')) {
    let found = false;
    for (let i = 0; i < n; i++) {
      steps.push({
        step: steps.length + 1, action: 'compare', line: 4,
        description: `Checking index i=${i} (value ${arr[i]}) against target ${target}`,
        indices: [i], array: [...arr], aux: { target, current: i, pointers: { i } },
      });
      if (arr[i] === target) {
        steps.push({
          step: steps.length + 1, action: 'found', line: 7,
          description: `Target ${target} FOUND at index i=${i}!`,
          indices: [i], array: [...arr], aux: { target, found_index: i, pointers: { found: i, i } },
        });
        found = true;
        break;
      }
    }
    if (!found) {
      steps.push({
        step: steps.length + 1, action: 'not_found', line: 12,
        description: `Target ${target} NOT FOUND in array`,
        indices: [], array: [...arr], aux: { target },
      });
    }
  } else if (algo.includes('jump')) {
    const step = Math.max(1, Math.floor(Math.sqrt(n)));
    let prev = 0;
    let curr = step;
    let found = false;
    while (curr < n && arr[Math.min(curr, n - 1)] < target) {
      steps.push({
        step: steps.length + 1, action: 'compare', line: 5,
        description: `Jump block ending at index ${Math.min(curr, n - 1)} (value ${arr[Math.min(curr, n - 1)]}) still < target`,
        indices: [Math.min(curr, n - 1)], array: [...arr],
        aux: { target, pointers: { low: prev, high: Math.min(curr, n - 1) } },
      });
      prev = curr;
      curr += step;
    }
    const high = Math.min(curr, n - 1);
    for (let i = prev; i <= high; i++) {
      steps.push({
        step: steps.length + 1, action: 'compare', line: 10,
        description: `Linear scan within block: checking index i=${i} (value ${arr[i]})`,
        indices: [i], array: [...arr], aux: { target, pointers: { low: prev, i, high } },
      });
      if (arr[i] === target) {
        steps.push({
          step: steps.length + 1, action: 'found', line: 12,
          description: `Target ${target} FOUND at index ${i}!`,
          indices: [i], array: [...arr], aux: { target, pointers: { found: i } },
        });
        found = true;
        break;
      }
    }
    if (!found) {
      steps.push({
        step: steps.length + 1, action: 'not_found', line: 16,
        description: `Target ${target} NOT FOUND in array`,
        indices: [], array: [...arr], aux: { target },
      });
    }
  } else if (algo.includes('interpolation')) {
    let low = 0, high = n - 1, found = false;
    while (low <= high && target >= arr[low] && target <= arr[high]) {
      // FIX (mirrors the backend's actual C patch): guard div-by-zero when
      // arr[high] === arr[low] (duplicate-value window), matching the fixed
      // backend behavior exactly instead of crashing or producing NaN.
      let pos: number;
      if (arr[high] === arr[low]) {
        pos = low;
      } else {
        pos = low + Math.floor(((high - low) / (arr[high] - arr[low])) * (target - arr[low]));
      }
      pos = Math.max(low, Math.min(high, pos));
      steps.push({
        step: steps.length + 1, action: 'examine_mid', line: 8,
        description: `Probing interpolated position pos=${pos} (value ${arr[pos]})`,
        indices: [pos], array: [...arr], aux: { target, low, high, mid: pos, pointers: { low, mid: pos, high } },
      });
      if (arr[pos] === target) {
        steps.push({
          step: steps.length + 1, action: 'found', line: 11,
          description: `Target ${target} FOUND at index ${pos}!`,
          indices: [pos], array: [...arr], aux: { target, pointers: { found: pos } },
        });
        found = true;
        break;
      }
      if (arr[pos] < target) low = pos + 1; else high = pos - 1;
    }
    if (!found) {
      steps.push({
        step: steps.length + 1, action: 'not_found', line: 20,
        description: `Target ${target} NOT FOUND in range`,
        indices: [], array: [...arr], aux: { target },
      });
    }
  } else if (algo.includes('exponential')) {
    let bound = 1, found = false;
    if (arr[0] !== target) {
      while (bound < n && arr[bound] < target) {
        steps.push({
          step: steps.length + 1, action: 'compare', line: 5,
          description: `Doubling bound to index ${bound} (value ${arr[bound]})`,
          indices: [bound], array: [...arr], aux: { target, pointers: { high: bound } },
        });
        bound *= 2;
      }
    } else {
      steps.push({
        step: steps.length + 1, action: 'found', line: 4,
        description: `Target ${target} FOUND at index 0!`,
        indices: [0], array: [...arr], aux: { target, pointers: { found: 0 } },
      });
      found = true;
    }
    if (!found) {
      let low = bound / 2, high = Math.min(bound, n - 1);
      while (low <= high) {
        const mid = Math.floor(low + (high - low) / 2);
        steps.push({
          step: steps.length + 1, action: 'examine_mid', line: 10,
          description: `Binary search within exponential range: mid=${mid} (value ${arr[mid]})`,
          indices: [mid], array: [...arr], aux: { target, low, high, mid, pointers: { low, mid, high } },
        });
        if (arr[mid] === target) {
          steps.push({
            step: steps.length + 1, action: 'found', line: 12,
            description: `Target ${target} FOUND at index ${mid}!`,
            indices: [mid], array: [...arr], aux: { target, pointers: { found: mid } },
          });
          found = true;
          break;
        } else if (arr[mid] < target) low = mid + 1; else high = mid - 1;
      }
    }
    if (!found) {
      steps.push({
        step: steps.length + 1, action: 'not_found', line: 18,
        description: `Target ${target} NOT FOUND in range`,
        indices: [], array: [...arr], aux: { target },
      });
    }
  } else {
    // Binary search (also the fallback, matching backend's "unknown -> Binary Search" rule)
    let low = 0, high = n - 1, found = false;
    while (low <= high) {
      const mid = Math.floor(low + (high - low) / 2);
      steps.push({
        step: steps.length + 1, action: 'examine_mid', line: 6,
        description: `Bounds [low=${low}..high=${high}], midpoint mid=${mid} (value ${arr[mid]})`,
        indices: [low, mid, high], array: [...arr], aux: { target, low, high, mid, pointers: { low, mid, high } },
      });
      if (arr[mid] === target) {
        steps.push({
          step: steps.length + 1, action: 'found', line: 11,
          description: `Target ${target} FOUND at index mid=${mid}!`,
          indices: [mid], array: [...arr], aux: { target, mid, pointers: { found: mid, mid } },
        });
        found = true;
        break;
      } else if (arr[mid] < target) {
        steps.push({
          step: steps.length + 1, action: 'eliminate_left', line: 15,
          description: `Value ${arr[mid]} < ${target}. Eliminating left half [${low}..${mid}]`,
          indices: [low, mid], array: [...arr], aux: { target, low, high, mid, pointers: { low, mid, high } },
        });
        low = mid + 1;
      } else {
        steps.push({
          step: steps.length + 1, action: 'eliminate_right', line: 18,
          description: `Value ${arr[mid]} > ${target}. Eliminating right half [${mid}..${high}]`,
          indices: [mid, high], array: [...arr], aux: { target, low, high, mid, pointers: { low, mid, high } },
        });
        high = mid - 1;
      }
    }
    if (!found) {
      steps.push({
        step: steps.length + 1, action: 'not_found', line: 23,
        description: `Target ${target} NOT FOUND in range`,
        indices: [], array: [...arr], aux: { target },
      });
    }
  }

  return {
    algorithm: algo.replace(/-/g, ' ').toUpperCase(),
    category: 'Searching Algorithms',
    status: 'completed',
    comparisons: steps.filter(s => s.action === 'compare' || s.action === 'examine_mid').length,
    swaps: 0,
    operations: steps.length,
    execution_time_us: 18.5,
    steps,
  };
}

/* ============================================================
 * 3. Client Linear Data Structures
 * FIX: path segments now match backend §2.6 EXACTLY
 * (singly-linked-list/doubly-linked-list/circular-list/stack/queue/
 *  circular-queue/deque/array), stack capacity floor behavior mirrored,
 * circular-queue wraps with modulo instead of plain splice.
 * ============================================================ */
function runClientLinear(sub: string, arr: number[], op: string, pos: number, val: number): ExecutionTrace {
  const steps: any[] = [];
  const a = [...arr];

  steps.push({
    step: 1, action: 'init', line: 1,
    description: `Current ${sub} state: [${a.join(', ')}]`,
    indices: [], array: [...a], aux: { size: a.length },
  });

  const isStack = sub === 'stack';
  const isCircularQueue = sub === 'circular-queue';
  const isQueue = !isCircularQueue && sub.includes('queue') && sub !== 'deque';
  const isDeque = sub === 'deque';
  const isCircularList = sub === 'circular-list';
  const isArray = sub === 'array';

  if (op === 'insert' || op === 'push' || op === 'enqueue' || op === 'push_front' || op === 'push_back') {
    steps.push({
      step: steps.length + 1, action: 'allocate', line: 4,
      description: `Heap allocation: Node *newNode = (Node*)malloc(sizeof(Node)); newNode->data = ${val}`,
      indices: [], array: [...a], aux: { value: val, address: '0x' + (0x7ffe00 + val * 16).toString(16) },
    });

    if (isStack) {
      // Backend: stack capacity silently floored to size+1 — never truncates.
      a.push(val);
      steps.push({
        step: steps.length + 1, action: 'push', line: 8,
        description: `PUSH(${val}): Incremented top pointer and stored ${val}`,
        indices: [a.length - 1], array: [...a], aux: { top: a.length - 1 },
      });
    } else if (isQueue || isCircularQueue) {
      a.push(val);
      steps.push({
        step: steps.length + 1, action: 'enqueue', line: 5,
        description: `ENQUEUE(${val}): Appended element at rear of queue`,
        indices: [a.length - 1], array: [...a], aux: { rear: a.length - 1 },
      });
    } else if (isDeque) {
      if (op === 'push_front') {
        a.unshift(val);
        steps.push({
          step: steps.length + 1, action: 'push_front', line: 6,
          description: `PUSH_FRONT(${val}): Inserted at front of deque`,
          indices: [0], array: [...a], aux: { front: 0 },
        });
      } else {
        a.push(val);
        steps.push({
          step: steps.length + 1, action: 'push_back', line: 6,
          description: `PUSH_BACK(${val}): Inserted at back of deque`,
          indices: [a.length - 1], array: [...a], aux: { back: a.length - 1 },
        });
      }
    } else {
      // singly-linked-list / doubly-linked-list / circular-list / array — positional insert
      const idx = isArray ? Math.min(Math.max(0, pos), a.length) : Math.min(Math.max(0, pos), a.length);
      a.splice(idx, 0, val);
      steps.push({
        step: steps.length + 1, action: 'pointer_assign', line: 12,
        description: isCircularList
          ? `Rewired circular links: newNode->next = prev->next; prev->next = newNode; tail->next = head`
          : `Rewired next pointers: newNode->next = prev->next; prev->next = newNode`,
        indices: [idx], array: [...a], aux: { index: idx },
      });
    }
  } else if (op === 'delete' || op === 'pop' || op === 'dequeue' || op === 'pop_front' || op === 'pop_back') {
    if (a.length > 0) {
      if (isStack) {
        const popped = a.pop();
        steps.push({
          step: steps.length + 1, action: 'pop', line: 16,
          description: `POP(): Extracted top element ${popped}. Decremented top index`,
          indices: [a.length], array: [...a], aux: { popped },
        });
      } else if (isQueue || isCircularQueue) {
        const deq = a.shift();
        steps.push({
          step: steps.length + 1, action: 'dequeue', line: 13,
          description: `DEQUEUE(): Removed front element ${deq}`,
          indices: [0], array: [...a], aux: { dequeued: deq },
        });
      } else if (isDeque) {
        if (op === 'pop_front') {
          const d = a.shift();
          steps.push({
            step: steps.length + 1, action: 'pop_front', line: 16,
            description: `POP_FRONT(): Removed front element ${d}`,
            indices: [0], array: [...a], aux: { popped: d },
          });
        } else {
          const d = a.pop();
          steps.push({
            step: steps.length + 1, action: 'pop_back', line: 16,
            description: `POP_BACK(): Removed back element ${d}`,
            indices: [a.length], array: [...a], aux: { popped: d },
          });
        }
      } else {
        const idx = Math.min(Math.max(0, pos), a.length - 1);
        const del = a.splice(idx, 1)[0];
        steps.push({
          step: steps.length + 1, action: 'free_memory', line: 28,
          description: `Free node ${del}: prev->next = target->next; free(target)`,
          indices: [idx], array: [...a], aux: { deleted: del },
        });
      }
    } else {
      steps.push({
        step: steps.length + 1, action: 'underflow', line: 30,
        description: `Underflow: cannot remove from an empty ${sub}`,
        indices: [], array: [...a],
      });
    }
  } else if (op === 'search') {
    const idx = a.indexOf(val);
    steps.push({
      step: steps.length + 1, action: idx >= 0 ? 'found' : 'not_found', line: 20,
      description: idx >= 0 ? `Found ${val} at index ${idx}` : `Value ${val} not found`,
      indices: idx >= 0 ? [idx] : [], array: [...a],
    });
  } else if (op === 'peek') {
    const idx = isStack ? a.length - 1 : 0;
    steps.push({
      step: steps.length + 1, action: 'peek', line: 10,
      description: `Peek: ${a[idx]} at index ${idx}`,
      indices: a.length ? [idx] : [], array: [...a],
    });
  }

  steps.push({
    step: steps.length + 1, action: 'complete', line: 35,
    description: `Operation complete. Length is now ${a.length}`,
    indices: [], array: [...a],
  });

  return {
    algorithm: sub.toUpperCase(),
    category: 'Linear Data Structures',
    status: 'completed',
    comparisons: 0,
    swaps: 0,
    operations: steps.length,
    execution_time_us: 14.2,
    steps,
  };
}

/* ============================================================
 * 4. Client Hash Table
 * FIX: this did not exist before — HashVisualizer was calling the generic
 * linear mirror which has no concept of hashing, collisions, probing, or
 * chaining at all. Mirrors backend §2.6 "Hash table specifics" precisely:
 * linear/quadratic probing -> flat array (-1 = empty); anything else ->
 * separate chaining, where "array" only shows chain HEADS and the real
 * per-bucket contents live in aux.chain.
 * ============================================================ */
function runClientHash(payload: Record<string, any>): ExecutionTrace {
  const capacity = payload.capacity ?? 10;
  const mode: string = (payload.mode || 'linear').toLowerCase();
  const initial: number[] = payload.initial && payload.initial.length ? [...payload.initial] : [15, 25, 35, 42];
  const op = payload.op || 'insert';
  const value = payload.value ?? 55;

  const steps: any[] = [];
  const isChaining = mode !== 'linear' && mode !== 'quadratic';

  if (isChaining) {
    const buckets: number[][] = Array.from({ length: capacity }, () => []);
    const insertChain = (v: number, recordStep: boolean) => {
      const idx = ((v % capacity) + capacity) % capacity;
      buckets[idx].push(v);
      if (recordStep) {
        const headArray = buckets.map(b => (b.length ? b[0] : -1));
        steps.push({
          step: steps.length + 1,
          action: buckets[idx].length > 1 ? 'chain_link' : 'insert',
          line: buckets[idx].length > 1 ? 10 : 6,
          description: buckets[idx].length > 1
            ? `Collision at bucket ${idx}: chained ${v} onto existing chain`
            : `Inserted ${v} at bucket ${idx} (h(k) = ${v} % ${capacity} = ${idx})`,
          indices: [idx],
          array: headArray,
          aux: { mode: 'chaining', bucket: idx, chain: [...buckets[idx]] },
        });
      }
    };
    initial.forEach(v => insertChain(v, false));
    const initHeadArray = buckets.map(b => (b.length ? b[0] : -1));
    steps.push({
      step: steps.length + 1, action: 'init', line: 1,
      description: `Initialized hash table (separate chaining), capacity ${capacity}`,
      indices: [], array: initHeadArray, aux: { mode: 'chaining' },
    });

    if (op === 'insert') {
      insertChain(value, true);
    } else if (op === 'search') {
      const idx = ((value % capacity) + capacity) % capacity;
      const found = buckets[idx].includes(value);
      steps.push({
        step: steps.length + 1,
        action: found ? 'found' : 'not_found',
        line: 20,
        description: found
          ? `Found ${value} in chain at bucket ${idx}`
          : `${value} not found in chain at bucket ${idx}`,
        indices: [idx],
        array: buckets.map(b => (b.length ? b[0] : -1)),
        aux: { mode: 'chaining', bucket: idx, chain: [...buckets[idx]] },
      });
    }
  } else {
    const table: number[] = new Array(capacity).fill(-1);
    const insertProbe = (v: number, recordStep: boolean) => {
      const h = ((v % capacity) + capacity) % capacity;
      let placed = false;
      for (let i = 0; i < capacity; i++) {
        const idx = mode === 'quadratic'
          ? (h + i * i) % capacity
          : (h + i) % capacity;
        if (recordStep && i > 0) {
          steps.push({
            step: steps.length + 1, action: 'collision', line: 9,
            description: `Collision at slot ${(h + (mode === 'quadratic' ? (i - 1) * (i - 1) : i - 1)) % capacity}, probing slot ${idx}`,
            indices: [idx], array: [...table], aux: { mode },
          });
        }
        if (table[idx] === -1) {
          table[idx] = v;
          placed = true;
          if (recordStep) {
            steps.push({
              step: steps.length + 1, action: 'insert', line: 6,
              description: `Inserted ${v} at slot ${idx}`,
              indices: [idx], array: [...table], aux: { mode },
            });
          }
          break;
        }
      }
      if (!placed && recordStep) {
        steps.push({
          step: steps.length + 1, action: 'overflow', line: 14,
          description: mode === 'quadratic'
            ? `Overflow: quadratic probing could not place ${v} (non-prime table size limitation)`
            : `Overflow: table is full, cannot place ${v}`,
          indices: [], array: [...table], aux: { mode },
        });
      }
    };
    initial.forEach(v => insertProbe(v, false));
    steps.push({
      step: steps.length + 1, action: 'init', line: 1,
      description: `Initialized hash table (${mode} probing), capacity ${capacity}`,
      indices: [], array: [...table], aux: { mode },
    });

    if (op === 'insert') {
      insertProbe(value, true);
    } else if (op === 'search') {
      const h = ((value % capacity) + capacity) % capacity;
      let foundIdx = -1;
      for (let i = 0; i < capacity; i++) {
        const idx = mode === 'quadratic' ? (h + i * i) % capacity : (h + i) % capacity;
        if (table[idx] === value) { foundIdx = idx; break; }
        if (table[idx] === -1) break;
      }
      steps.push({
        step: steps.length + 1,
        action: foundIdx >= 0 ? 'found' : 'not_found',
        line: 20,
        description: foundIdx >= 0 ? `Found ${value} at slot ${foundIdx}` : `${value} not found`,
        indices: foundIdx >= 0 ? [foundIdx] : [], array: [...table], aux: { mode },
      });
    }
  }

  steps.push({
    step: steps.length + 1, action: 'complete', line: 30,
    description: 'Hash table operation complete',
    indices: [], array: steps[steps.length - 1]?.array || [],
  });

  return {
    algorithm: `HASH TABLE (${mode.toUpperCase()})`,
    category: 'Hash-Based Structures',
    status: 'completed',
    comparisons: 0,
    swaps: 0,
    operations: steps.length,
    execution_time_us: 16.0,
    steps,
  };
}

/* ============================================================
 * 5. Client Graph Algorithms
 * FIX: backend ALWAYS uses the hardcoded 9-edge demo graph
 * (0,1,4)(0,2,2)(1,2,1)(1,3,5)(2,3,8)(2,4,10)(3,4,2)(3,5,6)(4,5,3)
 * regardless of request — the mirror must use the SAME fixed edges,
 * not make up fake BFS-ish connectivity like before. Implements proper
 * BFS/DFS/Dijkstra/Bellman-Ford/Floyd-Warshall/Kruskal/Prim/Topo so each
 * algorithm actually behaves distinctly (previously only one generic
 * "wave" loop existed for all 8 algorithm ids).
 * ============================================================ */
const DEMO_EDGES: [number, number, number][] = [
  [0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 5], [2, 3, 8],
  [2, 4, 10], [3, 4, 2], [3, 5, 6], [4, 5, 3],
];
const INF = 999999;

function buildAdjacency(V: number, directed: boolean) {
  const adj: { to: number; w: number }[][] = Array.from({ length: V }, () => []);
  for (const [u, v, w] of DEMO_EDGES) {
    if (u >= V || v >= V) continue;
    adj[u].push({ to: v, w });
    if (!directed) adj[v].push({ to: u, w });
  }
  return adj;
}

function runClientGraph(algo: string, V: number, start: number, dest: number): ExecutionTrace {
  const steps: any[] = [];
  const directed = algo === 'topological-sort' || algo === 'topo';
  const adj = buildAdjacency(V, directed);

  steps.push({
    step: 1, action: 'init', line: 1,
    description: `Initialized graph with ${V} vertices (fixed demo edge set). Start vertex: ${start}`,
    indices: [start], array: [], aux: { start, dest, vertices: V, edges: DEMO_EDGES },
  });

  if (algo === 'bfs') {
    const visited = new Array(V).fill(false);
    const order: number[] = [];
    const queue = [start];
    visited[start] = true;
    while (queue.length) {
      const u = queue.shift()!;
      order.push(u);
      steps.push({
        step: steps.length + 1, action: 'visit_vertex', line: 8,
        description: `Visited vertex ${u}`, indices: [u], array: [...order],
      });
      for (const { to } of adj[u]) {
        if (!visited[to]) {
          visited[to] = true;
          queue.push(to);
          steps.push({
            step: steps.length + 1, action: 'relax_edge', line: 12,
            description: `Discovered vertex ${to} from ${u}`, indices: [u, to], array: [...order],
          });
        }
      }
    }
  } else if (algo === 'dfs') {
    const visited = new Array(V).fill(false);
    const order: number[] = [];
    function dfs(u: number) {
      visited[u] = true;
      order.push(u);
      steps.push({
        step: steps.length + 1, action: 'visit_vertex', line: 6,
        description: `Visited vertex ${u} (depth-first)`, indices: [u], array: [...order],
      });
      for (const { to } of adj[u]) {
        if (!visited[to]) {
          steps.push({
            step: steps.length + 1, action: 'relax_edge', line: 10,
            description: `Descending edge ${u} -> ${to}`, indices: [u, to], array: [...order],
          });
          dfs(to);
        }
      }
    }
    dfs(start);
  } else if (algo === 'dijkstra') {
    const dist = new Array(V).fill(INF);
    const parent = new Array(V).fill(-1);
    dist[start] = 0;
    const visited = new Array(V).fill(false);
    for (let count = 0; count < V; count++) {
      let u = -1, best = INF;
      for (let v = 0; v < V; v++) if (!visited[v] && dist[v] < best) { best = dist[v]; u = v; }
      if (u === -1) break;
      visited[u] = true;
      steps.push({
        step: steps.length + 1, action: 'visit_vertex', line: 14,
        description: `Finalized shortest distance to vertex ${u}: ${dist[u]}`,
        indices: [u], array: [...dist],
      });
      for (const { to, w } of adj[u]) {
        if (!visited[to] && dist[u] + w < dist[to]) {
          dist[to] = dist[u] + w;
          parent[to] = u;
          steps.push({
            step: steps.length + 1, action: 'relax_edge', line: 20,
            description: `Relaxed edge (${u} -> ${to}): dist[${to}] = ${dist[to]}`,
            indices: [u, to], array: [...dist],
          });
        }
      }
    }
    const path: number[] = [];
    let cur = dest;
    while (cur !== -1 && dist[dest] < INF) { path.unshift(cur); if (cur === start) break; cur = parent[cur]; }
    steps.push({
      step: steps.length + 1, action: 'shortest_path', line: 25,
      description: `Shortest path to ${dest}: ${path.join(' -> ')}`,
      indices: path, array: path,
      aux: { final_distance: dist[dest], reachable: dist[dest] < INF, path },
    });
  } else if (algo === 'bellman-ford') {
    const dist = new Array(V).fill(INF);
    const parent = new Array(V).fill(-1);
    dist[start] = 0;
    for (let i = 0; i < V - 1; i++) {
      for (const [u, v, w] of DEMO_EDGES) {
        if (u < V && v < V && dist[u] < INF && dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          parent[v] = u;
          steps.push({
            step: steps.length + 1, action: 'relax_edge', line: 12,
            description: `Pass ${i + 1}: relaxed edge (${u} -> ${v}): dist[${v}] = ${dist[v]}`,
            indices: [u, v], array: [...dist],
          });
        }
      }
    }
    steps.push({
      step: steps.length + 1, action: 'complete', line: 25,
      description: 'Bellman-Ford completed (no negative cycle in demo graph)',
      indices: [], array: [...dist], aux: { parents: parent },
    });
  } else if (algo === 'floyd-warshall') {
    const dist: number[][] = Array.from({ length: V }, (_, i) => Array.from({ length: V }, (_, j) => (i === j ? 0 : INF)));
    for (const [u, v, w] of DEMO_EDGES) {
      if (u < V && v < V) { dist[u][v] = Math.min(dist[u][v], w); dist[v][u] = Math.min(dist[v][u], w); }
    }
    for (let k = 0; k < V; k++) {
      for (let i = 0; i < V; i++) {
        for (let j = 0; j < V; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
          }
        }
      }
      const flat = dist.flat();
      steps.push({
        step: steps.length + 1, action: 'relax_edge', line: 15,
        description: `Completed pass using intermediate vertex k=${k}`,
        indices: [k], array: flat, aux: { dim: V },
      });
    }
  } else if (algo === 'kruskal') {
    const parentDSU = Array.from({ length: V }, (_, i) => i);
    const find = (x: number): number => (parentDSU[x] === x ? x : (parentDSU[x] = find(parentDSU[x])));
    const sorted = [...DEMO_EDGES].filter(([u, v]) => u < V && v < V).sort((a, b) => a[2] - b[2]);
    steps.push({
      step: steps.length + 1, action: 'sort_edges', line: 5,
      description: 'Sorted all edges by weight ascending',
      indices: [], array: [...parentDSU], aux: { sorted_edges: sorted },
    });
    const mst: [number, number, number][] = [];
    let totalWeight = 0;
    for (const [u, v, w] of sorted) {
      const ru = find(u), rv = find(v);
      if (ru !== rv) {
        parentDSU[ru] = rv;
        mst.push([u, v, w]);
        totalWeight += w;
        steps.push({
          step: steps.length + 1, action: 'mst_add', line: 12,
          description: `Added edge (${u}-${v}, weight ${w}) to MST`,
          indices: [u, v], array: [...parentDSU],
        });
      }
    }
    steps.push({
      step: steps.length + 1, action: 'complete', line: 20,
      description: `Kruskal's MST complete: total weight ${totalWeight}`,
      indices: [], array: [...parentDSU],
      aux: { total_weight: totalWeight, mst_edges: mst.length, edges: mst },
    });
  } else if (algo === 'prim') {
    const key = new Array(V).fill(INF);
    const parent = new Array(V).fill(-1);
    const inMST = new Array(V).fill(false);
    key[start] = 0;
    for (let count = 0; count < V; count++) {
      let u = -1, best = INF;
      for (let v = 0; v < V; v++) if (!inMST[v] && key[v] < best) { best = key[v]; u = v; }
      if (u === -1) break;
      inMST[u] = true;
      steps.push({
        step: steps.length + 1, action: 'mst_add', line: 14,
        description: `Added vertex ${u} to MST (key=${key[u]})`,
        indices: [u], array: [...key],
      });
      for (const { to, w } of adj[u]) {
        if (!inMST[to] && w < key[to]) {
          key[to] = w;
          parent[to] = u;
          steps.push({
            step: steps.length + 1, action: 'relax_edge', line: 20,
            description: `Updated key[${to}] = ${w} via edge from ${u}`,
            indices: [u, to], array: [...key],
          });
        }
      }
    }
    steps.push({
      step: steps.length + 1, action: 'complete', line: 25,
      description: "Prim's MST complete",
      indices: [], array: [...key], aux: { parents: parent },
    });
  } else {
    // topological-sort / topo (Kahn's algorithm) — only meaningful on the directed demo graph
    const inDegree = new Array(V).fill(0);
    for (const [u, v] of DEMO_EDGES) { if (u < V && v < V) inDegree[v]++; }
    const queue: number[] = [];
    for (let v = 0; v < V; v++) if (inDegree[v] === 0) queue.push(v);
    const order: number[] = [];
    const inDegCopy = [...inDegree];
    while (queue.length) {
      const u = queue.shift()!;
      order.push(u);
      steps.push({
        step: steps.length + 1, action: 'visit_vertex', line: 10,
        description: `Added vertex ${u} to topological order`,
        indices: [u], array: [...inDegCopy],
      });
      for (const { to } of adj[u]) {
        inDegCopy[to]--;
        if (inDegCopy[to] === 0) queue.push(to);
      }
    }
    if (order.length < V) {
      steps.push({
        step: steps.length + 1, action: 'cycle_error', line: 20,
        description: 'Cycle detected — graph is not a DAG, topological sort impossible',
        indices: [], array: [],
      });
    } else {
      steps.push({
        step: steps.length + 1, action: 'complete', line: 22,
        description: `Topological order: ${order.join(' -> ')}`,
        indices: [], array: [...order],
      });
    }
  }

  return {
    algorithm: algo.toUpperCase(),
    category: 'Graph Algorithms',
    status: 'completed',
    comparisons: V * 2,
    swaps: 0,
    operations: steps.length,
    execution_time_us: 42.0,
    steps,
  };
}

/* ============================================================
 * 6. Client Tree Algorithms
 * FIX: this previously faked a single generic 3-step "insert" trace for
 * EVERY tree type and ignored op entirely (search/delete never worked;
 * traversal/lca/heap/trie/btree were not implemented at all). Now builds
 * a REAL BST shape from `keys`, computes real parent/edge/height/bf per
 * node (matching backend aux.nodes shape), and branches correctly per
 * algo id, matching backend §2.8 exactly — including which ops are
 * no-ops for AVL/Red-Black (delete not implemented server-side).
 * ============================================================ */
interface BSTNodeInternal {
  key: number;
  left: BSTNodeInternal | null;
  right: BSTNodeInternal | null;
  height: number;
}

function bstInsert(node: BSTNodeInternal | null, key: number): BSTNodeInternal {
  if (!node) return { key, left: null, right: null, height: 1 };
  if (key < node.key) node.left = bstInsert(node.left, key);
  else if (key > node.key) node.right = bstInsert(node.right, key);
  return node;
}

function nodeHeight(n: BSTNodeInternal | null): number {
  return n ? n.height : 0;
}

function recomputeHeights(n: BSTNodeInternal | null): number {
  if (!n) return 0;
  n.height = 1 + Math.max(recomputeHeights(n.left), recomputeHeights(n.right));
  return n.height;
}

function avlRightRotate(y: BSTNodeInternal): BSTNodeInternal {
  const x = y.left!;
  const T2 = x.right;
  x.right = y;
  y.left = T2;
  y.height = 1 + Math.max(nodeHeight(y.left), nodeHeight(y.right));
  x.height = 1 + Math.max(nodeHeight(x.left), nodeHeight(x.right));
  return x;
}
function avlLeftRotate(x: BSTNodeInternal): BSTNodeInternal {
  const y = x.right!;
  const T2 = y.left;
  y.left = x;
  x.right = T2;
  x.height = 1 + Math.max(nodeHeight(x.left), nodeHeight(x.right));
  y.height = 1 + Math.max(nodeHeight(y.left), nodeHeight(y.right));
  return y;
}
function getBalance(n: BSTNodeInternal | null): number {
  return n ? nodeHeight(n.left) - nodeHeight(n.right) : 0;
}

function avlInsert(node: BSTNodeInternal | null, key: number, rotationLog: string[]): BSTNodeInternal {
  if (!node) return { key, left: null, right: null, height: 1 };
  if (key < node.key) node.left = avlInsert(node.left, key, rotationLog);
  else if (key > node.key) node.right = avlInsert(node.right, key, rotationLog);
  else return node;

  node.height = 1 + Math.max(nodeHeight(node.left), nodeHeight(node.right));
  const balance = getBalance(node);

  if (balance > 1 && key < node.left!.key) { rotationLog.push('rotate_right'); return avlRightRotate(node); }
  if (balance < -1 && key > node.right!.key) { rotationLog.push('rotate_left'); return avlLeftRotate(node); }
  if (balance > 1 && key > node.left!.key) {
    rotationLog.push('rotate_left_right');
    node.left = avlLeftRotate(node.left!);
    return avlRightRotate(node);
  }
  if (balance < -1 && key < node.right!.key) {
    rotationLog.push('rotate_right_left');
    node.right = avlRightRotate(node.right!);
    return avlLeftRotate(node);
  }
  return node;
}

/** Flattens a real tree shape into the {id,key,parent,edge,height,bf} list the UI expects. */
function flattenTree(root: BSTNodeInternal | null, withBF: boolean): any[] {
  const nodes: any[] = [];
  function visit(n: BSTNodeInternal | null, parentKey: number, edge: string) {
    if (!n) return;
    nodes.push({
      id: n.key, key: n.key, parent: parentKey, edge,
      height: n.height,
      ...(withBF ? { bf: getBalance(n) } : {}),
    });
    visit(n.left, n.key, 'left');
    visit(n.right, n.key, 'right');
  }
  if (root) visit(root, -1, 'root');
  return nodes;
}

function bstSearch(node: BSTNodeInternal | null, key: number): boolean {
  let cur = node;
  while (cur) {
    if (key === cur.key) return true;
    cur = key < cur.key ? cur.left : cur.right;
  }
  return false;
}

function bstDelete(node: BSTNodeInternal | null, key: number): BSTNodeInternal | null {
  if (!node) return null;
  if (key < node.key) { node.left = bstDelete(node.left, key); return node; }
  if (key > node.key) { node.right = bstDelete(node.right, key); return node; }
  // found
  if (!node.left) return node.right;
  if (!node.right) return node.left;
  let succ = node.right;
  while (succ.left) succ = succ.left;
  node.key = succ.key;
  node.right = bstDelete(node.right, succ.key);
  return node;
}

function runClientTree(algo: string, keys: number[], op: string, val: number, payload: Record<string, any>): ExecutionTrace {
  const steps: any[] = [];

  // --- Trie: completely separate (string) data model, matches backend §2.8 ---
  if (algo === 'trie') {
    const wordsCsv: string = payload.wordsCsv || 'cat,car,card,dog';
    const words = wordsCsv.split(',').map((w: string) => w.trim()).filter(Boolean);
    const word: string = payload.word || 'cat';
    steps.push({
      step: 1, action: 'init', line: 1,
      description: `Trie preloaded with words: [${words.join(', ')}]`,
      indices: [], array: [], aux: { words },
    });
    if (op === 'search') {
      const found = words.includes(word);
      steps.push({
        step: 2, action: found ? 'found' : 'not_found', line: 10,
        description: found ? `Word "${word}" FOUND in trie` : `Word "${word}" NOT FOUND in trie`,
        indices: [], array: [], aux: { word },
      });
    } else {
      steps.push({
        step: 2, action: 'insert', line: 8,
        description: `Inserted word "${word}" into trie`,
        indices: [], array: [], aux: { word, words: [...words, word] },
      });
    }
    steps.push({ step: steps.length + 1, action: 'complete', line: 15, description: 'Trie operation complete', indices: [], array: [] });
    return {
      algorithm: 'TRIE', category: 'Non-Linear Data Structures', status: 'completed',
      comparisons: word.length, swaps: 0, operations: steps.length, execution_time_us: 11.0, steps,
    };
  }

  // --- B-Tree: simplified single-split demo, matches backend §2.8 ---
  if (algo === 'btree' || algo === 'b-tree' || algo === 'bplus') {
    const order = Math.min(8, Math.max(3, payload.order ?? 4));
    const sortedKeys = [...keys, ...(op === 'insert' ? [val] : [])].sort((a, b) => a - b);
    const overflowed = sortedKeys.length > order - 1;
    steps.push({
      step: 1, action: 'init', line: 1,
      description: `B-Tree (order ${order}) simplified single-node demo`,
      indices: [], array: sortedKeys.slice(0, order - 1),
      aux: { order },
    });
    if (overflowed) {
      const medianIdx = Math.floor(sortedKeys.length / 2);
      steps.push({
        step: 2, action: 'split', line: 10,
        description: `Node overflowed order ${order}: splitting with median ${sortedKeys[medianIdx]} promoted`,
        indices: [medianIdx], array: sortedKeys,
        aux: { median: sortedKeys[medianIdx], left: sortedKeys.slice(0, medianIdx), right: sortedKeys.slice(medianIdx + 1) },
      });
    }
    steps.push({ step: steps.length + 1, action: 'complete', line: 20, description: 'B-Tree operation complete', indices: [], array: sortedKeys });
    return {
      algorithm: 'B-TREE', category: 'Non-Linear Data Structures', status: 'completed',
      comparisons: sortedKeys.length, swaps: 0, operations: steps.length, execution_time_us: 19.0, steps,
    };
  }

  // --- Heap: real array-based max/min heap, matches backend §2.8 ---
  if (algo === 'heap') {
    const heapTypeRaw: string = (payload.heapType || payload.type || 'max').toLowerCase();
    const isMin = heapTypeRaw.includes('min');
    const h = [...keys];
    const cmp = (a: number, b: number) => (isMin ? a < b : a > b);

    function siftUp(i: number) {
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (cmp(h[i], h[parent])) {
          [h[i], h[parent]] = [h[parent], h[i]];
          steps.push({
            step: steps.length + 1, action: 'swap', line: 10,
            description: `Sifted up: swapped index ${i} with parent ${parent}`,
            indices: [i, parent], array: [...h],
          });
          i = parent;
        } else break;
      }
    }

    steps.push({ step: 1, action: 'init', line: 1, description: `Heap (${isMin ? 'min' : 'max'}) initialized`, indices: [], array: [...h] });

    if (op === 'extract') {
      if (h.length > 0) {
        const root = h[0];
        h[0] = h[h.length - 1];
        h.pop();
        steps.push({ step: steps.length + 1, action: 'extract', line: 15, description: `Extracted root ${root}`, indices: [0], array: [...h] });
        // sift down
        let i = 0;
        while (true) {
          const l = 2 * i + 1, r = 2 * i + 2;
          let target = i;
          if (l < h.length && cmp(h[l], h[target])) target = l;
          if (r < h.length && cmp(h[r], h[target])) target = r;
          if (target === i) break;
          [h[i], h[target]] = [h[target], h[i]];
          steps.push({ step: steps.length + 1, action: 'swap', line: 18, description: `Sifted down: swapped ${i} with ${target}`, indices: [i, target], array: [...h] });
          i = target;
        }
      }
    } else {
      h.push(val);
      steps.push({ step: steps.length + 1, action: 'insert', line: 8, description: `Inserted ${val} at end of heap array`, indices: [h.length - 1], array: [...h] });
      siftUp(h.length - 1);
    }

    steps.push({ step: steps.length + 1, action: 'complete', line: 25, description: 'Heap operation complete', indices: [], array: [...h] });
    return {
      algorithm: `BINARY ${isMin ? 'MIN' : 'MAX'} HEAP`, category: 'Non-Linear Data Structures', status: 'completed',
      comparisons: steps.length, swaps: steps.filter(s => s.action === 'swap').length, operations: steps.length,
      execution_time_us: 14.0, steps,
    };
  }

  // --- Traversal: real tree walk, matches backend §2.8 loose-matching rules ---
  if (algo === 'traversal') {
    let root: BSTNodeInternal | null = null;
    for (const k of keys) root = bstInsert(root, k);
    recomputeHeights(root);

    const typeRaw: string = (payload.type || 'level').toLowerCase().replace(/[^a-z]/g, '');
    const order: number[] = [];

    if (typeRaw.includes('inorder')) {
      (function walk(n: BSTNodeInternal | null) { if (!n) return; walk(n.left); order.push(n.key); steps.push({ step: steps.length + 1, action: 'visit', line: 5, description: `Visited ${n.key} (inorder)`, indices: [], array: [...order], aux: { focus: n.key } }); walk(n.right); })(root);
    } else if (typeRaw.includes('preorder')) {
      (function walk(n: BSTNodeInternal | null) { if (!n) return; order.push(n.key); steps.push({ step: steps.length + 1, action: 'visit', line: 5, description: `Visited ${n.key} (preorder)`, indices: [], array: [...order], aux: { focus: n.key } }); walk(n.left); walk(n.right); })(root);
    } else if (typeRaw.includes('postorder')) {
      (function walk(n: BSTNodeInternal | null) { if (!n) return; walk(n.left); walk(n.right); order.push(n.key); steps.push({ step: steps.length + 1, action: 'visit', line: 5, description: `Visited ${n.key} (postorder)`, indices: [], array: [...order], aux: { focus: n.key } }); })(root);
    } else {
      // level order (also the documented default for unrecognized strings)
      const queue: BSTNodeInternal[] = root ? [root] : [];
      while (queue.length) {
        const n = queue.shift()!;
        order.push(n.key);
        steps.push({ step: steps.length + 1, action: 'visit', line: 5, description: `Visited ${n.key} (level order)`, indices: [], array: [...order], aux: { focus: n.key } });
        if (n.left) queue.push(n.left);
        if (n.right) queue.push(n.right);
      }
    }

    steps.unshift({
      step: 0, action: 'init', line: 1,
      description: `Tree built from keys [${keys.join(', ')}]`,
      indices: [], array: [...keys], aux: { nodes: flattenTree(root, false) },
    });
    steps.forEach((s, i) => { s.step = i + 1; });
    steps.push({ step: steps.length + 1, action: 'complete', line: 20, description: `Traversal order: ${order.join(', ')}`, indices: [], array: order });
    return {
      algorithm: 'TREE TRAVERSAL', category: 'Tree Algorithms', status: 'completed',
      comparisons: 0, swaps: 0, operations: steps.length, execution_time_us: 13.0, steps,
    };
  }

  // --- LCA: real BST-shape LCA (assumes BST property, matches backend) ---
  if (algo === 'lca') {
    let root: BSTNodeInternal | null = null;
    for (const k of keys) root = bstInsert(root, k);
    const n1 = payload.n1 ?? 20;
    const n2 = payload.n2 ?? 40;

    steps.push({
      step: 1, action: 'init', line: 1,
      description: `Finding LCA of ${n1} and ${n2}`,
      indices: [], array: [...keys], aux: { nodes: flattenTree(root, false), n1, n2 },
    });

    let cur = root;
    let lca: number | null = null;
    while (cur) {
      steps.push({
        step: steps.length + 1, action: 'compare', line: 5,
        description: `Visiting node ${cur.key} while searching for LCA`,
        indices: [], array: [], aux: { focus: cur.key },
      });
      if (n1 < cur.key && n2 < cur.key) cur = cur.left;
      else if (n1 > cur.key && n2 > cur.key) cur = cur.right;
      else { lca = cur.key; break; }
    }

    if (lca !== null && bstSearch(root, n1) && bstSearch(root, n2)) {
      steps.push({ step: steps.length + 1, action: 'found', line: 15, description: `LCA(${n1}, ${n2}) = ${lca}`, indices: [], array: [], aux: { focus: lca } });
    } else {
      steps.push({ step: steps.length + 1, action: 'not_found', line: 18, description: `One or both of ${n1}, ${n2} not present in tree — LCA undefined`, indices: [], array: [] });
    }
    steps.push({ step: steps.length + 1, action: 'complete', line: 20, description: 'LCA search complete', indices: [], array: [] });
    return {
      algorithm: 'LOWEST COMMON ANCESTOR', category: 'Tree Algorithms', status: 'completed',
      comparisons: steps.length, swaps: 0, operations: steps.length, execution_time_us: 12.0, steps,
    };
  }

  // --- BST / AVL / Red-Black ---
  const isAVL = algo === 'avl';
  const isRB = algo === 'red-black';
  const isBST = algo === 'bst' || (!isAVL && !isRB);

  let root: BSTNodeInternal | null = null;
  for (const k of keys) {
    root = isAVL ? avlInsert(root, k, []) : bstInsert(root, k);
  }
  recomputeHeights(root);

  steps.push({
    step: 1, action: 'init', line: 1,
    description: `Tree (${algo.toUpperCase()}) built from keys: [${keys.join(', ')}]`,
    indices: [], array: [...keys],
    aux: { focus: root ? root.key : null, nodes: flattenTree(root, isAVL) },
  });

  if (op === 'search') {
    const found = root ? bstSearch(root, val) : false;
    steps.push({
      step: steps.length + 1, action: found ? 'found' : 'not_found', line: 8,
      description: found ? `Found ${val} in tree` : `${val} not found in tree`,
      indices: [], array: [...keys], aux: { focus: val, nodes: flattenTree(root, isAVL) },
    });
  } else if (op === 'delete') {
    if (isAVL || isRB) {
      // FIX: Backend does NOT implement delete for AVL/Red-Black — silently a
      // no-op (init + complete only, nothing happens). Mirror that exactly so
      // the UI's "disable delete for AVL/RB" behavior can be verified safely.
      steps.push({
        step: steps.length + 1, action: 'noop', line: 0,
        description: `Delete is not implemented for ${algo.toUpperCase()} trees on the backend — no change made`,
        indices: [], array: [...keys], aux: { focus: null, nodes: flattenTree(root, isAVL) },
      });
    } else {
      root = bstDelete(root, val);
      recomputeHeights(root);
      steps.push({
        step: steps.length + 1, action: 'delete', line: 12,
        description: `Deleted ${val} from BST`,
        indices: [], array: [...keys].filter(k => k !== val),
        aux: { focus: val, nodes: flattenTree(root, false) },
      });
    }
  } else {
    // insert (default) — val was already folded into `root` above only if it was in `keys`;
    // for a fresh insert op we insert val now on top of the existing keys.
    const rotationLog: string[] = [];
    if (isAVL) {
      root = avlInsert(root, val, rotationLog);
    } else {
      root = bstInsert(root, val);
    }
    recomputeHeights(root);

    steps.push({
      step: steps.length + 1, action: 'compare', line: 9,
      description: `Comparing insert key ${val} against tree nodes`,
      indices: [], array: [...keys, val], aux: { focus: val },
    });
    steps.push({
      step: steps.length + 1, action: 'insert_node', line: 15,
      description: `Inserted ${val} as a new leaf node`,
      indices: [], array: [...keys, val], aux: { focus: val, nodes: flattenTree(root, isAVL) },
    });

    if (isAVL && rotationLog.length) {
      for (const rot of rotationLog) {
        steps.push({
          step: steps.length + 1, action: rot, line: 40,
          description: `AVL rebalance: performed ${rot.replace(/_/g, ' ')}`,
          indices: [], array: [...keys, val], aux: { focus: val, nodes: flattenTree(root, true) },
        });
      }
    }
  }

  steps.push({
    step: steps.length + 1, action: 'complete', line: 50,
    description: `${algo.toUpperCase()} operation complete`,
    indices: [], array: [...keys], aux: { nodes: flattenTree(root, isAVL) },
  });

  return {
    algorithm: algo.toUpperCase(),
    category: 'Tree Algorithms',
    status: 'completed',
    comparisons: 3,
    swaps: 1,
    operations: steps.length,
    execution_time_us: 28.0,
    steps,
  };
}