#include "graph.h"

#define INF 999999

Graph* graph_create(int num_vertices, bool is_directed) {
    if (num_vertices > MAX_VERTICES) num_vertices = MAX_VERTICES;
    Graph *g = (Graph*)malloc(sizeof(Graph));
    g->num_vertices = num_vertices;
    g->num_edges = 0;
    g->is_directed = is_directed;
    for (int i = 0; i < MAX_VERTICES; i++) {
        for (int j = 0; j < MAX_VERTICES; j++) {
            g->adj_matrix[i][j] = (i == j) ? 0 : INF;
        }
    }
    return g;
}

void graph_add_edge(Graph *g, int u, int v, int weight) {
    if (!g || u >= g->num_vertices || v >= g->num_vertices || u < 0 || v < 0) return;
    g->adj_matrix[u][v] = weight;
    g->edges[g->num_edges++] = (GraphEdge){u, v, weight};
    if (!g->is_directed) {
        g->adj_matrix[v][u] = weight;
        g->edges[g->num_edges++] = (GraphEdge){v, u, weight};
    }
}

void graph_free(Graph *g) {
    if (g) free(g);
}

/* 1. BFS - logic unchanged (already correct); now also emits the
   queue/visited array as state so the frontend has something to
   visualize beyond text, matching the pattern used by sorting. */
ExecutionTrace* run_bfs(Graph *g, int start) {
    ExecutionTrace *tr = trace_create("Breadth First Search (BFS)", "Graph Algorithms");
    if (!g || g->num_vertices == 0) return tr;
    if (start < 0 || start >= g->num_vertices) start = 0;

    double t0 = get_time_us();
    bool visited[MAX_VERTICES] = {false};
    int queue[MAX_VERTICES];
    int front = 0, rear = 0;
    int visited_order[MAX_VERTICES];
    int visited_count = 0;

    visited[start] = true;
    queue[rear++] = start;

    char aux[256];
    snprintf(aux, sizeof(aux), "{\"start\": %d, \"directed\": %s}", start, g->is_directed ? "true" : "false");
    trace_add_step(tr, "init", "BFS initialized with FIFO queue", 1, &start, 1, NULL, 0, aux);

    while (front < rear) {
        int u = queue[front++];
        visited_order[visited_count++] = u;
        char desc[128];
        snprintf(desc, sizeof(desc), "Dequeued vertex %d: Visiting and examining neighbors", u);
        snprintf(aux, sizeof(aux), "{\"vertex\": %d, \"queue_size\": %d}", u, rear - front);
        trace_add_step(tr, "visit_vertex", desc, 8, &u, 1, visited_order, visited_count, aux);

        for (int v = 0; v < g->num_vertices; v++) {
            if (g->adj_matrix[u][v] != INF && g->adj_matrix[u][v] != 0) {
                int edge_pair[2] = {u, v};
                if (!visited[v]) {
                    visited[v] = true;
                    queue[rear++] = v;
                    snprintf(desc, sizeof(desc), "Discovered unvisited neighbor %d via edge (%d, %d). Enqueued.", v, u, v);
                    snprintf(aux, sizeof(aux), "{\"edge\": [%d, %d], \"enqueued\": %d}", u, v, v);
                    trace_add_step(tr, "enqueue_neighbor", desc, 14, edge_pair, 2, visited_order, visited_count, aux);
                } else {
                    snprintf(desc, sizeof(desc), "Neighbor %d already visited. Skipping.", v);
                    trace_add_step(tr, "skip_neighbor", desc, 18, edge_pair, 2, visited_order, visited_count, NULL);
                }
            }
        }
    }

    tr->execution_time_us = get_time_us() - t0;
    trace_add_step(tr, "complete", "BFS traversal completed", 25, NULL, 0, visited_order, visited_count, NULL);
    return tr;
}

/* 2. DFS - logic unchanged (already correct); now tracks and emits
   visit order as state, same reasoning as BFS above. */
