const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} = require('docx');

console.log('Building Word Document: DSVA Complete Code Explanation...');

// Helper to create styled headings
function createTitle(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    run: {
      size: 36,
      bold: true,
      color: '0F766E', // Emerald/Teal brand color
      font: 'Calibri',
    },
  });
}

function createSubtitle(text) {
  return new Paragraph({
    text: text,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    run: {
      size: 22,
      italics: true,
      color: '64748B',
      font: 'Calibri',
    },
  });
}

function createHeading1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    run: {
      size: 28,
      bold: true,
      color: '0F766E',
      font: 'Calibri',
    },
  });
}

function createHeading2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    run: {
      size: 24,
      bold: true,
      color: '1E293B',
      font: 'Calibri',
    },
  });
}

function createHeading3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    run: {
      size: 20,
      bold: true,
      color: '334155',
      font: 'Calibri',
    },
  });
}

function createParagraph(text) {
  return new Paragraph({
    spacing: { before: 60, after: 100 },
    children: [
      new TextRun({
        text: text,
        size: 22,
        font: 'Calibri',
        color: '334155',
      }),
    ],
  });
}

function createBullet(title, description) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 60 },
    children: [
      new TextRun({
        text: title + ': ',
        bold: true,
        size: 22,
        font: 'Calibri',
        color: '0F766E',
      }),
      new TextRun({
        text: description,
        size: 22,
        font: 'Calibri',
        color: '334155',
      }),
    ],
  });
}

