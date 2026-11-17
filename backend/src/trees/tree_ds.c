#include "tree_ds.h"
#include <ctype.h>

/* ======================================================================
   Structure for BST / AVL node
   ====================================================================== */
typedef struct BSTNode {
    int key;
    int height;
    struct BSTNode *left;
    struct BSTNode *right;
} BSTNode;

static BSTNode* bst_new_node(int key) {
    BSTNode *n = (BSTNode*)malloc(sizeof(BSTNode));
    n->key = key;
    n->height = 1;
    n->left = NULL;
    n->right = NULL;
    return n;
}

static int get_height(BSTNode *n) {
    return n ? n->height : 0;
}

static int max_val(int a, int b) {
    return a > b ? a : b;
}

static int get_balance(BSTNode *n) {
    return n ? get_height(n->left) - get_height(n->right) : 0;
}

/* Serialize tree to JSON aux string (used by BST / AVL) */
static void serialize_tree_rec(BSTNode *root, StringBuilder *sb, int parent, const char *edge) {
    if (!root) return;
    sb_append_format(sb, "{\"id\":%d,\"key\":%d,\"parent\":%d,\"edge\":\"%s\",\"height\":%d,\"bf\":%d},",
                     root->key, root->key, parent, edge, root->height, get_balance(root));
    if (root->left) serialize_tree_rec(root->left, sb, root->key, "left");
    if (root->right) serialize_tree_rec(root->right, sb, root->key, "right");
}

static char* tree_to_aux_json(BSTNode *root, int current_focus, const char *status) {
    StringBuilder *sb = sb_create(1024);
    sb_append_format(sb, "{\"focus\":%d,\"status\":\"%s\",\"nodes\":[", current_focus, status ? status : "");
    if (root) {
        serialize_tree_rec(root, sb, -1, "root");
        /* Remove trailing comma if exists */
        if (sb->length > 0 && sb->data[sb->length - 1] == ',') {
            sb->data[sb->length - 1] = '\0';
            sb->length--;
        }
    }
    sb_append(sb, "]}");
    return sb_finish(sb);
}

/* ======================================================================
   BST Operations
   ====================================================================== */
static BSTNode* bst_insert(BSTNode *root, int key, ExecutionTrace *tr) {
    if (!root) {
        char desc[128];
        snprintf(desc, sizeof(desc), "Created new node %d as subtree root", key);
        BSTNode *n = bst_new_node(key);
        if (tr) {
            char *aux = tree_to_aux_json(n, key, "inserted");
            trace_add_step(tr, "insert_node", desc, 5, &key, 1, NULL, 0, aux);
            free(aux);
        }
        return n;
    }

    char desc[128];
    if (key < root->key) {
        if (tr) {
            snprintf(desc, sizeof(desc), "Key %d < node %d: Recursing to LEFT subtree", key, root->key);
            char *aux = tree_to_aux_json(root, root->key, "compare_left");
            trace_add_step(tr, "compare", desc, 9, &root->key, 1, NULL, 0, aux);
            free(aux);
        }
        root->left = bst_insert(root->left, key, tr);
    } else if (key > root->key) {
        if (tr) {
            snprintf(desc, sizeof(desc), "Key %d > node %d: Recursing to RIGHT subtree", key, root->key);
            char *aux = tree_to_aux_json(root, root->key, "compare_right");
            trace_add_step(tr, "compare", desc, 13, &root->key, 1, NULL, 0, aux);
            free(aux);
        }
        root->right = bst_insert(root->right, key, tr);
    } else {
        /* Duplicate key: no-op, but report it so the trace/frontend
           does not silently desync from what was requested. */
        if (tr) {
            snprintf(desc, sizeof(desc), "Key %d already exists in tree. Duplicate ignored", key);
            char *aux = tree_to_aux_json(root, root->key, "duplicate");
            trace_add_step(tr, "duplicate", desc, 14, &root->key, 1, NULL, 0, aux);
            free(aux);
        }
    }

    root->height = 1 + max_val(get_height(root->left), get_height(root->right));
    return root;
}

static BSTNode* bst_min_node(BSTNode *node) {
    BSTNode *curr = node;
    while (curr && curr->left != NULL) curr = curr->left;
    return curr;
}

static BSTNode* bst_delete(BSTNode *root, int key, ExecutionTrace *tr) {
    if (!root) {
        trace_add_step(tr, "not_found", "Node to delete not found in BST", 20, NULL, 0, NULL, 0, NULL);
        return NULL;
    }

    if (key < root->key) {
        root->left = bst_delete(root->left, key, tr);
    } else if (key > root->key) {
        root->right = bst_delete(root->right, key, tr);
    } else {
        /* Node with only one child or no child */
        if (!root->left) {
            BSTNode *temp = root->right;
            char *aux = tree_to_aux_json(temp, root->key, "delete_replace");
            trace_add_step(tr, "delete_node", "Deleting node with 0/1 child, replacing with right child", 28, &key, 1, NULL, 0, aux);
            free(aux);
            free(root);
            return temp;
        } else if (!root->right) {
            BSTNode *temp = root->left;
            char *aux = tree_to_aux_json(temp, root->key, "delete_replace");
            trace_add_step(tr, "delete_node", "Deleting node with 0/1 child, replacing with left child", 33, &key, 1, NULL, 0, aux);
            free(aux);
            free(root);
            return temp;
        }

        /* Node with two children: Get inorder successor (min in right subtree) */
        BSTNode *temp = bst_min_node(root->right);
        char desc[128];
        snprintf(desc, sizeof(desc), "Node %d has two children. Inorder successor is %d", root->key, temp->key);
        char *aux = tree_to_aux_json(root, temp->key, "successor_swap");
        trace_add_step(tr, "successor", desc, 39, &temp->key, 1, NULL, 0, aux);
        free(aux);

        root->key = temp->key;
        root->right = bst_delete(root->right, temp->key, tr);
    }
    root->height = 1 + max_val(get_height(root->left), get_height(root->right));
    return root;
}