static void dfs_rec(Graph *g, int u, bool *visited, ExecutionTrace *tr, int *visited_order, int *visited_count) {
    visited[u] = true;
    visited_order[(*visited_count)++] = u;
    char desc[128];
    snprintf(desc, sizeof(desc), "Visited vertex %d via DFS recursion stack", u);
    trace_add_step(tr, "visit_vertex", desc, 6, &u, 1, visited_order, *visited_count, NULL);

    for (int v = 0; v < g->num_vertices; v++) {
        if (g->adj_matrix[u][v] != INF && g->adj_matrix[u][v] != 0) {
            int edge_pair[2] = {u, v};
            if (!visited[v]) {
                snprintf(desc, sizeof(desc), "Exploring edge (%d -> %d)", u, v);
                trace_add_step(tr, "explore_edge", desc, 11, edge_pair, 2, visited_order, *visited_count, NULL);
                dfs_rec(g, v, visited, tr, visited_order, visited_count);
                snprintf(desc, sizeof(desc), "Backtracking from %d to %d", v, u);
                trace_add_step(tr, "backtrack", desc, 14, edge_pair, 2, visited_order, *visited_count, NULL);
            }
        }
    }
}

ExecutionTrace* run_dfs(Graph *g, int start) {
    ExecutionTrace *tr = trace_create("Depth First Search (DFS)", "Graph Algorithms");
    if (!g || g->num_vertices == 0) return tr;
    if (start < 0 || start >= g->num_vertices) start = 0;

    double t0 = get_time_us();
    bool visited[MAX_VERTICES] = {false};
    int visited_order[MAX_VERTICES];
    int visited_count = 0;
    trace_add_step(tr, "init", "Starting DFS depth exploration", 1, &start, 1, NULL, 0, NULL);
    dfs_rec(g, start, visited, tr, visited_order, &visited_count);
    tr->execution_time_us = get_time_us() - t0;
    trace_add_step(tr, "complete", "DFS traversal completed", 22, NULL, 0, visited_order, visited_count, NULL);
    return tr;
}

/* 3. Dijkstra's Algorithm
   FIXES:
   (a) min-vertex selection used `dist[v] <= min_val`, which on ties
       keeps overwriting `u` to the LAST equally-minimal vertex found
       rather than the first. Changed to strict `<` so selection is
       deterministic and matches the textbook algorithm (first
       minimum wins), which also matters for reproducible frontend
       playback.
   (b) `parent[]` was computed during relaxation but never used -
       the shortest path to `dest` was never reconstructed or
       reported, so the frontend had distances but no path to
       highlight. Added explicit path reconstruction and a final
       trace step reporting the path as both an aux field and an
       "array" snapshot (the path's vertex sequence) so the frontend
       can draw it. */
