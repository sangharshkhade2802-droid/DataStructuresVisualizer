#include "hash_table.h"

/* ======================================================================
   FIX SUMMARY for this file:

   The original "chaining" branch was not chaining at all:
       if (table[h] == -1) table[h] = item;
   This only inserted a key if its home slot happened to be empty and
   SILENTLY DROPPED every colliding key (no linked list per bucket was
   ever built). That is real, silent data loss — exactly the kind of
   bug that makes "everything looks subtly wrong" when you test hash
   tables with more than a couple of keys per slot.

   This version implements real separate chaining: each bucket holds a
   singly linked list of keys, so multiple keys can legitimately share
   a bucket. Linear and quadratic probing are unchanged (they were
   already correct), but search for chaining mode now correctly walks
   the bucket's chain instead of incorrectly probing other slots
   (probing is meaningless for chaining; a key either is or isn't in
   its home bucket's list).

   Because the EventStep "array" snapshot is a flat int array, chained
   buckets are visualized as: table[i] == -1 when bucket i is empty,
   otherwise table[i] == the FIRST key in that bucket's chain (head),
   while the chain's full contents are reported in the aux JSON as
   a "chain" array so the frontend can render the linked nodes. This
   keeps the existing EventStep/trace_to_json wire format unchanged
   (no changes needed in common.c or the JSON schema) while actually
   representing all keys instead of dropping them.
   ====================================================================== */

typedef struct ChainNode {
    int key;
    struct ChainNode *next;
} ChainNode;

static ChainNode* chain_node_new(int key) {
    ChainNode *n = (ChainNode*)malloc(sizeof(ChainNode));
    n->key = key;
    n->next = NULL;
    return n;
}

static void chain_free(ChainNode *head) {
    while (head) {
        ChainNode *next = head->next;
        free(head);
        head = next;
    }
}

static void chain_push_front(ChainNode **head, int key) {
    ChainNode *n = chain_node_new(key);
    n->next = *head;
    *head = n;
}

static bool chain_contains(ChainNode *head, int key) {
    for (ChainNode *c = head; c; c = c->next) {
        if (c->key == key) return true;
    }
    return false;
}

/* Build an aux JSON string describing one bucket's full chain, e.g.
   {"mode":"chaining","bucket":3,"chain":[7,17,27]} so the frontend can
   draw every node in the bucket, not just the head. */
static char* chain_to_aux_json(int bucket, ChainNode *head, const char *extra_note) {
    StringBuilder *sb = sb_create(256);
    sb_append_format(sb, "{\"mode\":\"chaining\",\"bucket\":%d,\"chain\":[", bucket);
    bool first = true;
    for (ChainNode *c = head; c; c = c->next) {
        if (!first) sb_append(sb, ",");
        sb_append_format(sb, "%d", c->key);
        first = false;
    }
    sb_append(sb, "]");
    if (extra_note) {
        sb_append_format(sb, ",\"note\":\"%s\"", extra_note);
    }
    sb_append(sb, "}");
    return sb_finish(sb);
}