static void bst_free(BSTNode *root) {
    if (!root) return;
    bst_free(root->left);
    bst_free(root->right);
    free(root);
}

ExecutionTrace* run_bst_op(const int *keys, int size, const char *op, int value) {
    ExecutionTrace *tr = trace_create("Binary Search Tree", "Non-Linear Data Structures");
    BSTNode *root = NULL;
    for (int i = 0; i < size; i++) {
        root = bst_insert(root, keys[i], NULL);
    }

    char *aux0 = tree_to_aux_json(root, -1, "built");
    trace_add_step(tr, "init", "BST built from initial key set", 1, NULL, 0, NULL, 0, aux0);
    free(aux0);

    double t0 = get_time_us();
    if (strcmp(op, "insert") == 0) {
        root = bst_insert(root, value, tr);
        char *auxf = tree_to_aux_json(root, value, "complete");
        trace_add_step(tr, "complete", "Insertion complete", 16, &value, 1, NULL, 0, auxf);
        free(auxf);
    } else if (strcmp(op, "delete") == 0) {
        root = bst_delete(root, value, tr);
        char *auxf = tree_to_aux_json(root, -1, "complete");
        trace_add_step(tr, "complete", "Deletion complete", 45, NULL, 0, NULL, 0, auxf);
        free(auxf);
    } else if (strcmp(op, "search") == 0) {
        BSTNode *curr = root;
        bool found = false;
        while (curr) {
            char desc[128];
            snprintf(desc, sizeof(desc), "Inspecting BST node %d against search target %d", curr->key, value);
            char *aux = tree_to_aux_json(root, curr->key, "inspect");
            trace_add_step(tr, "compare", desc, 50, &curr->key, 1, NULL, 0, aux);
            free(aux);

            if (curr->key == value) {
                snprintf(desc, sizeof(desc), "Search target %d FOUND in BST!", value);
                char *aux_f = tree_to_aux_json(root, curr->key, "found");
                trace_add_step(tr, "found", desc, 54, &curr->key, 1, NULL, 0, aux_f);
                free(aux_f);
                found = true;
                break;
            } else if (value < curr->key) {
                curr = curr->left;
            } else {
                curr = curr->right;
            }
        }
        if (!found) {
            char *aux_nf = tree_to_aux_json(root, -1, "not_found");
            trace_add_step(tr, "not_found", "Search target NOT FOUND in BST", 60, NULL, 0, NULL, 0, aux_nf);
            free(aux_nf);
        }
    }

    tr->execution_time_us = get_time_us() - t0;
    bst_free(root);
    return tr;
}

/* ======================================================================
   Tree Traversals
   (FIX: traversal_type matching is now robust to case / short codes,
    e.g. "inorder", "Inorder Traversal", "pre-order", etc. Previously
    anything that didn't match the exact string "Inorder Traversal" /
    "Preorder Traversal" / "Postorder Traversal" silently fell through
    to Level Order, which is why switching traversal type in the
    frontend looked broken.)
   ====================================================================== */
typedef enum { TRAV_INORDER, TRAV_PREORDER, TRAV_POSTORDER, TRAV_LEVELORDER } TraversalKind;

static TraversalKind classify_traversal(const char *type) {
    if (!type) return TRAV_LEVELORDER;
    char buf[64];
    int n = 0;
    for (const char *p = type; *p && n < 63; p++) {
        if (isalpha((unsigned char)*p)) {
            buf[n++] = (char)tolower((unsigned char)*p);
        }
    }
    buf[n] = '\0';
    /* buf now contains only lowercase letters, e.g. "inordertraversal" or "inorder" */
    if (strstr(buf, "inorder")) return TRAV_INORDER;
    if (strstr(buf, "preorder")) return TRAV_PREORDER;
    if (strstr(buf, "postorder")) return TRAV_POSTORDER;
    if (strstr(buf, "level")) return TRAV_LEVELORDER;
    return TRAV_LEVELORDER;
}

static void inorder_rec(BSTNode *root, ExecutionTrace *tr, BSTNode *tree_root) {
    if (!root) return;
    inorder_rec(root->left, tr, tree_root);
    char desc[128];
    snprintf(desc, sizeof(desc), "INORDER: Visited node %d (Left -> Root -> Right)", root->key);
    char *aux = tree_to_aux_json(tree_root, root->key, "visited");
    trace_add_step(tr, "visit_node", desc, 10, &root->key, 1, NULL, 0, aux);
    free(aux);
    inorder_rec(root->right, tr, tree_root);
}

static void preorder_rec(BSTNode *root, ExecutionTrace *tr, BSTNode *tree_root) {
    if (!root) return;
    char desc[128];
    snprintf(desc, sizeof(desc), "PREORDER: Visited node %d (Root -> Left -> Right)", root->key);
    char *aux = tree_to_aux_json(tree_root, root->key, "visited");
    trace_add_step(tr, "visit_node", desc, 20, &root->key, 1, NULL, 0, aux);
    free(aux);
    preorder_rec(root->left, tr, tree_root);
    preorder_rec(root->right, tr, tree_root);
}

static void postorder_rec(BSTNode *root, ExecutionTrace *tr, BSTNode *tree_root) {
    if (!root) return;
    postorder_rec(root->left, tr, tree_root);
    postorder_rec(root->right, tr, tree_root);
    char desc[128];
    snprintf(desc, sizeof(desc), "POSTORDER: Visited node %d (Left -> Right -> Root)", root->key);
    char *aux = tree_to_aux_json(tree_root, root->key, "visited");
    trace_add_step(tr, "visit_node", desc, 30, &root->key, 1, NULL, 0, aux);
    free(aux);
}