ExecutionTrace* run_dijkstra(Graph *g, int start, int dest) {
    ExecutionTrace *tr = trace_create("Dijkstra's Algorithm", "Graph Algorithms");
    if (!g || g->num_vertices == 0) return tr;
    if (start < 0 || start >= g->num_vertices) start = 0;
    if (dest < 0 || dest >= g->num_vertices) dest = start;

    double t0 = get_time_us();
    int dist[MAX_VERTICES];
    bool sptSet[MAX_VERTICES] = {false};
    int parent[MAX_VERTICES];

    for (int i = 0; i < g->num_vertices; i++) {
        dist[i] = INF;
        parent[i] = -1;
    }
    dist[start] = 0;

    char aux[256];
    snprintf(aux, sizeof(aux), "{\"start\": %d, \"dest\": %d}", start, dest);
    trace_add_step(tr, "init", "Initialized distances to INF, start vertex dist = 0", 1, &start, 1, dist, g->num_vertices, aux);

    for (int count = 0; count < g->num_vertices - 1; count++) {
        int min_val = INF, u = -1;
        for (int v = 0; v < g->num_vertices; v++) {
            if (!sptSet[v] && dist[v] < min_val) {
                min_val = dist[v];
                u = v;
            }
        }

        if (u == -1 || min_val == INF) break;
        sptSet[u] = true;

        char desc[128];
        snprintf(desc, sizeof(desc), "Selected vertex %d with minimum tentative distance %d", u, dist[u]);
        trace_add_step(tr, "select_min_dist", desc, 12, &u, 1, dist, g->num_vertices, NULL);

        for (int v = 0; v < g->num_vertices; v++) {
            int weight = g->adj_matrix[u][v];
            if (!sptSet[v] && weight != INF && dist[u] != INF && dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
                parent[v] = u;
                int edge_pair[2] = {u, v};
                snprintf(desc, sizeof(desc), "RELAXATION: Updated dist[%d] = dist[%d] + %d = %d", v, u, weight, dist[v]);
                snprintf(aux, sizeof(aux), "{\"relaxed_vertex\": %d, \"new_dist\": %d, \"via\": %d}", v, dist[v], u);
                trace_add_step(tr, "relax_edge", desc, 18, edge_pair, 2, dist, g->num_vertices, aux);
            }
        }
    }

    /* Reconstruct the shortest path start -> dest from parent[] */
    int path[MAX_VERTICES];
    int path_len = 0;
    if (dist[dest] != INF) {
        int cur = dest;
        while (cur != -1 && path_len < MAX_VERTICES) {
            path[path_len++] = cur;
            if (cur == start) break;
            cur = parent[cur];
        }
        /* path currently reversed (dest..start): flip it in place */
        for (int i = 0; i < path_len / 2; i++) {
            int tmp = path[i];
            path[i] = path[path_len - 1 - i];
            path[path_len - 1 - i] = tmp;
        }
    }

    tr->execution_time_us = get_time_us() - t0;

    if (dist[dest] == INF) {
        snprintf(aux, sizeof(aux), "{\"final_distance\": null, \"reachable\": false}");
        trace_add_step(tr, "complete", "Dijkstra completed. Destination is UNREACHABLE from start", 25, NULL, 0, dist, g->num_vertices, aux);
    } else {
        StringBuilder *sb = sb_create(256);
        sb_append_format(sb, "{\"final_distance\": %d, \"reachable\": true, \"path\": [", dist[dest]);
        for (int i = 0; i < path_len; i++) {
            sb_append_format(sb, "%d%s", path[i], (i + 1 < path_len) ? "," : "");
        }
        sb_append(sb, "]}");
        char *path_aux = sb_finish(sb);
        trace_add_step(tr, "complete", "Dijkstra completed. Shortest path tree established", 25, NULL, 0, dist, g->num_vertices, path_aux);
        /* Also emit the path itself as its own step with the path as the "array" state,
           so the frontend can highlight the exact route without re-parsing aux JSON. */
        trace_add_step(tr, "shortest_path", "Reconstructed shortest path from start to destination", 26, NULL, 0, path, path_len, path_aux);
        free(path_aux);
    }
    return tr;
}

/* 4. Bellman-Ford Algorithm
   FIX: same missing-path-reconstruction issue as Dijkstra. Added a
   parent[] array (the original had none at all) and reconstruct the
   path to the furthest/last relaxed vertex set is not well-defined
   for "all shortest paths from start", so we report, in addition to
   the distance array every step already had, the final distance
   array AND parent array together so the frontend can reconstruct
   any path itself without guessing. */