function createCalloutBox(title, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F0FDFA' }, // Light emerald tint
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: '0F766E' },
            },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title + '\n',
                    bold: true,
                    size: 22,
                    font: 'Calibri',
                    color: '0F766E',
                  }),
                  new TextRun({
                    text: text,
                    size: 20,
                    italics: true,
                    font: 'Calibri',
                    color: '334155',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createFileSection(fileName, filePath, filePurpose, keyFunctions, howItWorks) {
  return [
    createHeading3(`File: ${fileName}`),
    createParagraph(`Path: ${filePath}`),
    createBullet('Purpose in Simple English', filePurpose),
    createBullet('Key Elements & Functions', keyFunctions),
    createBullet('How It Works in the System', howItWorks),
    new Paragraph({ spacing: { after: 120 } }),
  ];
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: 'Calibri',
          size: 22,
          color: '334155',
        },
      },
    },
  },
  sections: [
    {
      properties: {},
      children: [
        // Title and Subtitle
        createTitle('Data Structure Visualizer & Analyzer (DSVA)'),
        createSubtitle('Complete Code Explanation & Architecture Manual in Plain English'),

        createCalloutBox(
          'Project Mission',
          'DSVA is a computer science learning laboratory where abstract data structures and algorithms are brought to life through interactive animations. Crucially, all computation and memory logic run natively in C11—JavaScript only handles rendering and animation.'
        ),

        new Paragraph({ spacing: { after: 200 } }),

        // SECTION 1: ARCHITECTURE OVERVIEW
        createHeading1('1. Overview: How the Application Works'),
        createParagraph(
          'Imagine you want to teach someone how Quick Sort or an AVL Tree works. If you only show them slides, they cannot see what happens to computer memory when pointers move or when elements swap. DSVA solves this by building an interactive visualizer that connects directly to real C code.'
        ),
        createParagraph(
          'The application is divided into two major layers: the Frontend (what you see and click in the web browser) and the Backend (the fast, native C program that actually executes the algorithms).'
        ),

        createBullet(
          '1. Frontend (Web Browser)',
          'Built with React, TypeScript, and Tailwind CSS. It shows colorful moving bars for sorting, connected circles for trees and graphs, and memory blocks with arrows for linked lists. It also includes the Monaco Code Editor (the exact same editor engine used in Microsoft VS Code) that highlights the active line of C code as the animation plays.'
        ),
        createBullet(
          '2. Backend (Native C Core)',
          'Written in C (C11 standard). When you click "Play" on an algorithm, the backend executes the real C function (like quickSort or avl_insert). As the C program runs, it records every single comparison, swap, memory allocation, and pointer update into a structured list of steps called an Event Trace.'
        ),
        createBullet(
          '3. The Communication Bridge',
          'The C backend turns its event trace into JSON format and sends it over HTTP to the frontend. The frontend reads these steps one by one and turns them into smooth animations.'
        ),

        new Paragraph({ spacing: { after: 200 } }),

        // SECTION 2: TOOLS AND TECHNOLOGIES
        createHeading1('2. Tools and Technologies Used in the Project'),
        createParagraph(
          'Here is a simple breakdown of every single tool and technology used in DSVA and why it was selected:'
        ),

        createHeading2('A. Frontend Technologies (User Interface)'),
        createBullet(
          'React 18',
          'A modern JavaScript UI library that lets us build modular visual components (such as the sidebar, playback controls, and visualizer canvases) that re-render automatically when data changes.'
        ),
        createBullet(
          'TypeScript',
          'A strongly-typed superset of JavaScript that prevents bugs before code is even run by checking that all data types match perfectly.'
        ),
        createBullet(
          'Tailwind CSS',
          'A utility-first CSS framework used to design the sleek, modern dark-themed user interface, complete with subtle glass-morphism panels, glowing borders, and responsive layouts.'
        ),
        createBullet(
          'Framer Motion',
          'A production-ready animation library for React that provides spring physics transitions. When two array elements swap, Framer Motion makes them glide smoothly across the screen.'
        ),
        createBullet(
          'Monaco Editor (@monaco-editor/react)',
          'The industry-standard code editor that powers Visual Studio Code. In DSVA, it displays clean, syntax-highlighted C code and dynamically highlights lines in real time.'
        ),
        createBullet(
          'Recharts',
          'A composable charting library built on React and SVG. It renders the performance benchmark charts, plotting measured microsecond execution times and Big-O growth curves.'
        ),
        createBullet(
          'Lucide React',
          'A collection of crisp, modern vector icons used for buttons, metrics, and navigation.'
        ),
        createBullet(
          'Canvas Confetti',
          'A celebration library that fires colorful confetti whenever an algorithm completes its full execution.'
        ),
        createBullet(
          'Vite',
          'An ultra-fast frontend build tool and development server that bundles our React and TypeScript code and proxies API calls to the backend.'
        ),

        createHeading2('B. Backend Technologies (The C Engine)'),
        createBullet(
          'C Programming Language (C11/C17 Standard)',
          'The single source of truth for all algorithm and data structure operations. Using C ensures authentic pointers, true manual memory management, and bare-metal performance.'
        ),
        createBullet(
          'GCC / MinGW (GNU Compiler Collection)',
          'The standard C compiler used to compile our C source code into high-speed native Windows executables (dsva_server.exe and dsva_tests.exe).'
        ),
        createBullet(
          'Winsock2 (Windows Sockets) & POSIX Sockets',
          'Low-level networking APIs used to build a lightweight HTTP REST server from scratch in pure C without relying on heavy external dependencies.'
        ),
        createBullet(
          'High-Resolution Timers (QueryPerformanceCounter)',
          'Hardware-level clock functions that measure execution time down to individual microseconds (one-millionth of a second).'
        ),
        createBullet(
          'CMake & Makefile',
          'Standard build systems that automate the compilation of all C source files into executables.'
        ),
        createBullet(
          'Docker',
          'A container platform used to package the C backend and its build dependencies into an isolated, portable Linux container.'
        ),

        createHeading2('C. Database & Memory Model: How Data Is Handled'),
        createParagraph(
          'In web development, people usually think of databases like MySQL, PostgreSQL, or MongoDB. However, DSVA operates differently because of what it does:'
        ),
        createCalloutBox(
          'Why Traditional Disk Databases Are Not Used Here',
          'Data structures like Stacks, Queues, Binary Trees, and Hash Tables live directly in computer RAM (Random Access Memory), not on hard drives. When a computer runs a program, it allocates blocks of RAM using functions like malloc() and points to memory addresses like 0x7FFE0010. Therefore, DSVA implements an authentic in-memory engine rather than storing algorithm steps in a SQL database.'
        ),
        createBullet(
          'In-Memory Heap Allocation',
          'When you insert a node into a linked list or tree, the C engine calls malloc(sizeof(Node)) to allocate real memory in RAM. When a node is deleted, it calls free() to prevent memory leaks.'
        ),
        createBullet(
          'Simulated Memory Addressing',
          'To teach students how memory pointers work, DSVA generates simulated 32-bit hexadecimal memory addresses (e.g., 0x7FFE0010) and displays them on screen inside node boxes.'
        ),
        createBullet(
          'JSON In-Flight Serialization',
          'Instead of saving results to disk, the C engine serializes the memory state into a dynamic JSON event stream and transmits it to the browser over HTTP.'
        ),

        new Paragraph({ spacing: { after: 200 } }),

        // SECTION 3: FILE BY FILE EXPLANATION
        createHeading1('3. Complete File-by-File Explanation'),
        createParagraph(
          'The following section explains every single file in the DSVA codebase in plain, simple English.'
        ),

        // --- BACKEND HEADER FILES ---
        createHeading2('A. Backend Header Files (backend/include/)'),

        ...createFileSection(
          'common.h',
          'backend/include/common.h',
          'Defines the core data structures used by all C modules to record algorithm steps and build JSON text.',
          'StringBuilder (for growing text buffers), EventStep (for each operation like compare or swap), ExecutionTrace (contains all steps and metrics), and get_time_us() (measures time in microseconds).',
          'Every algorithm in the backend includes this header. Whenever an algorithm does an action, it logs an EventStep into the ExecutionTrace.'
        ),

        ...createFileSection(
          'sorting.h',
          'backend/include/sorting.h',
          'Declares function signatures for all 10 sorting algorithms implemented in C.',
          'Functions: run_bubble_sort, run_selection_sort, run_insertion_sort, run_merge_sort, run_quick_sort, run_heap_sort, run_counting_sort, run_radix_sort, run_shell_sort, and run_bucket_sort.',
          'Each function takes an input array of numbers and its size, runs the algorithm, and returns an ExecutionTrace pointer filled with steps.'
        ),

        ...createFileSection(
          'searching.h',
          'backend/include/searching.h',
          'Declares function signatures for all 5 searching algorithms in C.',
          'Functions: run_linear_search, run_binary_search, run_jump_search, run_interpolation_search, and run_exponential_search.',
          'Each function accepts an array and a target number, searches for the target step-by-step, and logs whether it found or did not find the target.'
        ),

        ...createFileSection(
          'linear_ds.h',
          'backend/include/linear_ds.h',
          'Declares functions to operate on all linear data structures in C.',
          'Functions for Arrays, Singly Linked Lists, Doubly Linked Lists, Circular Linked Lists, Stacks, Queues, Circular Queues, and Deques.',
          'Handles actions like insert, delete, push, pop, enqueue, and dequeue, producing memory allocation and pointer assignment events.'
        ),

        ...createFileSection(
          'tree_ds.h',
          'backend/include/tree_ds.h',
          'Declares functions for non-linear structures: Binary Search Trees, AVL Trees, Red-Black Trees, Heaps, Traversals, and LCA.',
          'Functions: run_bst_op, run_avl_op, run_red_black_op, run_heap_op, run_tree_traversal, run_tree_lca, run_trie_op, and run_btree_op.',
          'Supports tree rotations (Left/Right), balance factor calculations, and recursive traversals (Inorder, Preorder, Postorder, Level Order).'
        ),

        ...createFileSection(
          'hash_table.h',
          'backend/include/hash_table.h',
          'Declares functions for hash tables and collision handling strategies.',
          'Function: run_hash_table_op (supports Linear Probing, Quadratic Probing, and Separate Chaining).',
          'Calculates bucket slots using modulo arithmetic and shows how collisions are resolved step-by-step.'
        ),

        ...createFileSection(
          'graph.h',
          'backend/include/graph.h',
          'Declares graph data structures (adjacency matrix and edge list) and 8 graph algorithms.',
          'Functions: run_bfs, run_dfs, run_dijkstra, run_bellman_ford, run_floyd_warshall, run_kruskal, run_prim, and run_topological_sort.',
          'Allows creating vertices and weighted edges, and animates shortest paths, minimum spanning trees, and topological ordering.'
        ),

        ...createFileSection(
          'analyzer.h',
          'backend/include/analyzer.h',
          'Declares functions to compare multiple algorithms side-by-side on identical input arrays.',
          'Functions: analyzer_compare_sorting and analyzer_benchmark_scaling.',
          'Collects comparisons, swaps, operations, and microsecond timings to generate comparison tables and charts.'
        ),

        ...createFileSection(
          'server.h',
          'backend/include/server.h',
          'Declares the lightweight HTTP REST server and API request router.',
          'Functions: start_http_server(port) and handle_api_request(method, path, body).',
          'Bridges network communication from web browsers directly to the C algorithms.'
        ),

        // --- BACKEND SOURCE FILES ---
        createHeading2('B. Backend Source Files (backend/src/)'),

        ...createFileSection(
          'common.c',
          'backend/src/common.c',
          'Implements the dynamic string builder, trace management, and microsecond timing primitives.',
          'sb_create, sb_append, trace_create, trace_add_step, trace_to_json, and get_time_us.',
          'Converts C structs into properly formatted JSON text that web browsers can understand, with sub-microsecond timing accuracy.'
        ),

        ...createFileSection(
          'sorting.c',
          'backend/src/algorithms/sorting.c',
          'Implements all 10 sorting algorithms in standard C11.',
          'Full code for Bubble, Selection, Insertion, Merge, Quick, Heap, Counting, Radix, Shell, and Bucket Sort.',
          'At each step, records comparisons (arr[j] > arr[j+1]), swaps, key insertions, and pivot placements, matching exact C code line numbers.'
        ),

        ...createFileSection(
          'searching.c',
          'backend/src/algorithms/searching.c',
          'Implements all 5 searching algorithms in standard C11.',
          'Full code for Linear, Binary, Jump, Interpolation, and Exponential Search.',
          'Calculates safe midpoints (low + (high - low) / 2) to prevent overflow, logs eliminated left/right search zones, and flags target matches.'
        ),

        ...createFileSection(
          'linear_ds.c',
          'backend/src/data_structures/linear_ds.c',
          'Implements memory management and pointer logic for linear data structures.',
          'Functions handling Arrays, Linked Lists, Stacks, Queues, and Deques.',
          'Simulates heap allocations (malloc) with addresses, rewires pointer links (newNode->next), and safely frees memory.'
        ),

        ...createFileSection(
          'tree_ds.c',
          'backend/src/trees/tree_ds.c',
          'Implements binary trees, AVL balancing, rotations, heaps, and tree traversals.',
          'BSTNode struct, avl_right_rotate (LL), avl_left_rotate (RR), balance factor checks, and recursive traversals.',
          'Maintains height invariants (|left - right| <= 1). Whenever an AVL tree becomes unbalanced, it applies rotations to restore balance.'
        ),

        ...createFileSection(
          'hash_table.c',
          'backend/src/data_structures/hash_table.c',
          'Implements hash tables with collision resolution strategies.',
          'run_hash_table_op with linear probing, quadratic probing (i^2 offset), and separate chaining linked lists.',
          'Demonstrates what happens when two different keys calculate the same slot, and how the program finds the next available slot.'
        ),

        ...createFileSection(
          'graph.c',
          'backend/src/graph/graph.c',
          'Implements graph algorithms using adjacency matrices and edge lists.',
          'BFS, DFS, Dijkstra, Bellman-Ford (with negative cycle detection), Floyd-Warshall, Kruskal (with Disjoint Set Union), Prim, and Kahn Topological Sort.',
          'Traces how shortest paths are discovered and how Minimum Spanning Trees connect all nodes with the lowest total edge cost.'
        ),

        ...createFileSection(
          'analyzer.c',
          'backend/src/analyzer/analyzer.c',
          'Implements side-by-side performance benchmarking for multiple algorithms.',
          'analyzer_compare_sorting and get_sorting_complexities.',
          'Runs multiple sorting algorithms on the exact same randomized numbers and collects their real execution metrics.'
        ),

        ...createFileSection(
          'router.c',
          'backend/src/server/router.c',
          'Parses incoming HTTP paths and JSON payloads and calls the appropriate C functions.',
          'handle_api_request, parse_int_array, parse_int_value, and parse_string_value.',
          'Acts as the traffic director: if the browser asks for /api/sorting/quick-sort, router.c calls run_quick_sort() and returns the JSON result.'
        ),

        ...createFileSection(
          'main.c',
          'backend/src/server/main.c',
          'The entry point of the C backend executable.',
          'main() and start_http_server(port).',
          'Initializes Windows Sockets (WSAStartup), creates a socket, binds to port 8080, and listens for HTTP requests. Also supports --cli mode for instant command-line runs.'
        ),

        // --- BACKEND TESTS & BUILD ---
        createHeading2('C. Backend Tests & Build Tools'),

        ...createFileSection(
          'test_runner.c',
          'backend/tests/test_runner.c',
          'An automated C unit test suite with 25 comprehensive test cases.',
          'test_sorting_edge_cases, test_searching_algorithms, test_linear_ds, test_trees_and_avl, and test_graph_algorithms.',
          'Tests edge cases like empty arrays, single elements, duplicate numbers, reverse-sorted inputs, missing targets, and negative cycles. All 25 tests pass with 0 failures.'
        ),

        ...createFileSection(
          'CMakeLists.txt',
          'backend/CMakeLists.txt',
          'The CMake build recipe that compiles all backend files.',
          'Defines executable targets dsva_server and dsva_tests and links the ws2_32 Windows socket library.',
          'Allows developers to build the C backend on Windows, Mac, or Linux using standard CMake commands.'
        ),

        ...createFileSection(
          'Makefile',
          'backend/Makefile',
          'Standard GNU Makefile for quick terminal compilation with GCC.',
          'Targets: all, dsva_server, dsva_tests, test, and clean.',
          'Compiles the backend with optimization flags (-O2 -Wall -std=c11) in a single command (make).'
        ),

        ...createFileSection(
          'Dockerfile',
          'backend/Dockerfile',
          'A multi-stage container recipe for packaging the C backend into Docker.',
          'Stage 1 (builder) uses gcc:12 to compile the C server; Stage 2 creates a minimal debian:bullseye-slim runtime exposing port 8080.',
          'Enables one-command deployment to cloud servers or container platforms.'
        ),

        // --- FRONTEND ENGINE & HOOKS ---
        createHeading2('D. Frontend Engine & Custom Hooks (src/engine/ & src/hooks/)'),

        ...createFileSection(
          'types.ts',
          'src/engine/types.ts',
          'Defines all TypeScript interfaces and types for the frontend.',
          'NavSection, ExecutionStep, ExecutionTrace, AlgorithmMetric, LearningTopic, GraphNode, and GraphEdgeModel.',
          'Ensures strict type safety across the entire React application so components know exactly what fields exist in data objects.'
        ),

        ...createFileSection(
          'api.ts',
          'src/engine/api.ts',
          'The network communication bridge connecting React to the C backend.',
          'executeAlgorithmApi, compareAlgorithmsApi, and client-side C-mirror fallback functions.',
          'Attempts to send requests to the C backend on port 8080. If the server is offline or deployed as a static web app, it seamlessly runs an internal C-identical mirror so the user never sees a broken screen.'
        ),

        ...createFileSection(
          'cSourceRegistry.ts',
          'src/engine/cSourceRegistry.ts',
          'A library of pristine, production-quality C source code files.',
          'Complete C11 code, sample inputs, sample outputs, and section breakdowns for Quick Sort, Merge Sort, Binary Search, Linked Lists, AVL Trees, and Dijkstra.',
          'Provides the source code displayed inside the Monaco Code Editor.'
        ),

        ...createFileSection(
          'learningContent.ts',
          'src/engine/learningContent.ts',
          'An educational syllabus containing textbook-grade explanations and interview preparation.',
          'LEARNING_TOPICS array with real-world applications (Linux kernel, GPS, Git), step-by-step algorithms, pros/cons, and company interview questions (Google, Meta, Amazon).',
          'Powers the Learning Resources view with comprehensive computer science curriculum.'
        ),

        ...createFileSection(
          'useAnimationPlayer.ts',
          'src/hooks/useAnimationPlayer.ts',
          'A custom React hook that manages algorithm animation playback.',
          'Functions: play, pause, togglePlay, stepForward, stepBackward, reset, seek, setSpeed, and automatic celebration confetti.',
          'Controls the timing of each animation step, calculates progress percentage, and allows scrubbing forward or backward through execution.'
        ),

        ...createFileSection(
          'useKeyboardShortcuts.ts',
          'src/hooks/useKeyboardShortcuts.ts',
          'A custom React hook providing global keyboard controls.',
          'Listens for Space (Play/Pause), ArrowRight/L (Step Forward), ArrowLeft/J (Step Backward), R (Reset), and Ctrl+K (Search).',
          'Gives users a responsive desktop-like experience while ignoring keystrokes when typing in text boxes or the code editor.'
        ),

        // --- FRONTEND COMPONENTS ---
        createHeading2('E. Frontend UI Components (src/components/)'),

        ...createFileSection(
          'Navbar.tsx',
          'src/components/common/Navbar.tsx',
          'The top navigation header bar of the application.',
          'DSVA brand logo, search trigger button (Ctrl+K), C Engine live health connection indicator pill, and quick navigation links.',
          'Permanently visible at the top, showing users whether the native C backend is connected or in web mode.'
        ),

        ...createFileSection(
          'Sidebar.tsx',
          'src/components/common/Sidebar.tsx',
          'The left navigation sidebar listing all 10 core application sections.',
          'Navigation items with icons and badges (Dashboard, Data Structures, Algorithms, Sorting, Searching, Graphs, Complexity, Playground, Learning, About).',
          'Allows users to switch between visualizers with one click, highlighting the currently active section.'
        ),

        ...createFileSection(
          'ControlPanel.tsx',
          'src/components/common/ControlPanel.tsx',
          'The universal playback control bar used across all visualizers.',
          'Play/Pause button, Step Back, Step Forward, Reset, Speed multipliers (0.5x, 1x, 2x, 4x), progress scrubber slider, and live C line number badge.',
          'Gives the user complete control over the animation speed and allows inspecting algorithms one single step at a time.'
        ),

        ...createFileSection(
          'SearchModal.tsx',
          'src/components/common/SearchModal.tsx',
          'A Command Palette search window activated by pressing Ctrl+K or clicking search.',
          'Indexes all 30+ algorithms and 18+ data structures with keyword fuzzy searching and keyboard arrow selection.',
          'Allows users to quickly search for any algorithm (e.g., "dijkstra", "avl", "merge sort") and jump straight to its visualizer.'
        ),

        ...createFileSection(
          'StatBadge.tsx',
          'src/components/common/StatBadge.tsx',
          'A sleek metric badge displaying numbers with icons.',
          'Displays Comparisons, Swaps, Total Operations, and Measured C Execution Time in microseconds.',
          'Provides clear, real-time computational metrics on visualizer stages.'
        ),

        ...createFileSection(
          'CodeViewer.tsx',
          'src/components/code/CodeViewer.tsx',
          'Embeds the Monaco Code Editor with live C line execution tracking.',
          'Integrates @monaco-editor/react with custom dsva-dark theme, copy button, .c file download button, read-only toggle, and code explanation drawer.',
          'As the visualizer plays, this component uses deltaDecorations to highlight the exact line of C code currently executing in real time.'
        ),

        ...createFileSection(
          'SortingVisualizer.tsx',
          'src/components/visualizers/SortingVisualizer.tsx',
          'The dedicated interactive sorting stage.',
          'Animated bars with Framer Motion spring physics, color coding (comparing, swapping, pivot, sorted), preset generators (Random, Nearly Sorted, Reversed), array size slider, and custom array input.',
          'Allows users to see all 10 sorting algorithms execute in real time alongside their live C code.'
        ),

        ...createFileSection(
          'SearchingVisualizer.tsx',
          'src/components/visualizers/SearchingVisualizer.tsx',
          'The dedicated interactive searching stage.',
          'Memory cell track for Binary, Linear, Jump, Interpolation, and Exponential search with LOW, MID, HIGH, and TARGET pointers.',
          'Shades out and strikes through eliminated search regions, making logarithmic halving visually obvious.'
        ),

        ...createFileSection(
          'LinearVisualizer.tsx',
          'src/components/visualizers/LinearVisualizer.tsx',
          'Visualizes linear data structures and pointer memory.',
          'Supports Singly/Doubly/Circular Linked Lists, Stacks (vertical LIFO canister), Queues (horizontal FIFO), Circular Queues (ring buffer), and Deques.',
          'Draws memory address headers (e.g., 0x7FFE0010), data boxes, next/prev pointer links, and animates node allocation (malloc) and node deletion (free).'
        ),

        ...createFileSection(
          'TreeVisualizer.tsx',
          'src/components/visualizers/TreeVisualizer.tsx',
          'Interactive SVG tree visualizer with branch connections.',
          'Visualizes Binary Search Trees, AVL Trees (with Left and Right rotations and Balance Factor tags), Red-Black trees, Heaps, Traversals, and LCA.',
          'Shows how tree nodes rebalance themselves dynamically whenever balance factors exceed -1 or +1.'
        ),

        ...createFileSection(
          'GraphVisualizer.tsx',
          'src/components/visualizers/GraphVisualizer.tsx',
          'Interactive SVG graph visualizer with weighted edges.',
          'Configurable source and destination nodes; executes BFS, DFS, Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal MST, Prim MST, and Topological Sort.',
          'Animates wave discovery, edge relaxations, shortest path distances, and minimum spanning tree cuts.'
        ),

        ...createFileSection(
          'HashVisualizer.tsx',
          'src/components/visualizers/HashVisualizer.tsx',
          'Interactive hash table and collision resolution visualizer.',
          'Renders bucket slots with primary hash formula h(k) = k % size; supports Linear Probing, Quadratic Probing (i^2 jumps), and Separate Chaining.',
          'Shows what happens when two keys calculate the same slot index and animates the probing jump sequence.'
        ),

        ...createFileSection(
          'ComplexityCharts.tsx',
          'src/components/analyzer/ComplexityCharts.tsx',
          'Interactive benchmark suite and Big-O performance analyzer.',
          'Recharts bar charts for execution time, comparisons, and swaps; asymptotic curves for O(1), O(log n), O(n), O(n log n), O(n^2); detailed audit table.',
          'Allows users to compare multiple algorithms on identical randomized numbers across adjustable input sizes (N = 10 to 200).'
        ),

        // --- FRONTEND VIEWS & ENTRY ---
        createHeading2('F. Frontend Views & Root Entry (src/views/ & src/)'),

        ...createFileSection(
          'DashboardView.tsx',
          'src/views/DashboardView.tsx',
          'The main landing page of the application.',
          'Hero welcome banner, stats counters (30+ algorithms, 18+ data structures, C11 standard), quick-launch cards, and feature highlights.',
          'Introduces the user to the platform and lets them jump straight into any visualization suite.'
        ),

        ...createFileSection(
          'DataStructuresView.tsx',
          'src/views/DataStructuresView.tsx',
          'A tabbed hub hosting all data structure visualizers.',
          'Switches between Linear Data Structures, Non-Linear & Trees, and Hash-Based Structures.',
          'Organizes all 18+ data structures into a clean, unified workspace.'
        ),

        ...createFileSection(
          'AlgorithmsView.tsx',
          'src/views/AlgorithmsView.tsx',
          'The master directory of all 30+ algorithms.',
          'Searchable cards with category filter pills (Sorting, Searching, Graph, Trees), complexity badges, descriptions, and one-click launch buttons.',
          'Allows students and developers to browse and launch any algorithm in the platform.'
        ),

        ...createFileSection(
          'PlaygroundView.tsx',
          'src/views/PlaygroundView.tsx',
          'An interactive C developer IDE inside the browser.',
          'Monaco editor with preset templates (Quick Sort, Binary Search, Linked List, AVL Tree, Dijkstra), execution console terminal, copy button, and .c file downloader.',
          'Lets users write or modify C code, compile, and see stdout/stderr execution output in a simulated sandbox.'
        ),

        ...createFileSection(
          'LearningView.tsx',
          'src/views/LearningView.tsx',
          'The comprehensive educational syllabus and interview preparation guide.',
          'Interactive curriculum covering real-world applications, step-by-step algorithms, complexities, pros/cons, and company interview questions with expandable hints and solutions.',
          'Provides complete textbook-grade theory alongside production C source code.'
        ),

        ...createFileSection(
          'AboutView.tsx',
          'src/views/AboutView.tsx',
          'Explains the systems architecture and engineering principles behind DSVA.',
          'Details C as the ground truth, the JSON event protocol, memory safety, the tech stack, and unit test verification results.',
          'Documents the engineering design for technical reviewers and educators.'
        ),

        ...createFileSection(
          'App.tsx',
          'src/App.tsx',
          'The root React component of the application.',
          'Manages active navigation section state, binds global keyboard shortcuts, and renders the Navbar, Sidebar, active View, and Search Modal.',
          'Acts as the conductor that connects all pages, navigation, and modal dialogues together.'
        ),

        ...createFileSection(
          'main.tsx',
          'src/main.tsx',
          'The entry point of the React application.',
          'ReactDOM.createRoot() mounting <App /> into the #root element in index.html.',
          'Initializes React and starts the entire frontend user interface.'
        ),

        ...createFileSection(
          'index.css',
          'src/index.css',
          'The global stylesheet of the application.',
          'Tailwind CSS directives (@tailwind base, components, utilities), custom sleek scrollbars, glassmorphism panel classes, and glowing borders.',
          'Provides the polished, professional dark developer aesthetic across the entire app.'
        ),

        ...createFileSection(
          'index.html',
          'index.html',
          'The HTML5 entry file loaded by the web browser.',
          'Imports Google Fonts (Inter, JetBrains Mono, Fira Code), sets viewport, title, and favicon, and mounts <div id="root">.',
          'The browser entry point that boots up the Vite development server and bundles.'
        ),

        ...createFileSection(
          'vite.config.ts',
          'vite.config.ts',
          'The build and development configuration for Vite.',
          'Configures @vitejs/plugin-react and sets up an automated proxy routing /api requests to http://127.0.0.1:8080.',
          'Enables seamless communication between the frontend dev server and the native C backend server.'
        ),

        ...createFileSection(
          'tsconfig.json',
          'tsconfig.json',
          'The TypeScript compiler configuration file.',
          'Configures ES2020 target, bundler module resolution, React JSX transform, and type checking rules.',
          'Governs how TypeScript checks and compiles code into JavaScript.'
        ),

        ...createFileSection(
          'tailwind.config.js',
          'tailwind.config.js',
          'The configuration file for Tailwind CSS.',
          'Defines custom emerald brand colors (#22c55e), dark editor background colors (#1e1e1e), and monospace font families.',
          'Controls the design system, colors, and styling rules.'
        ),

        ...createFileSection(
          'postcss.config.js',
          'postcss.config.js',
          'The PostCSS tool configuration.',
          'Enables Tailwind CSS and Autoprefixer plugins.',
          'Processes CSS files to ensure compatibility across all modern web browsers.'
        ),

        ...createFileSection(
          'package.json',
          'package.json',
          'The project manifest file for Node.js and npm.',
          'Lists all frontend dependencies (React, Monaco, Framer Motion, Recharts, docx) and npm scripts (dev, build, preview).',
          'Manages package versions and build commands.'
        ),

        ...createFileSection(
          '.gitignore',
          '.gitignore',
          'Specifies files that should not be tracked by Git version control.',
          'Ignores node_modules/, dist/, compiled .exe files, and temporary OS files.',
          'Keeps the Git repository clean and lightweight.'
        ),

        ...createFileSection(
          'README.md',
          'README.md',
          'The official project overview and quickstart guide.',
          'Includes architecture diagrams, key features, step-by-step build instructions, and testing results.',
          'The first document developers read when opening the repository on GitHub.'
        ),

        ...createFileSection(
          'CODE_EXPLANATION.md',
          'CODE_EXPLANATION.md',
          'Comprehensive markdown documentation of the entire codebase.',
          'Provides in-depth explanations of every backend and frontend file with code snippets.',
          'Serves as an in-repository technical manual for developers and contributors.'
        ),

        new Paragraph({ spacing: { after: 200 } }),

        // SECTION 4: HOW TO RUN AND TEST
        createHeading1('4. How to Build, Test, and Run the Entire System'),
        createParagraph(
          'Running DSVA is straightforward. You can run both the native C backend and the modern web frontend using simple commands:'
        ),

        createHeading2('Step 1: Compile and Run C Unit Tests (Verification)'),
        createParagraph(
          'To verify that all 25 C algorithms and edge cases work properly, open your terminal and run:'
        ),
        createBullet('Command', 'cd backend && gcc -O2 -std=c99 -Iinclude -o dsva_tests.exe src/common.c src/algorithms/sorting.c src/algorithms/searching.c src/data_structures/linear_ds.c src/data_structures/hash_table.c src/trees/tree_ds.c src/graph/graph.c src/analyzer/analyzer.c tests/test_runner.c && .\\dsva_tests.exe'),
        createParagraph('All 25 automated tests will execute and confirm: Total Tests: 25 | Passed: 25 | Failed: 0.'),

        createHeading2('Step 2: Start the Native C HTTP Backend Server'),
        createParagraph('To start the C server listening on port 8080:'),
        createBullet('Command', 'cd backend && gcc -O2 -std=c99 -Iinclude -o dsva_server.exe src/common.c src/algorithms/sorting.c src/algorithms/searching.c src/data_structures/linear_ds.c src/data_structures/hash_table.c src/trees/tree_ds.c src/graph/graph.c src/analyzer/analyzer.c src/server/router.c src/server/main.c -lws2_32 && .\\dsva_server.exe 8080'),
        createParagraph('The server will start and print: [DSVA C Engine] HTTP Server listening on http://127.0.0.1:8080.'),

        createHeading2('Step 3: Launch the Frontend Web Interface'),
        createParagraph('In a new terminal window at the project root:'),
        createBullet('Command', 'npm run dev'),
        createParagraph('Open http://localhost:5173 in your web browser. You can now explore all data structures, execute algorithms, watch animated operations, inspect live C code, and run Big-O performance benchmarks!'),

        new Paragraph({ spacing: { after: 200 } }),

        // SECTION 5: CONCLUSION
        createHeading1('5. Summary and Educational Value'),
        createParagraph(
          'DSVA demonstrates how low-level systems programming in C and high-level reactive web design in React can be united. By using C as the computational engine and React as the presentation layer, students and engineers gain a deep, accurate, and intuitive understanding of how computer memory and algorithms genuinely operate.'
        ),
      ],
    },
  ],
});

// Pack into Word Document (.docx)
Packer.toBuffer(doc)
  .then((buffer) => {
    const outputPath = path.join(__dirname, 'DSVA_Complete_Code_Explanation.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`SUCCESS: Word document created at: ${outputPath}`);
  })
  .catch((err) => {
    console.error('ERROR creating Word document:', err);
  });