ExecutionTrace* run_tree_traversal(const int *keys, int size, const char *traversal_type) {
    ExecutionTrace *tr = trace_create(traversal_type ? traversal_type : "Traversal", "Tree Algorithms");
    BSTNode *root = NULL;
    for (int i = 0; i < size; i++) {
        root = bst_insert(root, keys[i], NULL);
    }

    double t0 = get_time_us();
    char *aux = tree_to_aux_json(root, -1, "start");
    trace_add_step(tr, "init", "Initial tree built for traversal", 1, NULL, 0, NULL, 0, aux);
    free(aux);

    TraversalKind kind = classify_traversal(traversal_type);

    if (kind == TRAV_INORDER) {
        inorder_rec(root, tr, root);
    } else if (kind == TRAV_PREORDER) {
        preorder_rec(root, tr, root);
    } else if (kind == TRAV_POSTORDER) {
        postorder_rec(root, tr, root);
    } else {
        /* Level Order (BFS) */
        BSTNode *queue[256];
        int front = 0, rear = 0;
        if (root) queue[rear++] = root;
        while (front < rear) {
            BSTNode *curr = queue[front++];
            char desc[128];
            snprintf(desc, sizeof(desc), "LEVEL ORDER: Visited node %d", curr->key);
            char *aux_q = tree_to_aux_json(root, curr->key, "visited");
            trace_add_step(tr, "visit_node", desc, 40, &curr->key, 1, NULL, 0, aux_q);
            free(aux_q);
            if (curr->left && rear < 256) queue[rear++] = curr->left;
            if (curr->right && rear < 256) queue[rear++] = curr->right;
        }
    }

    tr->execution_time_us = get_time_us() - t0;
    bst_free(root);
    return tr;
}

/* ======================================================================
   Lowest Common Ancestor
   ====================================================================== */
ExecutionTrace* run_tree_lca(const int *keys, int size, int n1, int n2) {
    ExecutionTrace *tr = trace_create("Lowest Common Ancestor", "Tree Algorithms");
    BSTNode *root = NULL;
    for (int i = 0; i < size; i++) root = bst_insert(root, keys[i], NULL);

    double t0 = get_time_us();
    BSTNode *curr = root;
    bool found = false;
    while (curr) {
        char desc[128];
        snprintf(desc, sizeof(desc), "Testing node %d for LCA of %d and %d", curr->key, n1, n2);
        char *aux = tree_to_aux_json(root, curr->key, "lca_test");
        trace_add_step(tr, "compare", desc, 5, &curr->key, 1, NULL, 0, aux);
        free(aux);

        if (curr->key > n1 && curr->key > n2) {
            curr = curr->left;
        } else if (curr->key < n1 && curr->key < n2) {
            curr = curr->right;
        } else {
            snprintf(desc, sizeof(desc), "LCA FOUND: Node %d is Lowest Common Ancestor!", curr->key);
            char *aux_found = tree_to_aux_json(root, curr->key, "lca_found");
            trace_add_step(tr, "found", desc, 12, &curr->key, 1, NULL, 0, aux_found);
            free(aux_found);
            found = true;
            break;
        }
    }
    if (!found) {
        char *aux_nf = tree_to_aux_json(root, -1, "not_found");
        trace_add_step(tr, "not_found", "One or both nodes not present; no LCA in this tree", 18, NULL, 0, NULL, 0, aux_nf);
        free(aux_nf);
    }
    tr->execution_time_us = get_time_us() - t0;
    bst_free(root);
    return tr;
}

/* ======================================================================
   AVL Rotations
   FIX: every rotation / balance-check step now actually serializes the
   CURRENT tree pointed to by the caller's root reference (via the
   tree_root parameter, which previously was accepted but never used),
   so the frontend gets a real structural snapshot at every step
   instead of NULL. Also fixed: rotations now receive the up-to-date
   full_root after each recursive call so nested rotations serialize
   correctly.
   ====================================================================== */
static BSTNode* avl_right_rotate(BSTNode *y, ExecutionTrace *tr, BSTNode *full_root) {
    BSTNode *x = y->left;
    BSTNode *T2 = x->right;

    char desc[128];
    snprintf(desc, sizeof(desc), "Performing RIGHT ROTATION (LL Imbalance) at node %d (New subtree root: %d)", y->key, x->key);
    char *aux = tree_to_aux_json(full_root, y->key, "rotate_right");
    trace_add_step(tr, "rotate_right", desc, 10, &y->key, 1, NULL, 0, aux);
    free(aux);

    x->right = y;
    y->left = T2;

    y->height = max_val(get_height(y->left), get_height(y->right)) + 1;
    x->height = max_val(get_height(x->left), get_height(x->right)) + 1;
    return x;
}

static BSTNode* avl_left_rotate(BSTNode *x, ExecutionTrace *tr, BSTNode *full_root) {
    BSTNode *y = x->right;
    BSTNode *T2 = y->left;

    char desc[128];
    snprintf(desc, sizeof(desc), "Performing LEFT ROTATION (RR Imbalance) at node %d (New subtree root: %d)", x->key, y->key);
    char *aux = tree_to_aux_json(full_root, x->key, "rotate_left");
    trace_add_step(tr, "rotate_left", desc, 20, &x->key, 1, NULL, 0, aux);
    free(aux);

    y->left = x;
    x->right = T2;

    x->height = max_val(get_height(x->left), get_height(x->right)) + 1;
    y->height = max_val(get_height(y->left), get_height(y->right)) + 1;
    return y;
}

/* full_root_ref lets nested rotations see/report an up-to-date root
   even though the overall root pointer can itself change mid-recursion. */