ExecutionTrace* run_bellman_ford(Graph *g, int start) {
    ExecutionTrace *tr = trace_create("Bellman-Ford Algorithm", "Graph Algorithms");
    if (!g || g->num_vertices == 0) return tr;
    if (start < 0 || start >= g->num_vertices) start = 0;

    double t0 = get_time_us();
    int dist[MAX_VERTICES];
    int parent[MAX_VERTICES];
    for (int i = 0; i < g->num_vertices; i++) { dist[i] = INF; parent[i] = -1; }
    dist[start] = 0;

    trace_add_step(tr, "init", "Bellman-Ford: Relaxing all |V|-1 passes to handle negative weights", 1, &start, 1, dist, g->num_vertices, NULL);

    for (int p = 1; p <= g->num_vertices - 1; p++) {
        char pass_desc[128];
        snprintf(pass_desc, sizeof(pass_desc), "--- Relaxation Pass %d of %d ---", p, g->num_vertices - 1);
        trace_add_step(tr, "pass_start", pass_desc, 6, NULL, 0, dist, g->num_vertices, NULL);

        bool any_relaxed = false;
        for (int i = 0; i < g->num_edges; i++) {
            int u = g->edges[i].u;
            int v = g->edges[i].v;
            int w = g->edges[i].weight;

            if (dist[u] != INF && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                parent[v] = u;
                any_relaxed = true;
                int edge_pair[2] = {u, v};
                char desc[128];
                snprintf(desc, sizeof(desc), "Relaxed edge (%d -> %d): dist[%d] updated to %d", u, v, v, dist[v]);
                trace_add_step(tr, "relax_edge", desc, 12, edge_pair, 2, dist, g->num_vertices, NULL);
            }
        }
        if (!any_relaxed) break;
    }

    bool has_cycle = false;
    for (int i = 0; i < g->num_edges; i++) {
        int u = g->edges[i].u;
        int v = g->edges[i].v;
        int w = g->edges[i].weight;
        if (dist[u] != INF && dist[u] + w < dist[v]) {
            has_cycle = true;
            trace_add_step(tr, "negative_cycle", "NEGATIVE CYCLE DETECTED! Graph contains negative weight cycle", 22, NULL, 0, dist, g->num_vertices, NULL);
            break;
        }
    }
    if (!has_cycle) {
        StringBuilder *sb = sb_create(256);
        sb_append(sb, "{\"parents\": [");
        for (int i = 0; i < g->num_vertices; i++) {
            sb_append_format(sb, "%d%s", parent[i], (i + 1 < g->num_vertices) ? "," : "");
        }
        sb_append(sb, "]}");
        char *parent_aux = sb_finish(sb);
        trace_add_step(tr, "complete", "No negative cycles detected. Bellman-Ford shortest paths verified", 26, NULL, 0, dist, g->num_vertices, parent_aux);
        free(parent_aux);
    }

    tr->execution_time_us = get_time_us() - t0;
    return tr;
}

/* 5. Floyd-Warshall Algorithm
   FIX: every trace_add_step call previously passed (NULL, 0) for the
   array/size parameters, meaning NO step of this algorithm ever
   carried any visualizable state - only free-text descriptions. The
   whole point of Floyd-Warshall is watching the distance matrix
   converge, so this now flattens the current V*V distance matrix
   (row-major) into the "array" snapshot on every meaningful step,
   consistent with how sorting/searching already report state. */
