# Data Structure Visualizer & Analyzer (DSVA)
## Complete Architectural Guide & File-by-File Code Explanation

---

## 1. Executive Summary & System Architecture

The **Data Structure Visualizer & Analyzer (DSVA)** is an interactive computer science laboratory and software platform. Its core design philosophy is:
> **C is the single source of truth for all data structure operations, algorithmic transformations, and computational metrics.**

JavaScript and TypeScript do **not** emulate or fabricate algorithm logic. Instead, the native **C11 backend** executes the algorithms, tracks memory pointers and comparisons, and serializes each step into a structured **JSON Execution Event Trace**. The **React 18 + TypeScript** frontend consumes these events, translating them into fluid, physics-based animations (via Framer Motion), interactive SVG graph/tree diagrams, and synchronized line-highlighted C code in the **Monaco Editor**.

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 + TypeScript UI                        │
│   • Views (Dashboard, Sorting, Searching, Graphs, Trees, Complexity)   │
│   • Monaco Editor with live C line synchronization                     │
│   • Recharts Performance Curves & Asymptotic Big-O Classes             │
│   • Universal Animation Player Hook (Play, Pause, Step, Scrub, Speed)  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
               JSON Execution Event Protocol (/api/*)
              { algorithm, steps: [ { action, line, array, ... } ] }
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                          C11 Native Core                               │
│   • Sockets HTTP REST Server (Winsock2 on Windows / POSIX on Linux)    │
│   • Microsecond Timing via QueryPerformanceCounter / clock_gettime     │
│   • Dynamic Heap Pointer Tracker (malloc/free simulation)              │
│   • Modular Libraries: sorting, searching, linear_ds, tree_ds, graph  │
│   • 25 Unit-Tested Modules verifying edge cases                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The JSON Execution Event Protocol

Every algorithm in C accepts an input dataset and returns an `ExecutionTrace*` pointer. This trace contains high-level metrics (comparisons count, swaps count, operations count, and runtime in microseconds $\mu\text{s}$) along with an array of sequential `EventStep` objects.

```json
{
  "algorithm": "Quick Sort",
  "category": "Sorting",
  "status": "completed",
  "comparisons": 15,
  "swaps": 9,
  "operations": 36,
  "execution_time_us": 108.90,
  "steps": [
    {
      "step": 1,
      "action": "pivot",
      "line": 4,
      "description": "Selected pivot 25 at index 7",
      "indices": [7],
      "array": [29, 10, 14, 37, 13, 42, 18, 25],
      "aux": null
    },
    {
      "step": 2,
      "action": "compare",
      "line": 8,
      "description": "Comparing array[0]=29 with pivot 25",
      "indices": [0, 7],
      "array": [29, 10, 14, 37, 13, 42, 18, 25],
      "aux": null
    },
    {
      "step": 3,
      "action": "swap",
      "line": 12,
      "description": "Swapping array[0] and array[1] to partition smaller elements",
      "indices": [0, 1],
      "array": [10, 29, 14, 37, 13, 42, 18, 25],
      "aux": null
    }
  ]
}
```

### Action Types Recognized by the Visualizer
- `init`: Captures the initial unsorted/unvisited state.
- `compare`: Two elements or bounds are being evaluated against each other.
- `swap` / `shift`: In-place transposition or gap shifting of values.
- `overwrite`: Direct placement (e.g., merge phase in Merge Sort or bucket collection).
- `mark_sorted`: Element is settled in its permanent, final position.
- `allocate`: Simulated heap memory allocation (`malloc(sizeof(Node))`).
- `pointer_assign`: Rewiring `next`, `prev`, or child pointers.
- `free_memory`: Deallocation of a deleted node (`free(target)`).
- `rotate_left` / `rotate_right`: AVL tree balancing rotations.
- `visit_vertex` / `relax_edge`: Graph traversal and edge cost improvement.
- `found` / `not_found`: Termination criteria for search operations.

---

## 3. Backend Source Files & In-Depth Explanation

### 3.1. `backend/include/common.h`
- **Purpose**: Defines shared data structures, dynamic buffer utilities, event logging types, and timing primitives used across all C modules.
- **Key Structs**:
  - `StringBuilder`: A dynamic, auto-growing character buffer (`data`, `capacity`, `length`) used to construct valid JSON strings in memory without buffer overflow vulnerabilities.
  - `EventStep`: Represents a single atomic execution step with fields:
    - `step`: 1-based sequential step identifier.
    - `action`: String identifying the operation (e.g., `"compare"`, `"swap"`).
    - `description`: Human-readable explanation of the step.
    - `line_number`: Corresponding line in the C source implementation.
    - `indices[8]`: Array of active indices undergoing comparison or modification.
    - `array_state`: Snapshot of the memory/array at this exact instant.
    - `aux_json`: Additional metadata string (JSON object) for graph edges, tree balance factors, or search pointers.
  - `ExecutionTrace`: Encapsulates the entire lifecycle of an algorithm run, containing the steps array, comparison tally, swap tally, total operations, and elapsed microseconds.
- **Key Functions**:
  - `sb_create()`, `sb_append()`, `sb_append_format()`, `sb_finish()`, `sb_free()`: String builder lifecycle methods.
  - `trace_create()`, `trace_add_step()`, `trace_free()`, `trace_to_json()`: Trace lifecycle and JSON serialization.
  - `get_time_us()`: High-resolution hardware timer (`QueryPerformanceCounter` on Windows, `clock_gettime(CLOCK_MONOTONIC)` on POSIX).

---

### 3.2. `backend/src/common.c`
- **Purpose**: Implements the memory management and string serialization declared in `common.h`.
- **Key Details**:
  - `sb_append` automatically doubles the buffer capacity (`new_cap = capacity * 2 + len + 1024`) when new content exceeds capacity.
  - `trace_to_json` performs proper JSON string escaping (handles quotes, backslashes, and line breaks) and outputs formatted JSON compliant with RFC 8259.
  - `get_time_us` uses Windows `QueryPerformanceFrequency` and `QueryPerformanceCounter` to measure execution durations with sub-microsecond precision.

---

### 3.3. `backend/include/sorting.h` & `backend/src/algorithms/sorting.c`
- **Purpose**: Declares and implements all 10 sorting algorithms in standard C11.
- **Implemented Algorithms**:
  1. **Bubble Sort (`run_bubble_sort`)**: Iterates through adjacent elements. Flags `swapped` to enable early termination on already-sorted arrays ($O(n)$ best case). Emits `compare`, `swap`, and `mark_sorted` events.
  2. **Selection Sort (`run_selection_sort`)**: Scans the unsorted suffix to locate the minimum element index (`min_idx`), then performs at most 1 swap per outer loop pass.
  3. **Insertion Sort (`run_insertion_sort`)**: Picks element `key = arr[i]`, compares backwards, shifts greater elements right with `shift` events, and places `key` with `insert`.
  4. **Merge Sort (`run_merge_sort`)**: Recursive divide-and-conquer. `merge_sort_rec` splits at `mid = low + (high - low) / 2`. `merge` allocates dynamic left (`L`) and right (`R`) buffers, compares elements, and overwrites the primary array, generating `split`, `compare`, `overwrite`, and `merge` events.
  5. **Quick Sort (`run_quick_sort`)**: Lomuto partition scheme. Chooses `arr[high]` as the pivot, tracks boundary `i = low - 1`, swaps smaller elements into the lower partition, and places the pivot at index `i + 1`. Emits `pivot`, `compare`, and `swap` events.
  6. **Heap Sort (`run_heap_sort`)**: In-place heap sorting. First transforms the array into a max-heap in $O(n)$ time via bottom-up heapify (`heapify`). Then repeatedly swaps root `arr[0]` with `arr[i]`, locks `i` into sorted state, and sifts the new root down.
  7. **Counting Sort (`run_counting_sort`)**: Non-comparison sorting. Finds range `[min..max]`, calculates frequency histogram in `count[]`, computes prefix sums, and places items into `output[]`.
  8. **Radix Sort (`run_radix_sort`)**: Least Significant Digit (LSD) radix sort. Finds maximum value and executes digit-by-digit counting sort passes (`exp = 1, 10, 100, ...`).
  9. **Shell Sort (`run_shell_sort`)**: Diminishing increment sort using gap sequence `gap = size / 2; gap > 0; gap /= 2`. Performs gap-spaced insertion sort.
  10. **Bucket Sort (`run_bucket_sort`)**: Allocates 5 dynamic buckets, maps elements via normalization index `b_idx = (val - min) * (k - 1) / range`, sorts each bucket using insertion sort, and concatenates back.

---

### 3.4. `backend/include/searching.h` & `backend/src/algorithms/searching.c`
- **Purpose**: Declares and implements all 5 searching algorithms in standard C11.
- **Implemented Algorithms**:
  1. **Linear Search (`run_linear_search`)**: Scans sequentially from index 0 to $n-1$. Emits `compare`, `found`, or `not_found` with candidate indices.
  2. **Binary Search (`run_binary_search`)**: Requires sorted inputs. Maintains `low` and `high`. Calculates midpoint `mid = low + (high - low) / 2` to prevent 32-bit signed integer overflow. Emits `examine_mid`, `eliminate_left`, `eliminate_right`, and `found`.
  3. **Jump Search (`run_jump_search`)**: Advances in blocks of size $m = \lfloor\sqrt{n}\rfloor$. Once a block boundary exceeds the target, executes a bounded linear scan within $[prev..step]$.
  4. **Interpolation Search (`run_interpolation_search`)**: Designed for uniformly distributed sorted arrays. Computes probe position using linear slope formula:
     $$\text{pos} = \text{low} + \left[\frac{\text{target} - \text{arr}[\text{low}]}{\text{arr}[\text{high}] - \text{arr}[\text{low}]}\right] \times (\text{high} - \text{low})$$
     Yields $O(\log \log n)$ average time complexity.
  5. **Exponential Search (`run_exponential_search`)**: Identifies range bounds by exponentially doubling index $i = 1, 2, 4, 8, \dots$ until $\text{arr}[i] \ge \text{target}$, then performs binary search within $[i/2..\min(i, n-1)]$.

---

### 3.5. `backend/include/linear_ds.h` & `backend/src/data_structures/linear_ds.c`
- **Purpose**: Implements linear data structures with explicit pointer and memory address simulation.
- **Structures & Operations**:
  1. **Dynamic Array (`run_array_op`)**:
     - `insert`: Shifts all elements from index $n$ down to $pos$ to the right, then writes the new value.
     - `delete`: Shifts all elements from $pos+1$ to $n-1$ to the left, decrementing size.
     - `update` & `search`: Direct $O(1)$ index assignment and $O(n)$ traversal.
  2. **Singly Linked List (`run_singly_linked_list_op`)**:
     - Simulates heap addresses (e.g., `0x7FFE0010 + val * 16`).
     - Emits `allocate` event representing `Node *newNode = malloc(sizeof(Node))`.
     - Head insert: `newNode->next = head; head = newNode`.
     - Intermediate insert: Traverses to $pos-1$, rewires `newNode->next = prev->next; prev->next = newNode`.
     - Delete: Bypasses node with `prev->next = target->next` and deallocates with `free(target)`.
  3. **Doubly Linked List (`run_doubly_linked_list_op`)**:
     - Wires bidirectional links: `newNode->next = next; next->prev = newNode; newNode->prev = prev; prev->next = newNode`.
  4. **Circular Linked List (`run_circular_linked_list_op`)**:
     - Maintains tail pointer where `tail->next == head`. Detects cycle closure during traversal.
  5. **Stack (`run_stack_op`)**:
     - LIFO discipline.
     - `push`: Verifies overflow limit ($top \ge \text{capacity}-1$), increments $top$, and writes element.
     - `pop`: Verifies underflow ($top < 0$), reads $arr[top]$, and decrements $top$.
     - `peek`: Reads top element without modifying stack pointer.
  6. **Queue (`run_queue_op`)**:
     - FIFO discipline. Appends to `rear` on `enqueue` and removes from `front` on `dequeue`.
  7. **Circular Queue (`run_circular_queue_op`)**:
     - Ring buffer utilizing modulo arithmetic:
       $$\text{rear} = (\text{rear} + 1) \pmod{\text{capacity}}, \quad \text{front} = (\text{front} + 1) \pmod{\text{capacity}}$$
     - Prevents index drift without shifting elements.
  8. **Deque (`run_deque_op`)**:
     - Double-ended queue supporting `push_front`, `push_back`, `pop_front`, and `pop_back`.

---

### 3.6. `backend/include/tree_ds.h` & `backend/src/trees/tree_ds.c`
- **Purpose**: Implements non-linear data structures, binary search trees, self-balancing AVL trees, heaps, and tree algorithms.
- **Key Details**:
  - `BSTNode`: Struct containing `key`, `height`, `left`, and `right` pointers.
  - `tree_to_aux_json`: Recursively serializes the entire tree hierarchy into JSON format (`id`, `key`, `parent`, `edge`, `height`, `bf`), enabling SVG rendering on the frontend.
  - **AVL Tree Balancing & Rotations**:
    - Calculates Balance Factor: $\text{BF} = \text{height}(\text{left}) - \text{height}(\text{right})$.
    - **Right Rotation (LL Imbalance)**: Used when a node is added to the left child of a left subtree ($\text{BF} > 1, \text{key} < \text{left}\to\text{key}$).
    - **Left Rotation (RR Imbalance)**: Used when a node is added to the right child of a right subtree ($\text{BF} < -1, \text{key} > \text{right}\to\text{key}$).
    - **Left-Right Rotation (LR Imbalance)**: Left rotation on left child, followed by Right rotation on parent.
    - **Right-Left Rotation (RL Imbalance)**: Right rotation on right child, followed by Left rotation on parent.
  - **Tree Traversals**:
    - `inorder_rec`: Left $\to$ Root $\to$ Right (outputs BST keys in sorted ascending order).
    - `preorder_rec`: Root $\to$ Left $\to$ Right (used for serialization/cloning).
    - `postorder_rec`: Left $\to$ Right $\to$ Root (used for bottom-up node deallocation).
    - Level Order: Iterative queue-based Breadth First Search (BFS).
  - **Lowest Common Ancestor (`run_tree_lca`)**:
    - Walks down the BST: if both keys are smaller, move left; if both are larger, move right; otherwise, the current node is the LCA.
  - **Binary Heap (`run_heap_op`)**:
    - Implements Min-Heap and Max-Heap using flat array representations. Computes parent $(i-1)/2$, left child $2i+1$, right child $2i+2$. Implements `heapify_up` for insertion and `heapify_down` for root extraction.
  - **Trie (`run_trie_op`)**:
    - Prefix tree mapping character nodes from level 1 to $N$.
  - **B-Tree (`run_btree_op`)**:
    - Multi-key node structure simulating node splitting and median key promotion on overflow.

---

### 3.7. `backend/include/hash_table.h` & `backend/src/data_structures/hash_table.c`
- **Purpose**: Implements hash table structures and collision resolution strategies.
- **Key Details**:
  - Primary Hash Function: $h(k) = k \pmod{\text{table\_size}}$.
  - **Linear Probing**:
    $$h(k, i) = (h(k) + i) \pmod{\text{table\_size}}$$
    Steps sequentially through slots on collision.
  - **Quadratic Probing**:
    $$h(k, i) = (h(k) + i^2) \pmod{\text{table\_size}}$$
    Eliminates primary clustering by jumping parabolic offsets.
  - **Separate Chaining**:
    Simulates linked lists branching from each primary table bucket slot.

---

### 3.8. `backend/include/graph.h` & `backend/src/graph/graph.c`
- **Purpose**: Implements graph representations (adjacency matrix and edge lists) and 8 graph algorithms.
- **Key Structs**:
  - `GraphEdge`: Tuple `{u, v, weight}`.
  - `Graph`: Contains `num_vertices`, `num_edges`, adjacency matrix `adj_matrix[32][32]`, edge array, and `is_directed` flag.
- **Implemented Algorithms**:
  1. **Breadth First Search (BFS)**: Uses a FIFO queue to discover all reachable vertices in expanding concentric waves. Emits `visit_vertex` and `enqueue_neighbor`.
  2. **Depth First Search (DFS)**: Recursive stack exploration going deep along edges until reaching dead ends, then backtracking (`backtrack` event).
  3. **Dijkstra's Shortest Path**: Greedy algorithm with non-negative edge weights. Maintains tentative distance array `dist[]` initialized to $\infty$. Greedily selects vertex $u$ with minimum unvisited distance, marks it visited in `sptSet`, and relaxes adjacent edges:
     $$\text{dist}[v] = \min(\text{dist}[v], \, \text{dist}[u] + \text{weight}(u, v))$$
  4. **Bellman-Ford Algorithm**: Dynamic programming algorithm capable of handling negative weights. Relaxes all $|V|-1$ edges. Runs a $|V|$-th relaxation pass to detect negative-weight cycles (`negative_cycle` event).
  5. **Floyd-Warshall Algorithm**: Computes all-pairs shortest paths using 3 nested loops:
     $$\text{dist}[i][j] = \min(\text{dist}[i][j], \, \text{dist}[i][k] + \text{dist}[k][j])$$
  6. **Kruskal's Minimum Spanning Tree (MST)**: Sorts all edges in ascending order of weight. Utilizes Disjoint Set Union (DSU) with Path Compression (`find_set`) and Union by Rank (`union_set`). Adds edges that connect distinct components and rejects edges that form cycles.
  7. **Prim's Minimum Spanning Tree (MST)**: Grows a single spanning tree from a root vertex, greedily selecting the minimum-weight crossing edge connecting the cut to an unvisited vertex.
  8. **Topological Sort (Kahn's Algorithm)**: Computes in-degree for all vertices. Enqueues all vertices with in-degree 0 into a FIFO queue. Dequeues vertices, appends them to topological order, and decrements neighbors' in-degrees. If fewer than $|V|$ vertices are output, flags a cycle error (`cycle_error`).

---

### 3.9. `backend/include/analyzer.h` & `backend/src/analyzer/analyzer.c`
- **Purpose**: Empirically benchmarks algorithms and pairs measured execution metrics with theoretical Big-O complexity classes.
- **Key Functions**:
  - `analyzer_compare_sorting`: Accepts a list of algorithm names and an array pointer. Runs each algorithm on an identical copy of the dataset. Collects `comparisons`, `swaps`, `operations`, and `time_us`, producing comparative JSON output.
  - `analyzer_benchmark_scaling`: Generates random arrays of sizes $N \in [10, 50, 100, 200, 500, 1000]$ and runs comparative timing benchmarks to illustrate asymptotic divergence ($O(n \log n)$ vs. $O(n^2)$).

---

### 3.10. `backend/include/server.h`, `backend/src/server/router.c` & `backend/src/server/main.c`
- **Purpose**: Provides a zero-dependency C HTTP REST server and command-line execution interface.
- **`router.c`**:
  - Implements lightweight JSON parsing functions (`parse_int_value`, `parse_int_array`, `parse_string_value`).
  - Routes REST endpoints:
    - `GET /api/health`: Returns health status and engine version.
    - `GET /api/algorithms`: Returns full algorithms catalog.
    - `GET /api/data-structures`: Returns data structures catalog.
    - `POST /api/sorting/:algo`: Parses `{ "array": [...] }` and invokes C sorting routines.
    - `POST /api/searching/:algo`: Parses `{ "array": [...], "target": X }` and invokes C search routines.
    - `POST /api/data-structures/:type`: Parses `{ "initial": [...], "op": "...", "value": X }` and invokes linear/hash structures.
    - `POST /api/graph/:algo`: Parses graph nodes, edges, start, and destination vertices.
    - `POST /api/tree/:algo`: Parses tree keys and operations (BST, AVL, traversals).
    - `POST /api/analyzer/compare`: Runs multi-algorithm comparative benchmarks.
- **`main.c`**:
  - Initializes Winsock2 (`WSAStartup`) on Windows or POSIX sockets on Linux.
  - Binds and listens on port 8080 (or port specified via argv).
  - Handles HTTP request parsing, generates standard HTTP headers (`Content-Type: application/json`, `Access-Control-Allow-Origin: *`), and sends responses.
  - Supports `--cli` mode: `./dsva_server --cli /api/sorting/quick-sort '{"array": [5, 2, 8]}'` to execute directly without running a background server.

---

### 3.11. `backend/tests/test_runner.c`
- **Purpose**: Comprehensive C unit testing suite for automated validation.
- **Test Categories (25 Tests)**:
  - **Sorting Edge Cases**: Empty arrays ($N=0$), single elements ($N=1$), duplicates, reverse-sorted inputs across Bubble, Quick, Merge, Heap, Radix, Shell, Counting, and Bucket sort.
  - **Searching Edge Cases**: Target present vs. target absent across Binary, Jump, Interpolation, and Exponential search.
  - **Linear DS**: Stack push/pop underflow/overflow, Queue enqueue/dequeue, Linked List insertion and deletion.
  - **Trees & AVL**: AVL self-balancing after sequential insertion, BST inorder traversal ordering, Lowest Common Ancestor.
  - **Graphs**: BFS vertex discovery, DFS recursion, Dijkstra shortest path cost, Kruskal MST weight, Prim MST weight.
- **Result**: All 25 automated tests pass with 0 failures.

---

### 3.12. `backend/CMakeLists.txt`, `backend/Makefile`, and `backend/Dockerfile`
- **`CMakeLists.txt`**: Standard CMake build configuration linking `ws2_32` on Windows and `-lm` on Linux. Defines targets `dsva_server` and `dsva_tests`.
- **`Makefile`**: Clean GCC Makefile for compilation with `-Wall -Wextra -std=c11 -O2`.
- **`Dockerfile`**: Multi-stage Docker container. Stage 1 compiles the C backend using `gcc:12`; Stage 2 copies the stripped binary into `debian:bullseye-slim`, exposing port 8080.

---

## 4. Frontend Source Files & In-Depth Explanation

### 4.1. Core Configuration & HTML
- **`package.json`**: Defines dependencies: React 18, `@monaco-editor/react`, `framer-motion`, `lucide-react`, `recharts`, `canvas-confetti`, `tailwindcss`, `vite`, `typescript`.
- **`tsconfig.json`**: TypeScript compiler options: ES2020 target, bundler module resolution, React JSX transform, strict mode.
- **`vite.config.ts`**: Vite configuration with `@vitejs/plugin-react` and automated `/api` proxy forwarding to `http://127.0.0.1:8080`.
- **`tailwind.config.js`**: Custom dark developer theme: `brand` emerald accents, `editor` background colors (`#1e1e1e`), and typography configurations.
- **`postcss.config.js`**: PostCSS configuration for Tailwind CSS and Autoprefixer.
- **`index.html`**: HTML5 root file configuring Google Fonts (`JetBrains Mono`, `Inter`, `Fira Code`) and dark styling.
- **`src/index.css`**: Global stylesheet with Tailwind directives, sleek scrollbar rules, glassmorphism panel styles (`.glass-panel`, `.glass-card`), and glowing accents (`.glow-emerald`).
- **`src/main.tsx`**: React DOM root entry rendering `<App />` within `React.StrictMode`.

---

### 4.2. Engine & State Types
- **`src/engine/types.ts`**:
  - `NavSection`: Union type for 10 navigation views (`'dashboard'`, `'data_structures'`, `'algorithms'`, `'sorting'`, `'searching'`, `'graph'`, `'complexity'`, `'playground'`, `'learning'`, `'about'`).
  - `ExecutionStep`: Interface representing an execution event from the C backend.
  - `ExecutionTrace`: Full trace with status, comparisons count, swaps count, operations count, and execution time.
  - `AlgorithmMetric` & `ComparisonResult`: Structs for multi-algorithm benchmarking.
  - `LearningTopic` & `InterviewQuestion`: Comprehensive data structures for educational curriculum.
  - `GraphNode` & `GraphEdgeModel`: Types representing vertices and weighted edges.

---

### 4.3. API Bridge & Client-Side Execution Fallback
- **`src/engine/api.ts`**:
  - `executeAlgorithmApi(endpoint, payload)`: Attempts to fetch from the native C backend via HTTP (`/api/*`) with a 2.5-second timeout.
  - **Graceful Client-Side C-Mirror**: If the C backend server is offline or deployed as a static frontend, the system switches to an internal TypeScript engine that mirrors the exact logic and emits the identical JSON trace schema for all algorithms.
  - `compareAlgorithmsApi(algorithms, array)`: Fetches multi-algorithm benchmark data from the C backend or runs local multi-algorithm benchmarks.

---

### 4.4. Static Registry & Educational Syllabus
- **`src/engine/cSourceRegistry.ts`**:
  - Repository of production C11 source implementations for Monaco editor display.
  - Includes syntax-highlighted code, sample inputs, sample outputs, and architectural section explanations for Quick Sort, Merge Sort, Binary Search, Singly Linked List, AVL Tree, and Dijkstra.
- **`src/engine/learningContent.ts`**:
  - Textbook and interview documentation for data structures and algorithms.
  - Details real-world applications (Linux kernel, Git bisect, database indexing, GPS pathfinding), working principles, step-by-step algorithms, complexities (best, average, worst, space), pros/cons, and technical interview questions from Google, Meta, and Amazon.

---

### 4.5. Custom Hooks
- **`src/hooks/useAnimationPlayer.ts`**:
  - Universal execution player controlling step-by-step animations.
  - Provides: `play()`, `pause()`, `togglePlay()`, `stepForward()`, `stepBackward()`, `reset()`, `seek(stepIndex)`, `setSpeed(multiplier)`.
  - Dynamically calculates step delay based on speed: `intervalMs = Math.max(50, 600 / speed)`.
  - Automatically triggers celebratory confetti (`canvas-confetti`) when algorithm execution completes.
- **`src/hooks/useKeyboardShortcuts.ts`**:
  - Binds global keyboard hotkeys:
    - `Space`: Play/Pause.
    - `ArrowRight` / `L`: Step Forward.
    - `ArrowLeft` / `J`: Step Backward.
    - `R`: Reset to initial state.
    - `Ctrl+K` / `Cmd+K`: Open Quick Search Command Palette.
  - Ignores keypresses when the user is typing in input fields, textareas, or Monaco editor.

---

### 4.6. Common UI Components
- **`src/components/common/Navbar.tsx`**:
  - Top header displaying brand logo, C11 Core status badge, search bar trigger (`Ctrl+K`), live C backend connection health ping indicator, and quick links to the Playground and Learning syllabus.
- **`src/components/common/Sidebar.tsx`**:
  - Developer navigation sidebar listing all 10 core sections with badges (`18+`, `30+`, `Monaco`) and active view indicators.
- **`src/components/common/ControlPanel.tsx`**:
  - Playback control deck containing Play/Pause, Step Back, Step Forward, Reset, Speed multipliers ($0.5\times, 1\times, 2\times, 4\times$), scrub slider, and real-time C line number badge (`Line X`).
- **`src/components/common/SearchModal.tsx`**:
  - Search command palette indexing all 30+ algorithms and 18+ data structures with keyword fuzzy matching and keyboard arrow navigation.
- **`src/components/common/StatBadge.tsx`**:
  - Metric badge displaying comparisons, swaps, operations, and execution time with customizable color accents.

---

### 4.7. Code Components
- **`src/components/code/CodeViewer.tsx`**:
  - Integrates `@monaco-editor/react` with custom `dsva-dark` theme.
  - **Live Execution Line Highlighting**: Dynamically updates Monaco delta-decorations based on `player.currentStep.line`, highlighting the active line of C code and scrolling it into view.
  - Read-Only vs. Editable toggle, code copy button, `.c` file download button, fullscreen toggle, and drawer explaining key C code sections.

---

### 4.8. Visualizers
- **`src/components/visualizers/SortingVisualizer.tsx`**:
  - Animated bar chart where bar heights correspond to values and horizontal positions animate via Framer Motion layout springs.
  - Color-coded bar states: default (slate), comparing (amber), swapping (rose), pivot (purple), sorted (emerald).
  - Array generators: Random, Nearly Sorted, Reversed, Size Slider (6 to 32), and custom array input form.
  - Synchronized with the Monaco C CodeViewer.
- **`src/components/visualizers/SearchingVisualizer.tsx`**:
  - Visual memory cell track for Binary, Linear, Jump, Interpolation, and Exponential search.
  - Pointer badges: `LOW`, `MID`, `HIGH`, `TARGET`.
  - Visually grays out and strikes through eliminated search ranges; animates target discovery.
- **`src/components/visualizers/LinearVisualizer.tsx`**:
  - Visualizes Singly, Doubly, and Circular Linked Lists with simulated 32-bit heap memory addresses (`0x7FFE0010`), data blocks, and bidirectional arrows.
  - Visualizes Stack (LIFO) in a vertical canister with a moving `TOP` pointer and underflow/overflow warnings.
  - Visualizes Queue (FIFO) and Circular Queue with modulo wrap-around.
- **`src/components/visualizers/TreeVisualizer.tsx`**:
  - SVG tree renderer displaying nodes and branches.
  - Visualizes AVL self-balancing rotations (LL, RR, LR, RL) with real-time balance factors ($\text{BF} = \text{height}_L - \text{height}_R$).
  - Supports Red-Black tree coloring, Heaps, and step-by-step Traversals (Inorder, Preorder, Postorder, Level Order).
- **`src/components/visualizers/GraphVisualizer.tsx`**:
  - Interactive SVG canvas with vertices and weighted edges.
  - Configurable source and destination vertices.
  - Animates BFS wave expansion, DFS depth exploration, Dijkstra edge relaxations, Bellman-Ford passes, and Kruskal/Prim MST cut expansion.
- **`src/components/visualizers/HashVisualizer.tsx`**:
  - Renders slot arrays with primary hash calculation formula $h(k) = k \pmod{\text{size}}$.
  - Visualizes collision detection, Linear Probing trails, Quadratic Probing parabolic jumps ($i^2$), and Separate Chaining linked list buckets.

---

### 4.9. Analyzer Components
- **`src/components/analyzer/ComplexityCharts.tsx`**:
  - Interactive Recharts bar charts comparing measured C execution times ($\mu\text{s}$), comparison counts, and swap counts across multiple algorithms on identical inputs.
  - Interactive array size scaling slider ($N \in [10..200]$).
  - Reference curves for theoretical Big-O classes: $O(1)$, $O(\log n)$, $O(n)$, $O(n \log n)$, $O(n^2)$.
  - Comprehensive performance audit matrix distinguishing empirical time from asymptotic theory.

---

### 4.10. Application Views
- **`src/views/DashboardView.tsx`**:
  - Main landing view featuring welcome banner, high-level metrics (30+ Algorithms, 18+ Data Structures, C11 Core, Big-O classes), quick-launch cards, and architectural summary.
- **`src/views/DataStructuresView.tsx`**:
  - Tabbed interface switching between Linear Data Structures, Non-Linear & Tree Structures, and Hash-Based Structures.
- **`src/views/AlgorithmsView.tsx`**:
  - Master searchable catalog of all algorithms with category pills, asymptotic complexity tags, and direct launch buttons.
- **`src/views/PlaygroundView.tsx`**:
  - Interactive C development environment with Monaco editor, preset templates (Quick Sort, Binary Search, Linked List, AVL Tree, Dijkstra), sandboxed compilation simulation, and stdout/stderr console output.
- **`src/views/LearningView.tsx`**:
  - Textbook and interview curriculum for all modules with real-world applications, step-by-step algorithms, pros/cons, and technical interview questions from top tech companies.
- **`src/views/AboutView.tsx`**:
  - Technical overview of the platform's systems architecture, C memory management, event-driven animation protocol, and test suite verification.
- **`src/App.tsx`**:
  - Root application component orchestrating active navigation state, global keyboard shortcuts, responsive layout with sidebar, and the search command modal.

---

## 5. Verification & Testing Summary

1. **Backend Unit Testing**:
   - `backend/tests/test_runner.c` was compiled and executed via GCC.
   - **25 out of 25 unit tests passed with 0 failures**, covering empty arrays, single-element arrays, duplicate values, reverse-sorted arrays, binary search target absence, stack underflow/overflow, AVL balance factor invariance, and negative cycle detection.
2. **Frontend Production Build**:
   - Built via `tsc && vite build`.
   - **0 TypeScript compilation errors**, generating optimized production bundles in `dist/`.
3. **End-to-End API Communication**:
   - The C backend HTTP REST server (`backend/dsva_server.exe`) was compiled and tested via CLI and HTTP modes, successfully emitting valid JSON execution traces.
   - The Vite proxy route (`/api`) forwards requests directly to the native C backend.