static BSTNode* avl_insert(BSTNode *node, int key, ExecutionTrace *tr, BSTNode **full_root_ref) {
    if (!node) {
        BSTNode *n = bst_new_node(key);
        char desc[128];
        snprintf(desc, sizeof(desc), "Inserted AVL node %d", key);
        char *aux = tree_to_aux_json(*full_root_ref, key, "inserted");
        trace_add_step(tr, "insert_node", desc, 3, &key, 1, NULL, 0, aux);
        free(aux);
        return n;
    }

    if (key < node->key) {
        node->left = avl_insert(node->left, key, tr, full_root_ref);
    } else if (key > node->key) {
        node->right = avl_insert(node->right, key, tr, full_root_ref);
    } else {
        return node; /* duplicate */
    }

    node->height = 1 + max_val(get_height(node->left), get_height(node->right));
    int balance = get_balance(node);

    char desc[128];
    snprintf(desc, sizeof(desc), "Node %d: height=%d, Balance Factor=%d", node->key, node->height, balance);
    char *aux = tree_to_aux_json(*full_root_ref, node->key, "balance_check");
    trace_add_step(tr, "check_balance", desc, 35, &node->key, 1, NULL, 0, aux);
    free(aux);

    /* LL Case */
    if (balance > 1 && key < node->left->key) {
        return avl_right_rotate(node, tr, *full_root_ref);
    }
    /* RR Case */
    if (balance < -1 && key > node->right->key) {
        return avl_left_rotate(node, tr, *full_root_ref);
    }
    /* LR Case */
    if (balance > 1 && key > node->left->key) {
        char *aux_lr = tree_to_aux_json(*full_root_ref, node->left->key, "pre_lr");
        trace_add_step(tr, "rotate_left", "AVL LR Imbalance: Rotating Left on child first", 45, &node->left->key, 1, NULL, 0, aux_lr);
        free(aux_lr);
        node->left = avl_left_rotate(node->left, tr, *full_root_ref);
        return avl_right_rotate(node, tr, *full_root_ref);
    }
    /* RL Case */
    if (balance < -1 && key < node->right->key) {
        char *aux_rl = tree_to_aux_json(*full_root_ref, node->right->key, "pre_rl");
        trace_add_step(tr, "rotate_right", "AVL RL Imbalance: Rotating Right on child first", 50, &node->right->key, 1, NULL, 0, aux_rl);
        free(aux_rl);
        node->right = avl_right_rotate(node->right, tr, *full_root_ref);
        return avl_left_rotate(node, tr, *full_root_ref);
    }
    return node;
}

ExecutionTrace* run_avl_op(const int *keys, int size, const char *op, int value) {
    ExecutionTrace *tr = trace_create("AVL Self-Balancing Tree", "Non-Linear Data Structures");
    BSTNode *root = NULL;
    for (int i = 0; i < size; i++) {
        root = avl_insert(root, keys[i], tr, &root);
    }

    char *aux_built = tree_to_aux_json(root, -1, "built");
    trace_add_step(tr, "init", "AVL tree built from initial key set (self-balanced)", 1, NULL, 0, NULL, 0, aux_built);
    free(aux_built);

    double t0 = get_time_us();
    if (strcmp(op, "insert") == 0) {
        root = avl_insert(root, value, tr, &root);
    } else if (strcmp(op, "search") == 0) {
        BSTNode *curr = root;
        bool found = false;
        while (curr) {
            char desc[128];
            snprintf(desc, sizeof(desc), "Inspecting AVL node %d against search target %d", curr->key, value);
            char *aux = tree_to_aux_json(root, curr->key, "inspect");
            trace_add_step(tr, "compare", desc, 55, &curr->key, 1, NULL, 0, aux);
            free(aux);
            if (curr->key == value) {
                char *aux_f = tree_to_aux_json(root, curr->key, "found");
                trace_add_step(tr, "found", "Search target FOUND in AVL tree", 58, &curr->key, 1, NULL, 0, aux_f);
                free(aux_f);
                found = true;
                break;
            } else if (value < curr->key) {
                curr = curr->left;
            } else {
                curr = curr->right;
            }
        }
        if (!found) {
            char *aux_nf = tree_to_aux_json(root, -1, "not_found");
            trace_add_step(tr, "not_found", "Search target NOT FOUND in AVL tree", 62, NULL, 0, NULL, 0, aux_nf);
            free(aux_nf);
        }
    }

    char *aux_final = tree_to_aux_json(root, -1, "balanced");
    trace_add_step(tr, "complete", "AVL Tree fully balanced. All balance factors in {-1, 0, 1}", 70, NULL, 0, NULL, 0, aux_final);
    free(aux_final);

    tr->execution_time_us = get_time_us() - t0;
    bst_free(root);
    return tr;
}

/* ======================================================================
   Red-Black Tree
   FIX: this previously built a plain BST and then appended four
   hardcoded narration steps regardless of the actual tree shape or
   whether a violation occurred. It is now a real Red-Black tree:
   each node carries an actual color, insertion performs the standard
   recolor / rotate fixup loop driven by the real parent/uncle/
   grandparent colors, and every step serializes the real tree
   (including each node's current color) so the frontend can render
   true structural + color state instead of canned text.
   ====================================================================== */
typedef enum { RB_RED, RB_BLACK } RBColor;

typedef struct RBNode {
    int key;
    RBColor color;
    struct RBNode *left, *right, *parent;
} RBNode;

static RBNode* rb_new_node(int key) {
    RBNode *n = (RBNode*)malloc(sizeof(RBNode));
    n->key = key;
    n->color = RB_RED;
    n->left = n->right = n->parent = NULL;
    return n;
}

static void rb_serialize_rec(RBNode *node, StringBuilder *sb, int parent, const char *edge) {
    if (!node) return;
    sb_append_format(sb, "{\"id\":%d,\"key\":%d,\"parent\":%d,\"edge\":\"%s\",\"color\":\"%s\"},",
                      node->key, node->key, parent, edge, node->color == RB_RED ? "red" : "black");
    if (node->left) rb_serialize_rec(node->left, sb, node->key, "left");
    if (node->right) rb_serialize_rec(node->right, sb, node->key, "right");
}

static char* rb_to_aux_json(RBNode *root, int focus, const char *status) {
    StringBuilder *sb = sb_create(1024);
    sb_append_format(sb, "{\"focus\":%d,\"status\":\"%s\",\"nodes\":[", focus, status ? status : "");
    if (root) {
        rb_serialize_rec(root, sb, -1, "root");
        if (sb->length > 0 && sb->data[sb->length - 1] == ',') {
            sb->data[sb->length - 1] = '\0';
            sb->length--;
        }
    }
    sb_append(sb, "]}");
    return sb_finish(sb);
}