ExecutionTrace* run_floyd_warshall(Graph *g) {
    ExecutionTrace *tr = trace_create("Floyd-Warshall Algorithm", "Graph Algorithms");
    if (!g) return tr;

    double t0 = get_time_us();
    int dist[MAX_VERTICES][MAX_VERTICES];
    int V = g->num_vertices;
    for (int i = 0; i < V; i++) {
        for (int j = 0; j < V; j++) dist[i][j] = g->adj_matrix[i][j];
    }

    int flat[MAX_VERTICES * MAX_VERTICES];
    int flat_n = V * V;
    for (int i = 0; i < V; i++)
        for (int j = 0; j < V; j++)
            flat[i * V + j] = dist[i][j];

    char aux[128];
    snprintf(aux, sizeof(aux), "{\"dim\": %d}", V);
    trace_add_step(tr, "init", "All-Pairs Shortest Path: Initialized distance matrix", 1, NULL, 0, flat, flat_n, aux);

    for (int k = 0; k < V; k++) {
        char k_desc[128];
        snprintf(k_desc, sizeof(k_desc), "Considering vertex %d as intermediate pivot", k);
        for (int i = 0; i < V; i++) for (int j = 0; j < V; j++) flat[i * V + j] = dist[i][j];
        trace_add_step(tr, "pivot", k_desc, 6, &k, 1, flat, flat_n, aux);

        for (int i = 0; i < V; i++) {
            for (int j = 0; j < V; j++) {
                if (dist[i][k] != INF && dist[k][j] != INF && dist[i][k] + dist[k][j] < dist[i][j]) {
                    dist[i][j] = dist[i][k] + dist[k][j];
                    char desc[128];
                    snprintf(desc, sizeof(desc), "Path (%d->%d) improved via %d: New dist = %d", i, j, k, dist[i][j]);
                    int pair[2] = {i, j};
                    for (int a = 0; a < V; a++) for (int b = 0; b < V; b++) flat[a * V + b] = dist[a][b];
                    trace_add_step(tr, "matrix_update", desc, 14, pair, 2, flat, flat_n, NULL);
                }
            }
        }
    }

    for (int i = 0; i < V; i++) for (int j = 0; j < V; j++) flat[i * V + j] = dist[i][j];
    tr->execution_time_us = get_time_us() - t0;
    trace_add_step(tr, "complete", "All-pairs shortest paths computed for all vertex pairs", 22, NULL, 0, flat, flat_n, aux);
    return tr;
}

/* 6. Kruskal's Algorithm (DSU)
   FIX: every trace_add_step call previously passed (NULL, 0), so the
   sorted edge list and the union-find parent array were never
   visualized, only described in text. Now the DSU parent array is
   emitted as the "array" state at each relevant step, and the sorted
   edge order plus final MST (edge list + total weight) is reported
   via aux JSON so the frontend has real structural data instead of
   just prose. */
static int find_set(int *parent, int i) {
    if (parent[i] == i) return i;
    return parent[i] = find_set(parent, parent[i]);
}

static void union_set(int *parent, int *rank, int x, int y) {
    int rootX = find_set(parent, x);
    int rootY = find_set(parent, y);
    if (rank[rootX] < rank[rootY]) parent[rootX] = rootY;
    else if (rank[rootX] > rank[rootY]) parent[rootY] = rootX;
    else {
        parent[rootY] = rootX;
        rank[rootX]++;
    }
}