ExecutionTrace* run_hash_table_op(const int *keys, int size, int table_size,
                                  const char *collision_mode, const char *op, int key, int val) {
    (void)val; /* reserved for future key-value support; current API is key-only */
    if (table_size <= 0) table_size = 10;
    ExecutionTrace *tr = trace_create("Hash Table & Collision Resolution", "Hash-Based Structures");

    bool is_chaining = (strcmp(collision_mode, "linear") != 0 && strcmp(collision_mode, "quadratic") != 0);

    /* `table` is used for probing modes' flat view AND, for chaining
       mode, holds each bucket's chain HEAD key (or -1 if empty) purely
       for the snapshot array sent in each trace step; the real data
       lives in `chains[]` so nothing is ever dropped. */
    int *table = (int*)malloc(sizeof(int) * table_size);
    for (int i = 0; i < table_size; i++) table[i] = -1;

    ChainNode **chains = NULL;
    if (is_chaining) {
        chains = (ChainNode**)calloc(table_size, sizeof(ChainNode*));
    }

    /* Populate initial keys with the selected collision resolution */
    for (int k = 0; k < size; k++) {
        int item = keys[k];
        int h = (item >= 0 ? item : -item) % table_size;
        if (strcmp(collision_mode, "linear") == 0) {
            for (int i = 0; i < table_size; i++) {
                int slot = (h + i) % table_size;
                if (table[slot] == -1) {
                    table[slot] = item;
                    break;
                }
            }
        } else if (strcmp(collision_mode, "quadratic") == 0) {
            for (int i = 0; i < table_size; i++) {
                int slot = (h + i * i) % table_size;
                if (table[slot] == -1) {
                    table[slot] = item;
                    break;
                }
            }
        } else {
            /* Real separate chaining: always append, never drop. */
            if (!chain_contains(chains[h], item)) {
                chain_push_front(&chains[h], item);
            }
            table[h] = chains[h] ? chains[h]->key : -1; /* head key, for the flat snapshot only */
        }
    }

    double t0 = get_time_us();
    char aux[256];
    snprintf(aux, sizeof(aux), "{\"mode\": \"%s\", \"table_size\": %d}", collision_mode, table_size);
    trace_add_step(tr, "init", "Hash Table initialized with slots [0..size-1]", 1, NULL, 0, table, table_size, aux);

    int primary_hash = (key >= 0 ? key : -key) % table_size;
    char desc[128];
    snprintf(desc, sizeof(desc), "Computing Hash: h(%d) = %d %% %d = %d", key, key, table_size, primary_hash);
    int p_idx[1] = {primary_hash};
    trace_add_step(tr, "hash_calc", desc, 5, p_idx, 1, table, table_size, aux);

    if (strcmp(op, "insert") == 0) {
        if (strcmp(collision_mode, "linear") == 0) {
            bool placed = false;
            for (int i = 0; i < table_size; i++) {
                int slot = (primary_hash + i) % table_size;
                int s_idx[1] = {slot};
                if (table[slot] == -1) {
                    table[slot] = key;
                    snprintf(desc, sizeof(desc), "Slot %d is EMPTY: Inserted key %d (Probed %d times)", slot, key, i);
                    trace_add_step(tr, "insert", desc, 12, s_idx, 1, table, table_size, aux);
                    placed = true;
                    break;
                } else {
                    snprintf(desc, sizeof(desc), "COLLISION at slot %d (Occupied by %d). Probing next slot...", slot, table[slot]);
                    trace_add_step(tr, "collision", desc, 16, s_idx, 1, table, table_size, aux);
                }
            }
            if (!placed) {
                trace_add_step(tr, "overflow", "HASH TABLE OVERFLOW: All slots occupied", 20, NULL, 0, table, table_size, aux);
            }
        } else if (strcmp(collision_mode, "quadratic") == 0) {
            bool placed = false;
            for (int i = 0; i < table_size; i++) {
                int slot = (primary_hash + i * i) % table_size;
                int s_idx[1] = {slot};
                if (table[slot] == -1) {
                    table[slot] = key;
                    snprintf(desc, sizeof(desc), "Quadratic Probing (i=%d, offset=%d): Placed key %d at slot %d", i, i * i, key, slot);
                    trace_add_step(tr, "insert", desc, 26, s_idx, 1, table, table_size, aux);
                    placed = true;
                    break;
                } else {
                    snprintf(desc, sizeof(desc), "COLLISION at slot %d. Offset: %d^2 = %d", slot, i, i * i);
                    trace_add_step(tr, "collision", desc, 30, s_idx, 1, table, table_size, aux);
                }
            }
            if (!placed) trace_add_step(tr, "overflow", "Quadratic probing failed to find free slot", 34, NULL, 0, table, table_size, aux);
        } else {
            /* Real Separate Chaining insert: always appends to the
               bucket's chain, so multiple keys in the same bucket are
               preserved instead of silently dropped. */
            bool already_present = chain_contains(chains[primary_hash], key);
            if (already_present) {
                char *chain_aux = chain_to_aux_json(primary_hash, chains[primary_hash], "key already present - no duplicate inserted");
                snprintf(desc, sizeof(desc), "Key %d already exists in bucket %d's chain. No duplicate inserted", key, primary_hash);
                trace_add_step(tr, "duplicate", desc, 38, p_idx, 1, table, table_size, chain_aux);
                free(chain_aux);
            } else {
                int chain_len_before = 0;
                for (ChainNode *c = chains[primary_hash]; c; c = c->next) chain_len_before++;

                if (chain_len_before > 0) {
                    char *chain_aux = chain_to_aux_json(primary_hash, chains[primary_hash], NULL);
                    snprintf(desc, sizeof(desc), "Bucket %d already has %d key(s): APPENDING to chain (not overwriting)", primary_hash, chain_len_before);
                    trace_add_step(tr, "collision", desc, 40, p_idx, 1, table, table_size, chain_aux);
                    free(chain_aux);
                }

                chain_push_front(&chains[primary_hash], key);
                table[primary_hash] = chains[primary_hash]->key;

                char *chain_aux2 = chain_to_aux_json(primary_hash, chains[primary_hash], NULL);
                snprintf(desc, sizeof(desc), "Separate Chaining: Linked new node %d into bucket %d (chain length now %d)", key, primary_hash, chain_len_before + 1);
                trace_add_step(tr, "chain_link", desc, 42, p_idx, 1, table, table_size, chain_aux2);
                free(chain_aux2);
            }
        }
    } else if (strcmp(op, "search") == 0) {
        if (is_chaining) {
            char *chain_aux = chain_to_aux_json(primary_hash, chains[primary_hash], NULL);
            snprintf(desc, sizeof(desc), "Searching bucket %d's chain for key %d", primary_hash, key);
            trace_add_step(tr, "probe", desc, 44, p_idx, 1, table, table_size, chain_aux);
            free(chain_aux);

            bool found = chain_contains(chains[primary_hash], key);
            if (found) {
                char *chain_aux_f = chain_to_aux_json(primary_hash, chains[primary_hash], NULL);
                snprintf(desc, sizeof(desc), "Key %d FOUND in bucket %d's chain!", key, primary_hash);
                trace_add_step(tr, "found", desc, 48, p_idx, 1, table, table_size, chain_aux_f);
                free(chain_aux_f);
            } else {
                trace_add_step(tr, "not_found", "Key NOT FOUND in bucket's chain", 52, NULL, 0, table, table_size, aux);
            }
        } else {
            bool found = false;
            for (int i = 0; i < table_size; i++) {
                int slot = (strcmp(collision_mode, "quadratic") == 0) ? (primary_hash + i * i) % table_size : (primary_hash + i) % table_size;
                int s_idx[1] = {slot};
                snprintf(desc, sizeof(desc), "Probing slot %d (Contains %s)", slot, table[slot] == -1 ? "EMPTY" : "Value");
                trace_add_step(tr, "probe", desc, 46, s_idx, 1, table, table_size, aux);

                if (table[slot] == key) {
                    snprintf(desc, sizeof(desc), "Key %d FOUND at slot %d!", key, slot);
                    trace_add_step(tr, "found", desc, 50, s_idx, 1, table, table_size, aux);
                    found = true;
                    break;
                } else if (table[slot] == -1) {
                    break;
                }
            }
            if (!found) {
                trace_add_step(tr, "not_found", "Key NOT FOUND in hash table", 56, NULL, 0, table, table_size, aux);
            }
        }
    }

    tr->execution_time_us = get_time_us() - t0;

    if (chains) {
        for (int i = 0; i < table_size; i++) chain_free(chains[i]);
        free(chains);
    }
    free(table);
    return tr;
}