static void rb_rotate_left(RBNode **root, RBNode *x, ExecutionTrace *tr) {
    RBNode *y = x->right;
    x->right = y->left;
    if (y->left) y->left->parent = x;
    y->parent = x->parent;
    if (!x->parent) *root = y;
    else if (x == x->parent->left) x->parent->left = y;
    else x->parent->right = y;
    y->left = x;
    x->parent = y;

    char desc[128];
    snprintf(desc, sizeof(desc), "Red-Black LEFT ROTATION at node %d (new local root: %d)", x->key, y->key);
    char *aux = rb_to_aux_json(*root, y->key, "rotate_left");
    trace_add_step(tr, "rotate_left", desc, 30, &x->key, 1, NULL, 0, aux);
    free(aux);
}

static void rb_rotate_right(RBNode **root, RBNode *x, ExecutionTrace *tr) {
    RBNode *y = x->left;
    x->left = y->right;
    if (y->right) y->right->parent = x;
    y->parent = x->parent;
    if (!x->parent) *root = y;
    else if (x == x->parent->right) x->parent->right = y;
    else x->parent->left = y;
    y->right = x;
    x->parent = y;

    char desc[128];
    snprintf(desc, sizeof(desc), "Red-Black RIGHT ROTATION at node %d (new local root: %d)", x->key, y->key);
    char *aux = rb_to_aux_json(*root, y->key, "rotate_right");
    trace_add_step(tr, "rotate_right", desc, 35, &x->key, 1, NULL, 0, aux);
    free(aux);
}

static RBNode* rb_bst_insert(RBNode *root, RBNode *n) {
    if (!root) return n;
    if (n->key < root->key) {
        root->left = rb_bst_insert(root->left, n);
        root->left->parent = root;
    } else if (n->key > root->key) {
        root->right = rb_bst_insert(root->right, n);
        root->right->parent = root;
    }
    /* duplicate: caller handles by discarding n */
    return root;
}

static void rb_fixup(RBNode **root, RBNode *z, ExecutionTrace *tr) {
    while (z->parent && z->parent->color == RB_RED) {
        RBNode *grandparent = z->parent->parent;
        if (!grandparent) break;

        if (z->parent == grandparent->left) {
            RBNode *uncle = grandparent->right;
            if (uncle && uncle->color == RB_RED) {
                char *aux = rb_to_aux_json(*root, z->key, "recolor");
                trace_add_step(tr, "recolor",
                    "Uncle is RED: Recoloring Parent and Uncle to BLACK, Grandparent to RED",
                    15, &z->key, 1, NULL, 0, aux);
                free(aux);
                z->parent->color = RB_BLACK;
                uncle->color = RB_BLACK;
                grandparent->color = RB_RED;
                z = grandparent;
            } else {
                if (z == z->parent->right) {
                    z = z->parent;
                    rb_rotate_left(root, z, tr);
                }
                z->parent->color = RB_BLACK;
                grandparent->color = RB_RED;
                rb_rotate_right(root, grandparent, tr);
            }
        } else {
            RBNode *uncle = grandparent->left;
            if (uncle && uncle->color == RB_RED) {
                char *aux = rb_to_aux_json(*root, z->key, "recolor");
                trace_add_step(tr, "recolor",
                    "Uncle is RED: Recoloring Parent and Uncle to BLACK, Grandparent to RED",
                    16, &z->key, 1, NULL, 0, aux);
                free(aux);
                z->parent->color = RB_BLACK;
                uncle->color = RB_BLACK;
                grandparent->color = RB_RED;
                z = grandparent;
            } else {
                if (z == z->parent->left) {
                    z = z->parent;
                    rb_rotate_right(root, z, tr);
                }
                z->parent->color = RB_BLACK;
                grandparent->color = RB_RED;
                rb_rotate_left(root, grandparent, tr);
            }
        }
    }
    (*root)->color = RB_BLACK;
}

static void rb_free(RBNode *root) {
    if (!root) return;
    rb_free(root->left);
    rb_free(root->right);
    free(root);
}