ExecutionTrace* run_kruskal(Graph *g) {
    ExecutionTrace *tr = trace_create("Kruskal's Minimum Spanning Tree", "Graph Algorithms");
    if (!g) return tr;

    double t0 = get_time_us();
    int V = g->num_vertices;
    int parent[MAX_VERTICES], rank[MAX_VERTICES] = {0};
    for (int i = 0; i < V; i++) parent[i] = i;

    trace_add_step(tr, "init", "Kruskal: Sorting edges by weight ascending", 1, NULL, 0, parent, V, NULL);

    GraphEdge edges_sorted[MAX_VERTICES * MAX_VERTICES];
    int E = g->num_edges;
    for (int i = 0; i < E; i++) edges_sorted[i] = g->edges[i];
    for (int i = 0; i < E - 1; i++) {
        for (int j = 0; j < E - i - 1; j++) {
            if (edges_sorted[j].weight > edges_sorted[j + 1].weight) {
                GraphEdge temp = edges_sorted[j];
                edges_sorted[j] = edges_sorted[j + 1];
                edges_sorted[j + 1] = temp;
            }
        }
    }

    {
        StringBuilder *sb = sb_create(512);
        sb_append(sb, "{\"sorted_edges\": [");
        for (int i = 0; i < E; i++) {
            sb_append_format(sb, "[%d,%d,%d]%s", edges_sorted[i].u, edges_sorted[i].v, edges_sorted[i].weight, (i + 1 < E) ? "," : "");
        }
        sb_append(sb, "]}");
        char *sorted_aux = sb_finish(sb);
        trace_add_step(tr, "edges_sorted", "Edge list sorted by ascending weight", 5, NULL, 0, parent, V, sorted_aux);
        free(sorted_aux);
    }

    int mst_edges = 0, total_weight = 0;
    int mst_u[MAX_VERTICES], mst_v[MAX_VERTICES], mst_w[MAX_VERTICES];

    for (int i = 0; i < E && mst_edges < V - 1; i++) {
        int u = edges_sorted[i].u;
        int v = edges_sorted[i].v;
        int w = edges_sorted[i].weight;
        int set_u = find_set(parent, u);
        int set_v = find_set(parent, v);

        int pair[2] = {u, v};
        char desc[128];
        snprintf(desc, sizeof(desc), "Examining edge (%d, %d) with weight %d", u, v, w);
        trace_add_step(tr, "examine_edge", desc, 12, pair, 2, parent, V, NULL);

        if (set_u != set_v) {
            union_set(parent, rank, set_u, set_v);
            mst_u[mst_edges] = u; mst_v[mst_edges] = v; mst_w[mst_edges] = w;
            mst_edges++;
            total_weight += w;
            snprintf(desc, sizeof(desc), "Edge (%d, %d) connects disjoint sets. ADDED to MST (Cost: %d)", u, v, w);
            trace_add_step(tr, "add_mst_edge", desc, 16, pair, 2, parent, V, NULL);
        } else {
            snprintf(desc, sizeof(desc), "Edge (%d, %d) forms a cycle! REJECTED from MST", u, v);
            trace_add_step(tr, "reject_cycle", desc, 20, pair, 2, parent, V, NULL);
        }
    }

    tr->execution_time_us = get_time_us() - t0;

    StringBuilder *sb = sb_create(256);
    sb_append_format(sb, "{\"total_weight\": %d, \"mst_edges\": %d, \"edges\": [", total_weight, mst_edges);
    for (int i = 0; i < mst_edges; i++) {
        sb_append_format(sb, "[%d,%d,%d]%s", mst_u[i], mst_v[i], mst_w[i], (i + 1 < mst_edges) ? "," : "");
    }
    sb_append(sb, "]}");
    char *final_aux = sb_finish(sb);
    trace_add_step(tr, "complete", "Kruskal's MST algorithm completed", 25, NULL, 0, parent, V, final_aux);
    free(final_aux);
    return tr;
}

/* 7. Prim's Algorithm - logic & snapshots already correct, unchanged. */
ExecutionTrace* run_prim(Graph *g, int start) {
    ExecutionTrace *tr = trace_create("Prim's Minimum Spanning Tree", "Graph Algorithms");
    if (!g || g->num_vertices == 0) return tr;
    if (start < 0 || start >= g->num_vertices) start = 0;

    double t0 = get_time_us();
    int V = g->num_vertices;
    int key[MAX_VERTICES], parent[MAX_VERTICES];
    bool inMST[MAX_VERTICES] = {false};

    for (int i = 0; i < V; i++) {
        key[i] = INF;
        parent[i] = -1;
    }
    key[start] = 0;

    trace_add_step(tr, "init", "Prim's: Growing MST starting from root vertex", 1, &start, 1, key, V, NULL);

    for (int count = 0; count < V - 1; count++) {
        int min_key = INF, u = -1;
        for (int v = 0; v < V; v++) {
            if (!inMST[v] && key[v] < min_key) {
                min_key = key[v];
                u = v;
            }
        }

        if (u == -1) break;
        inMST[u] = true;

        char desc[128];
        snprintf(desc, sizeof(desc), "Added vertex %d to MST with min cut weight %d", u, key[u]);
        trace_add_step(tr, "add_vertex_mst", desc, 12, &u, 1, key, V, NULL);

        for (int v = 0; v < V; v++) {
            int w = g->adj_matrix[u][v];
            if (w != INF && !inMST[v] && w < key[v]) {
                parent[v] = u;
                key[v] = w;
                int pair[2] = {u, v};
                snprintf(desc, sizeof(desc), "Updated crossing edge for %d: connected via %d (Weight: %d)", v, u, w);
                trace_add_step(tr, "update_cut", desc, 18, pair, 2, key, V, NULL);
            }
        }
    }

    tr->execution_time_us = get_time_us() - t0;

    StringBuilder *sb = sb_create(256);
    sb_append(sb, "{\"parents\": [");
    for (int i = 0; i < V; i++) {
        sb_append_format(sb, "%d%s", parent[i], (i + 1 < V) ? "," : "");
    }
    sb_append(sb, "]}");
    char *parent_aux = sb_finish(sb);
    trace_add_step(tr, "complete", "Prim's MST successfully grown", 24, NULL, 0, key, V, parent_aux);
    free(parent_aux);
    return tr;
}