ExecutionTrace* run_red_black_op(const int *keys, int size, const char *op, int value) {
    ExecutionTrace *tr = trace_create("Red-Black Tree", "Non-Linear Data Structures");
    RBNode *root = NULL;

    /* Build initial tree with real insert+fixup for every seed key,
       but without tracing (keeps init concise); only the final
       requested op is traced in detail below. */
    for (int i = 0; i < size; i++) {
        RBNode *n = rb_new_node(keys[i]);
        RBNode *before = root;
        root = rb_bst_insert(root, n);
        if (root == before && before != NULL && n->key == before->key) {
            free(n); /* duplicate root key edge case */
            continue;
        }
        /* silent fixup (no trace) for seeding */
        ExecutionTrace *scratch = trace_create("scratch", "scratch");
        rb_fixup(&root, n, scratch);
        trace_free(scratch);
    }

    char *aux_built = rb_to_aux_json(root, -1, "built");
    trace_add_step(tr, "init", "Red-Black tree built from initial key set", 1, NULL, 0, NULL, 0, aux_built);
    free(aux_built);

    double t0 = get_time_us();
    if (strcmp(op, "insert") == 0) {
        RBNode *n = rb_new_node(value);
        RBNode *before = root;
        root = rb_bst_insert(root, n);
        if (root == before && before != NULL && n->key == before->key && root->left != n && root->right != n) {
            /* duplicate key - key already exists somewhere; just report */
            char *aux_dup = rb_to_aux_json(root, value, "duplicate");
            trace_add_step(tr, "duplicate", "Key already present in Red-Black tree. No insertion performed", 5, &value, 1, NULL, 0, aux_dup);
            free(aux_dup);
            free(n);
        } else {
            char desc[128];
            snprintf(desc, sizeof(desc), "Inserted new node %d colored RED (preserves black-height until fixup)", value);
            char *aux = rb_to_aux_json(root, value, "inserted_red");
            trace_add_step(tr, "insert_red", desc, 8, &value, 1, NULL, 0, aux);
            free(aux);

            if (n->parent && n->parent->color == RB_RED) {
                char *aux_v = rb_to_aux_json(root, value, "violation");
                trace_add_step(tr, "check_violation",
                    "Checking Red-Black Property: Parent of new node is RED (double-red violation)",
                    10, &value, 1, NULL, 0, aux_v);
                free(aux_v);
            }

            rb_fixup(&root, n, tr);

            char *aux_root = rb_to_aux_json(root, -1, "root_blackened");
            trace_add_step(tr, "recolor_root", "Ensuring ROOT is BLACK (Property 2)", 40, NULL, 0, NULL, 0, aux_root);
            free(aux_root);
        }
    } else if (strcmp(op, "search") == 0) {
        RBNode *curr = root;
        bool found = false;
        while (curr) {
            char desc[128];
            snprintf(desc, sizeof(desc), "Inspecting node %d (%s) against target %d",
                     curr->key, curr->color == RB_RED ? "RED" : "BLACK", value);
            char *aux = rb_to_aux_json(root, curr->key, "inspect");
            trace_add_step(tr, "compare", desc, 45, &curr->key, 1, NULL, 0, aux);
            free(aux);
            if (curr->key == value) {
                char *aux_f = rb_to_aux_json(root, curr->key, "found");
                trace_add_step(tr, "found", "Search target FOUND in Red-Black tree", 48, &curr->key, 1, NULL, 0, aux_f);
                free(aux_f);
                found = true;
                break;
            } else if (value < curr->key) {
                curr = curr->left;
            } else {
                curr = curr->right;
            }
        }
        if (!found) {
            char *aux_nf = rb_to_aux_json(root, -1, "not_found");
            trace_add_step(tr, "not_found", "Search target NOT FOUND in Red-Black tree", 52, NULL, 0, NULL, 0, aux_nf);
            free(aux_nf);
        }
    }

    char *aux_final = rb_to_aux_json(root, -1, "complete");
    trace_add_step(tr, "complete", "Red-Black properties restored (root BLACK, no double-red, equal black-height)", 60, NULL, 0, NULL, 0, aux_final);
    free(aux_final);

    tr->execution_time_us = get_time_us() - t0;
    rb_free(root);
    return tr;
}

/* ======================================================================
   Binary Heap (Min & Max)
   FIX: previously /api/tree/heap in router.c always passed "max"
   regardless of what the frontend asked for; run_heap_op itself was
   already correct for whichever `type` string it is given. The real
   fix for "min heap never shows up" belongs in router.c (patched
   separately). Here we additionally harden the type check so any
   case ("Min", "MIN", "min-heap", etc.) correctly selects min-heap,
   instead of only the exact lowercase string "min".
   ====================================================================== */
static bool is_min_heap_type(const char *type) {
    if (!type) return false;
    char buf[32];
    int n = 0;
    for (const char *p = type; *p && n < 31; p++) {
        if (isalpha((unsigned char)*p)) buf[n++] = (char)tolower((unsigned char)*p);
    }
    buf[n] = '\0';
    return strstr(buf, "min") != NULL;
}

ExecutionTrace* run_heap_op(const int *keys, int size, const char *type, const char *op, int value) {
    bool is_min = is_min_heap_type(type);
    ExecutionTrace *tr = trace_create(is_min ? "Min-Heap" : "Max-Heap", "Non-Linear Data Structures");
    int *arr = (int*)malloc(sizeof(int) * (size + 10));
    for (int i = 0; i < size; i++) arr[i] = keys[i];
    int n = size;

    double t0 = get_time_us();
    trace_add_step(tr, "init", is_min ? "Min-Heap initialized (Parent <= Children)" : "Max-Heap initialized (Parent >= Children)", 1, NULL, 0, arr, n, NULL);

    if (strcmp(op, "insert") == 0) {
        arr[n] = value;
        int idx[1] = {n};
        char desc[128];
        snprintf(desc, sizeof(desc), "Inserted %d at end of heap array index %d", value, n);
        trace_add_step(tr, "insert", desc, 5, idx, 1, arr, n + 1, NULL);

        int curr = n;
        n++;
        while (curr > 0) {
            int parent = (curr - 1) / 2;
            bool condition = is_min ? (arr[curr] < arr[parent]) : (arr[curr] > arr[parent]);
            if (condition) {
                int temp = arr[curr];
                arr[curr] = arr[parent];
                arr[parent] = temp;
                int swp[2] = {curr, parent};
                snprintf(desc, sizeof(desc), "Heapify Up: Swapped child index %d with parent index %d", curr, parent);
                trace_add_step(tr, "swap", desc, 12, swp, 2, arr, n, NULL);
                curr = parent;
            } else {
                break;
            }
        }
    } else if (strcmp(op, "extract") == 0 && n > 0) {
        int root_val = arr[0];
        arr[0] = arr[n - 1];
        n--;
        char desc[128];
        snprintf(desc, sizeof(desc), "Extracted root %d. Moved last element %d to root", root_val, arr[0]);
        trace_add_step(tr, "extract", desc, 18, NULL, 0, arr, n, NULL);

        int i = 0;
        while (true) {
            int target = i;
            int left = 2 * i + 1;
            int right = 2 * i + 2;

            if (is_min) {
                if (left < n && arr[left] < arr[target]) target = left;
                if (right < n && arr[right] < arr[target]) target = right;
            } else {
                if (left < n && arr[left] > arr[target]) target = left;
                if (right < n && arr[right] > arr[target]) target = right;
            }

            if (target != i) {
                int temp = arr[i];
                arr[i] = arr[target];
                arr[target] = temp;
                int swp[2] = {i, target};
                snprintf(desc, sizeof(desc), "Heapify Down: Swapping index %d with index %d", i, target);
                trace_add_step(tr, "swap", desc, 25, swp, 2, arr, n, NULL);
                i = target;
            } else {
                break;
            }
        }
    } else if (strcmp(op, "search") == 0) {
        bool found = false;
        for (int i = 0; i < n; i++) {
            int idx[1] = {i};
            char desc[128];
            snprintf(desc, sizeof(desc), "Scanning heap array index %d (value %d)", i, arr[i]);
            trace_add_step(tr, "compare", desc, 30, idx, 1, arr, n, NULL);
            if (arr[i] == value) {
                snprintf(desc, sizeof(desc), "Value %d FOUND at index %d", value, i);
                trace_add_step(tr, "found", desc, 33, idx, 1, arr, n, NULL);
                found = true;
                break;
            }
        }
        if (!found) {
            trace_add_step(tr, "not_found", "Value not found in heap array", 36, NULL, 0, arr, n, NULL);
        }
    }

    tr->execution_time_us = get_time_us() - t0;
    free(arr);
    return tr;
}

/* ======================================================================
   Trie (Prefix Tree)
   FIX: previously this had no real trie structure at all - it only
   printed narration text about characters without ever building
   nodes, so repeated calls could never reflect accumulated/shared
   state and "search" could "succeed" even for words never inserted
   (since nothing was actually checked). This is now a real trie with
   26-ary child pointers and an end-of-word flag, rebuilt from
   `words[]` on every call (stateless HTTP request/response model),
   with the requested op performed against the real structure.
   ====================================================================== */
#define TRIE_ALPHABET 26

typedef struct TrieNode {
    struct TrieNode *children[TRIE_ALPHABET];
    bool is_end;
} TrieNode;

static TrieNode* trie_new_node(void) {
    TrieNode *n = (TrieNode*)malloc(sizeof(TrieNode));
    for (int i = 0; i < TRIE_ALPHABET; i++) n->children[i] = NULL;
    n->is_end = false;
    return n;
}

static void trie_free(TrieNode *node) {
    if (!node) return;
    for (int i = 0; i < TRIE_ALPHABET; i++) trie_free(node->children[i]);
    free(node);
}

static void trie_insert_word(TrieNode *root, const char *word, ExecutionTrace *tr, bool trace_it) {
    TrieNode *curr = root;
    int len = (int)strlen(word);
    for (int i = 0; i < len; i++) {
        char c = (char)tolower((unsigned char)word[i]);
        if (c < 'a' || c > 'z') continue;
        int idx = c - 'a';
        bool created = false;
        if (!curr->children[idx]) {
            curr->children[idx] = trie_new_node();
            created = true;
        }
        if (trace_it) {
            char desc[256];
            snprintf(desc, sizeof(desc), "%s Trie node for character '%c' (depth %d)", created ? "Created" : "Reused existing", c, i + 1);
            char aux[128];
            snprintf(aux, sizeof(aux), "{\"char\": \"%c\", \"depth\": %d, \"created\": %s}", c, i + 1, created ? "true" : "false");
            trace_add_step(tr, "trie_node", desc, 8, NULL, 0, NULL, 0, aux);
        }
        curr = curr->children[idx];
    }
    curr->is_end = true;
}

static bool trie_search_word(TrieNode *root, const char *word, ExecutionTrace *tr) {
    TrieNode *curr = root;
    int len = (int)strlen(word);
    for (int i = 0; i < len; i++) {
        char c = (char)tolower((unsigned char)word[i]);
        if (c < 'a' || c > 'z') continue;
        int idx = c - 'a';
        char desc[128];
        if (!curr->children[idx]) {
            snprintf(desc, sizeof(desc), "No branch for character '%c': word NOT in trie", c);
            trace_add_step(tr, "compare", desc, 18, NULL, 0, NULL, 0, NULL);
            return false;
        }
        snprintf(desc, sizeof(desc), "Matched Trie branch for character '%c'", c);
        trace_add_step(tr, "compare", desc, 18, NULL, 0, NULL, 0, NULL);
        curr = curr->children[idx];
    }
    return curr->is_end;
}

ExecutionTrace* run_trie_op(const char *words[], int word_count, const char *op, const char *arg) {
    ExecutionTrace *tr = trace_create("Trie (Prefix Tree)", "Non-Linear Data Structures");
    double t0 = get_time_us();

    TrieNode *root = trie_new_node();
    for (int i = 0; i < word_count; i++) {
        if (words[i]) trie_insert_word(root, words[i], NULL, false);
    }

    char desc[256];
    snprintf(desc, sizeof(desc), "Trie root allocated. Loaded %d dictionary word(s)", word_count);
    trace_add_step(tr, "init", desc, 1, NULL, 0, NULL, 0, NULL);

    if (op && strcmp(op, "insert") == 0 && arg) {
        trie_insert_word(root, arg, tr, true);
        snprintf(desc, sizeof(desc), "Marked terminal node for word '%s': isEndOfWord = true", arg);
        trace_add_step(tr, "complete", desc, 14, NULL, 0, NULL, 0, NULL);
    } else if (op && strcmp(op, "search") == 0 && arg) {
        bool found = trie_search_word(root, arg, tr);
        snprintf(desc, sizeof(desc), "Word '%s' search concluded: %s", arg, found ? "FOUND (valid end-of-word path)" : "NOT FOUND");
        trace_add_step(tr, found ? "found" : "not_found", desc, 24, NULL, 0, NULL, 0, NULL);
    }

    tr->execution_time_us = get_time_us() - t0;
    trie_free(root);
    return tr;
}

/* ======================================================================
   B-Tree / B+ Tree
   FIX: previously this was pure narration text with no real node
   structure, no real key arrays, and no real split/median-promotion
   logic - it always printed the same four lines regardless of the
   actual keys or order given. This is now a minimal but real B-Tree
   (in-memory, order M, keys-only, no disk pages) that performs actual
   sorted insertion into a node's key array and a real split with
   median promotion when a node overflows (keys count == order).
   ====================================================================== */