/* 8. Topological Sort (Kahn's Algorithm) - logic & snapshots already
   correct, unchanged. */
ExecutionTrace* run_topological_sort(Graph *g) {
    ExecutionTrace *tr = trace_create("Topological Sorting (Kahn's)", "Graph Algorithms");
    if (!g) return tr;

    double t0 = get_time_us();
    int V = g->num_vertices;
    int in_degree[MAX_VERTICES] = {0};

    for (int u = 0; u < V; u++) {
        for (int v = 0; v < V; v++) {
            if (g->adj_matrix[u][v] != INF && g->adj_matrix[u][v] != 0) {
                in_degree[v]++;
            }
        }
    }

    trace_add_step(tr, "init", "Topological Sort: Calculated in-degrees for all vertices", 1, NULL, 0, in_degree, V, NULL);

    int queue[MAX_VERTICES];
    int front = 0, rear = 0;
    for (int i = 0; i < V; i++) {
        if (in_degree[i] == 0) {
            queue[rear++] = i;
            int idx[1] = {i};
            char desc[128];
            snprintf(desc, sizeof(desc), "Vertex %d has in-degree 0: Enqueued to Kahn's queue", i);
            trace_add_step(tr, "enqueue_zero_indegree", desc, 8, idx, 1, in_degree, V, NULL);
        }
    }

    int topo_order[MAX_VERTICES];
    int visited_count = 0;
    while (front < rear) {
        int u = queue[front++];
        topo_order[visited_count++] = u;

        char desc[128];
        snprintf(desc, sizeof(desc), "Processed vertex %d: Added to topological order output", u);
        trace_add_step(tr, "topo_output", desc, 14, &u, 1, in_degree, V, NULL);

        for (int v = 0; v < V; v++) {
            if (g->adj_matrix[u][v] != INF && g->adj_matrix[u][v] != 0) {
                in_degree[v]--;
                if (in_degree[v] == 0) {
                    queue[rear++] = v;
                    int idx[1] = {v};
                    snprintf(desc, sizeof(desc), "In-degree of %d reached 0: Enqueued", v);
                    trace_add_step(tr, "enqueue_zero_indegree", desc, 20, idx, 1, in_degree, V, NULL);
                }
            }
        }
    }

    tr->execution_time_us = get_time_us() - t0;
    if (visited_count != V) {
        trace_add_step(tr, "cycle_error", "CYCLE DETECTED: Graph is not a DAG! Topological sort impossible", 26, NULL, 0, NULL, 0, NULL);
    } else {
        trace_add_step(tr, "complete", "Topological sort successfully completed", 30, NULL, 0, topo_order, visited_count, NULL);
    }
    return tr;
}