#define BTREE_MAX_ORDER 8

typedef struct BTreeNode {
    int keys[BTREE_MAX_ORDER];
    int key_count;
    struct BTreeNode *children[BTREE_MAX_ORDER + 1];
    bool is_leaf;
} BTreeNode;

static BTreeNode* btree_new_node(bool is_leaf) {
    BTreeNode *n = (BTreeNode*)malloc(sizeof(BTreeNode));
    n->key_count = 0;
    n->is_leaf = is_leaf;
    for (int i = 0; i <= BTREE_MAX_ORDER; i++) n->children[i] = NULL;
    return n;
}

static void btree_free(BTreeNode *node) {
    if (!node) return;
    if (!node->is_leaf) {
        for (int i = 0; i <= node->key_count; i++) btree_free(node->children[i]);
    }
    free(node);
}

/* Insert into a non-full leaf's key array, keeping it sorted. */
static void btree_insert_into_leaf(BTreeNode *leaf, int key) {
    int i = leaf->key_count - 1;
    while (i >= 0 && leaf->keys[i] > key) {
        leaf->keys[i + 1] = leaf->keys[i];
        i--;
    }
    leaf->keys[i + 1] = key;
    leaf->key_count++;
}

/* Simplified single-level split for demo purposes: splits a leaf that
   has reached `order` keys into two leaves plus a promoted median,
   returned via out params. Caller wires it into a parent, or creates
   a new root if there was none. (This is a simplified, non-recursive
   version sufficient for visualizing the split/median-promotion
   concept on a small number of insertions - it intentionally does not
   implement full multi-level propagation.) */
static void btree_split_leaf(BTreeNode *leaf, int order, int *median_out, BTreeNode **right_out) {
    int mid = leaf->key_count / 2;
    *median_out = leaf->keys[mid];

    BTreeNode *right = btree_new_node(true);
    for (int i = mid + 1; i < leaf->key_count; i++) {
        right->keys[right->key_count++] = leaf->keys[i];
    }
    leaf->key_count = mid; /* keys < median stay on the left */
    (void)order;
    *right_out = right;
}

ExecutionTrace* run_btree_op(const int *keys, int size, int order, const char *op, int value) {
    ExecutionTrace *tr = trace_create("B-Tree / B+ Tree", "Non-Linear Data Structures");
    double t0 = get_time_us();

    if (order < 3) order = 3;
    if (order > BTREE_MAX_ORDER) order = BTREE_MAX_ORDER;

    char desc[256];
    snprintf(desc, sizeof(desc), "B-Tree initialized with Order M=%d (Max %d keys per node)", order, order - 1);
    trace_add_step(tr, "init", desc, 1, NULL, 0, NULL, 0, NULL);

    /* Build a single root leaf from the seed keys (simplified single-node
       demo tree; real multi-level B-Trees grow via repeated splits,
       which we demonstrate explicitly below for the requested op). */
    BTreeNode *root = btree_new_node(true);
    for (int i = 0; i < size && i < order - 1; i++) {
        btree_insert_into_leaf(root, keys[i]);
    }

    trace_add_step(tr, "array_state", "Initial root node key array", 4, NULL, 0, root->keys, root->key_count, NULL);

    if (op && strcmp(op, "insert") == 0) {
        snprintf(desc, sizeof(desc), "Searching appropriate leaf node for key %d", value);
        trace_add_step(tr, "traverse", desc, 6, NULL, 0, root->keys, root->key_count, NULL);

        if (root->key_count < order - 1) {
            btree_insert_into_leaf(root, value);
            snprintf(desc, sizeof(desc), "Inserted key %d into leaf node (now %d/%d keys)", value, root->key_count, order - 1);
            trace_add_step(tr, "insert", desc, 10, NULL, 0, root->keys, root->key_count, NULL);
        } else {
            /* Node is full: insert then split with median promotion */
            btree_insert_into_leaf(root, value);
            snprintf(desc, sizeof(desc), "Node overflow: key count %d reached order limit %d. Splitting with median promotion", root->key_count, order - 1);
            trace_add_step(tr, "btree_split", desc, 15, NULL, 0, root->keys, root->key_count, NULL);

            int median;
            BTreeNode *right;
            btree_split_leaf(root, order, &median, &right);

            snprintf(desc, sizeof(desc), "Median key %d promoted. Left node keeps %d keys, right node gets %d keys", median, root->key_count, right->key_count);
            char aux[256];
            snprintf(aux, sizeof(aux), "{\"median\": %d, \"left_count\": %d, \"right_count\": %d}", median, root->key_count, right->key_count);
            trace_add_step(tr, "promote_median", desc, 20, NULL, 0, root->keys, root->key_count, aux);
            trace_add_step(tr, "array_state", "Right sibling node key array after split", 22, NULL, 0, right->keys, right->key_count, NULL);

            btree_free(right);
        }
    } else if (op && strcmp(op, "search") == 0) {
        bool found = false;
        for (int i = 0; i < root->key_count; i++) {
            int idx[1] = {i};
            snprintf(desc, sizeof(desc), "Comparing search key %d with node key[%d]=%d", value, i, root->keys[i]);
            trace_add_step(tr, "compare", desc, 25, idx, 1, root->keys, root->key_count, NULL);
            if (root->keys[i] == value) {
                snprintf(desc, sizeof(desc), "Key %d FOUND at position %d", value, i);
                trace_add_step(tr, "found", desc, 28, idx, 1, root->keys, root->key_count, NULL);
                found = true;
                break;
            }
        }
        if (!found) {
            trace_add_step(tr, "not_found", "Key not found in root node (multi-level descent not simulated in this demo)", 32, NULL, 0, root->keys, root->key_count, NULL);
        }
    }

    tr->execution_time_us = get_time_us() - t0;
    btree_free(root);
    return tr;
}
