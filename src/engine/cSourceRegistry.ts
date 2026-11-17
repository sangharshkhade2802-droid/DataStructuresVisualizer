/* ============================================================
 * PATCH FILE: src/engine/cSourceRegistry.ts
 * ============================================================
 * ACTION: REPLACE THE ENTIRE FILE with the content below.
 *
 * WHY: The original registry only had 5 entries (quick-sort,
 * merge-sort, binary-search, singly-linked-list, avl-tree, dijkstra).
 * Every visualizer that didn't match one of these 5 ids fell back to
 * a hardcoded default (usually 'binary-search', 'singly-linked-list',
 * or 'dijkstra'), which is why:
 *   - All 10 sorting algorithms except quick/merge showed Quick Sort's code
 *   - All 5 searching algorithms except Binary Search showed Binary Search's code
 *   - All 8 linear data structures except singly-linked-list showed its code
 *   - All 8 graph algorithms except Dijkstra showed Dijkstra's code
 *
 * This replacement adds a real, distinct C11 source entry for every
 * single algorithm/structure id used across SortingVisualizer,
 * SearchingVisualizer, LinearVisualizer, GraphVisualizer and
 * TreeVisualizer, each with line numbers that correspond to the
 * `line` field the backend (and the client-mirror in api.ts) emits
 * for that exact function, so CodeViewer's line highlighting lines
 * up with the real action.
 * ============================================================ */

export interface CCodeMetadata {
  id: string;
  title: string;
  category: string;
  code: string;
  sampleInput: string;
  sampleOutput: string;
  keySectionExplanations: { lines: string; title: string; explanation: string }[];
}

export const C_SOURCE_REGISTRY: Record<string, CCodeMetadata> = {
  /* ========================= SORTING ========================= */
  'bubble-sort': {
    id: 'bubble-sort',
    title: 'Bubble Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '5-11', title: 'Adjacent Comparison', explanation: 'Compares each pair of adjacent elements arr[j] and arr[j+1] in the inner loop.' },
      { lines: '12', title: 'Sorted Boundary', explanation: 'After each outer pass, the largest unsorted element has bubbled to its final position.' },
    ],
    code: `/*
 * Bubble Sort Implementation in C11
 * Time Complexity: O(n^2) worst/avg, O(n) best (already sorted)
 * Space Complexity: O(1)
 */
#include <stdio.h>
#include <stdbool.h>

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        for (int j = 0; j < n - i - 1; j++) {
            // Comparing array[j]=arr[j] and array[j+1]=arr[j+1]
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
                swapped = true;
            }
        }
        // Element locked into sorted position at index n-1-i
        if (!swapped) break;
    }
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    bubbleSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'selection-sort': {
    id: 'selection-sort',
    title: 'Selection Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '6-8', title: 'Minimum Tracking', explanation: 'min_idx tracks the position of the smallest element found so far in the unsorted partition.' },
      { lines: '13', title: 'Single Swap Per Pass', explanation: 'Only one swap happens per outer iteration, placing the minimum into position i.' },
    ],
    code: `/*
 * Selection Sort Implementation in C11
 * Time Complexity: O(n^2) all cases
 * Space Complexity: O(1)
 */
#include <stdio.h>

void selectionSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int min_idx = i;
        for (int j = i + 1; j < n; j++) {
            // Checking if array[j] < current minimum array[min_idx]
            if (arr[j] < arr[min_idx]) {
                min_idx = j; // New minimum found
            }
        }
        if (min_idx != i) {
            int temp = arr[i];
            arr[i] = arr[min_idx];
            arr[min_idx] = temp; // Swapping found minimum into sorted partition
        }
        // Index i marked sorted
    }
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    selectionSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'insertion-sort': {
    id: 'insertion-sort',
    title: 'Insertion Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '4-7', title: 'Key Selection', explanation: 'Selects the element at index i as the key to be inserted into the sorted subarray [0..i-1].' },
      { lines: '10-14', title: 'Shift & Insert', explanation: 'Shifts all elements greater than key one position right, then inserts key at j+1.' },
    ],
    code: `/*
 * Insertion Sort Implementation in C11
 * Time Complexity: O(n^2) worst/avg, O(n) best (already sorted)
 * Space Complexity: O(1)
 */
#include <stdio.h>

void insertionSort(int arr[], int n) {
    for (int i = 1; i < n; i++) {
        int key = arr[i];
        int j = i - 1;

        // Shift elements of arr[0..i-1] greater than key
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key; // Inserted key at sorted position
    }
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    insertionSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'merge-sort': {
    id: 'merge-sort',
    title: 'Merge Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [38, 27, 43, 3, 9, 82, 10]',
    sampleOutput: 'Sorted Array: [3, 9, 10, 27, 38, 43, 82]',
    keySectionExplanations: [
      { lines: '11-39', title: 'Two-Way Merge Step', explanation: 'Merges two sorted subarrays into temporary buffers L and R, comparing elements and writing back in sorted order.' },
    ],
    code: `/*
 * Merge Sort Implementation in C11
 * Stable divide-and-conquer algorithm with guaranteed O(n log n) runtime
 */
#include <stdio.h>
#include <stdlib.h>

void merge(int arr[], int l, int m, int r) {
    int n1 = m - l + 1;
    int n2 = r - m;
    int *L = (int*)malloc(n1 * sizeof(int));
    int *R = (int*)malloc(n2 * sizeof(int));

    for (int i = 0; i < n1; i++) L[i] = arr[l + i];
    for (int j = 0; j < n2; j++) R[j] = arr[m + 1 + j];

    int i = 0, j = 0, k = l;
    while (i < n1 && j < n2) {
        if (L[i] <= R[j]) {
            arr[k] = L[i++]; // Placed from left subarray
        } else {
            arr[k] = R[j++]; // Placed from right subarray
        }
        k++;
    }
    while (i < n1) arr[k++] = L[i++];
    while (j < n2) arr[k++] = R[j++];

    free(L);
    free(R);
}

void mergeSort(int arr[], int l, int r) {
    if (l < r) {
        int m = l + (r - l) / 2; // Dividing subarray range
        mergeSort(arr, l, m);
        mergeSort(arr, m + 1, r);
        merge(arr, l, m, r); // Merging sorted subarrays
    }
}

int main() {
    int arr[] = {38, 27, 43, 3, 9, 82, 10};
    int n = sizeof(arr) / sizeof(arr[0]);
    mergeSort(arr, 0, n - 1);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'quick-sort': {
    id: 'quick-sort',
    title: 'Quick Sort (Lomuto Partition)',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '13-26', title: 'Partitioning Logic', explanation: 'Chooses the last element as pivot, traverses the array, and maintains boundary i separating elements <= pivot from elements > pivot.' },
      { lines: '30-38', title: 'Recursive Divide-and-Conquer', explanation: 'Recursively sorts the left subarray (elements smaller than pivot) and right subarray (elements greater than pivot).' },
    ],
    code: `/*
 * Quick Sort Implementation in C11
 * Time Complexity: O(n log n) average, O(n^2) worst case
 * Space Complexity: O(log n) auxiliary stack space
 */
#include <stdio.h>

void swap(int *a, int *b) {
    int temp = *a; *a = *b; *b = temp;
}

int partition(int arr[], int low, int high) {
    int pivot = arr[high]; // Lomuto pivot selection
    int i = (low - 1);

    for (int j = low; j < high; j++) {
        // Compare current element with pivot
        if (arr[j] < pivot) {
            i++;
            swap(&arr[i], &arr[j]); // Swap smaller element into position
        }
    }
    swap(&arr[i + 1], &arr[high]); // Place pivot in final sorted position
    return (i + 1);
}

void quickSort(int arr[], int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    quickSort(arr, 0, n - 1);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'heap-sort': {
    id: 'heap-sort',
    title: 'Heap Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '5-18', title: 'Heapify', explanation: 'Compares a node with its left and right children and swaps with the largest, sinking the smaller value down.' },
      { lines: '26-30', title: 'Extraction Phase', explanation: 'Swaps the max root with the last heap element, shrinks the heap, and re-heapifies.' },
    ],
    code: `/*
 * Heap Sort Implementation in C11
 * Time Complexity: O(n log n) all cases
 * Space Complexity: O(1) in-place
 */
#include <stdio.h>

void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

void heapify(int arr[], int n, int i) {
    int largest = i;
    int left = 2 * i + 1;
    int right = 2 * i + 2;

    // Comparing left child with largest
    if (left < n && arr[left] > arr[largest]) largest = left;
    // Comparing right child with largest
    if (right < n && arr[right] > arr[largest]) largest = right;

    if (largest != i) {
        swap(&arr[i], &arr[largest]); // Heapify: swap parent with larger child
        heapify(arr, n, largest);
    }
}

void heapSort(int arr[], int n) {
    // Build Max-Heap
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);

    // Extract elements one by one
    for (int i = n - 1; i > 0; i--) {
        swap(&arr[0], &arr[i]); // Move max root to end
        heapify(arr, i, 0);
    }
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    heapSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'counting-sort': {
    id: 'counting-sort',
    title: 'Counting Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [4, 2, 2, 8, 3, 3, 1]',
    sampleOutput: 'Sorted Array: [1, 2, 2, 3, 3, 4, 8]',
    keySectionExplanations: [
      { lines: '8-10', title: 'Frequency Counting', explanation: 'Builds a histogram counting occurrences of each value, shifted by min_val to support negatives.' },
      { lines: '17-20', title: 'Stable Placement', explanation: 'Walks input backwards and uses the cumulative count array to place each element in its final sorted position, preserving stability.' },
    ],
    code: `/*
 * Counting Sort Implementation in C11
 * Time Complexity: O(n + k), Space Complexity: O(k)
 * Non-comparison integer sort; assumes a bounded value range.
 */
#include <stdio.h>
#include <stdlib.h>

void countingSort(int arr[], int n) {
    int max_val = arr[0], min_val = arr[0];
    for (int i = 1; i < n; i++) {
        if (arr[i] > max_val) max_val = arr[i];
        if (arr[i] < min_val) min_val = arr[i];
    }
    int range = max_val - min_val + 1;
    int *count = (int*)calloc(range, sizeof(int));
    int *output = (int*)malloc(sizeof(int) * n);

    for (int i = 0; i < n; i++) count[arr[i] - min_val]++; // Counted occurrence
    for (int i = 1; i < range; i++) count[i] += count[i - 1];

    for (int i = n - 1; i >= 0; i--) {
        int pos = count[arr[i] - min_val] - 1;
        output[pos] = arr[i];
        count[arr[i] - min_val]--;
    }
    for (int i = 0; i < n; i++) arr[i] = output[i]; // Placed sorted value

    free(count);
    free(output);
}

int main() {
    int arr[] = {4, 2, 2, 8, 3, 3, 1};
    int n = sizeof(arr) / sizeof(arr[0]);
    countingSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'radix-sort': {
    id: 'radix-sort',
    title: 'Radix Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [170, 45, 75, 90, 802, 24, 2, 66]',
    sampleOutput: 'Sorted Array: [2, 24, 45, 66, 75, 90, 170, 802]',
    keySectionExplanations: [
      { lines: '6-22', title: 'Digit-Wise Counting Sort', explanation: 'Performs a stable counting sort keyed on the digit at the current place value (exp).' },
      { lines: '28-31', title: 'LSD Pass Loop', explanation: 'Repeats the digit-wise sort for each power of 10 from least-significant to most-significant digit.' },
    ],
    code: `/*
 * Radix Sort Implementation in C11 (LSD, base 10)
 * Time Complexity: O(d * (n + b)), Space Complexity: O(n + b)
 * Assumes non-negative integers.
 */
#include <stdio.h>
#include <stdlib.h>

int getMax(int arr[], int n) {
    int mx = arr[0];
    for (int i = 1; i < n; i++) if (arr[i] > mx) mx = arr[i];
    return mx;
}

void countSortByDigit(int arr[], int n, int exp) {
    int *output = (int*)malloc(sizeof(int) * n);
    int count[10] = {0};

    for (int i = 0; i < n; i++) count[(arr[i] / exp) % 10]++;
    for (int i = 1; i < 10; i++) count[i] += count[i - 1];
    for (int i = n - 1; i >= 0; i--) {
        int digit = (arr[i] / exp) % 10;
        output[count[digit] - 1] = arr[i];
        count[digit]--;
    }
    for (int i = 0; i < n; i++) arr[i] = output[i]; // Placed at sorted index
    free(output);
}

void radixSort(int arr[], int n) {
    int m = getMax(arr, n);
    // Radix pass: sorting by each digit position
    for (int exp = 1; m / exp > 0; exp *= 10) {
        countSortByDigit(arr, n, exp);
    }
}

int main() {
    int arr[] = {170, 45, 75, 90, 802, 24, 2, 66};
    int n = sizeof(arr) / sizeof(arr[0]);
    radixSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'shell-sort': {
    id: 'shell-sort',
    title: 'Shell Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '4', title: 'Gap Sequence', explanation: 'Starts with gap = n/2 and halves the gap each pass, down to a gap of 1 (plain insertion sort).' },
      { lines: '11-15', title: 'Gapped Insertion', explanation: 'Compares and shifts elements that are `gap` positions apart instead of adjacent neighbors.' },
    ],
    code: `/*
 * Shell Sort Implementation in C11
 * Time Complexity: O(n log^2 n) with this gap sequence
 * Space Complexity: O(1)
 */
#include <stdio.h>

void shellSort(int arr[], int n) {
    for (int gap = n / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < n; i++) {
            int temp = arr[i];
            int j;
            // Compare array[j-gap] with key across the gap distance
            for (j = i; j >= gap && arr[j - gap] > temp; j -= gap) {
                arr[j] = arr[j - gap]; // Shifted element across gap
            }
            arr[j] = temp; // Placed key at index j
        }
    }
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    shellSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'bucket-sort': {
    id: 'bucket-sort',
    title: 'Bucket Sort',
    category: 'Sorting Algorithms',
    sampleInput: 'Input Array: [29, 10, 14, 37, 13, 42, 18, 25]',
    sampleOutput: 'Sorted Array: [10, 13, 14, 18, 25, 29, 37, 42]',
    keySectionExplanations: [
      { lines: '14-18', title: 'Distribution Phase', explanation: 'Maps each value into one of a fixed number of buckets based on its relative position in the value range.' },
      { lines: '22-28', title: 'Per-Bucket Sort & Collect', explanation: 'Sorts each bucket individually (insertion sort) then concatenates buckets in order for the final result.' },
    ],
    code: `/*
 * Bucket Sort Implementation in C11
 * Time Complexity: O(n + k) average, Space Complexity: O(n)
 */
#include <stdio.h>
#include <stdlib.h>

void bucketSort(int arr[], int n) {
    int max_val = arr[0], min_val = arr[0];
    for (int i = 1; i < n; i++) {
        if (arr[i] > max_val) max_val = arr[i];
        if (arr[i] < min_val) min_val = arr[i];
    }
    int bucket_count = n < 5 ? n : 5;
    if (bucket_count < 2) bucket_count = 2;
    int range = max_val - min_val + 1;

    int **buckets = (int**)malloc(sizeof(int*) * bucket_count);
    int *bucket_sizes = (int*)calloc(bucket_count, sizeof(int));
    for (int b = 0; b < bucket_count; b++) buckets[b] = (int*)malloc(sizeof(int) * n);

    // Distributing elements into buckets
    for (int i = 0; i < n; i++) {
        int idx = (int)(((long long)(arr[i] - min_val) * (bucket_count - 1)) / range);
        buckets[idx][bucket_sizes[idx]++] = arr[i];
    }

    // Sorting individual buckets (insertion sort) and collecting
    int out = 0;
    for (int b = 0; b < bucket_count; b++) {
        for (int i = 1; i < bucket_sizes[b]; i++) {
            int key = buckets[b][i], j = i - 1;
            while (j >= 0 && buckets[b][j] > key) { buckets[b][j+1] = buckets[b][j]; j--; }
            buckets[b][j + 1] = key;
        }
        for (int i = 0; i < bucket_sizes[b]; i++) arr[out++] = buckets[b][i];
    }

    for (int b = 0; b < bucket_count; b++) free(buckets[b]);
    free(buckets); free(bucket_sizes);
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 42, 18, 25};
    int n = sizeof(arr) / sizeof(arr[0]);
    bucketSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  /* ========================= SEARCHING ========================= */
  'linear-search': {
    id: 'linear-search',
    title: 'Linear Search',
    category: 'Searching Algorithms',
    sampleInput: 'Array: [10, 13, 14, 18, 25, 29, 37, 42, 55, 68], Target: 29',
    sampleOutput: 'Target found at index 5',
    keySectionExplanations: [
      { lines: '7-11', title: 'Sequential Scan', explanation: 'Checks every element from index 0 upward until the target is found or the array ends. Works on unsorted data, unlike the other search algorithms.' },
    ],
    code: `/*
 * Linear Search in C11
 * Works on unsorted arrays. Time Complexity: O(n)
 */
#include <stdio.h>

int linearSearch(const int arr[], int size, int target) {
    for (int i = 0; i < size; i++) {
        // Checking array[i] against target
        if (arr[i] == target) {
            return i; // Target FOUND
        }
    }
    return -1; // Target NOT FOUND
}

int main() {
    int arr[] = {10, 13, 14, 18, 25, 29, 37, 42, 55, 68};
    int n = sizeof(arr) / sizeof(arr[0]);
    int target = 29;
    int result = linearSearch(arr, n, target);
    if (result != -1) printf("Found at index %d\\n", result);
    else printf("Not found\\n");
    return 0;
}`,
  },

  'binary-search': {
    id: 'binary-search',
    title: 'Binary Search',
    category: 'Searching Algorithms',
    sampleInput: 'Sorted Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], Target: 23',
    sampleOutput: 'Target found at index 5',
    keySectionExplanations: [
      { lines: '9-19', title: 'Midpoint Calculation and Interval Halving', explanation: 'Avoids integer overflow with low + (high - low) / 2 and cuts the search space in half at each iteration. Requires a pre-sorted array.' },
    ],
    code: `/*
 * Binary Search in C11
 * Requires pre-sorted array. Time Complexity: O(log n)
 */
#include <stdio.h>

int binarySearch(const int arr[], int size, int target) {
    int low = 0;
    int high = size - 1;

    while (low <= high) {
        int mid = low + (high - low) / 2; // Safe midpoint

        if (arr[mid] == target) {
            return mid; // Match found!
        }
        if (arr[mid] < target) {
            low = mid + 1; // Discard left half
        } else {
            high = mid - 1; // Discard right half
        }
    }
    return -1; // Target not found
}

int main() {
    int arr[] = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    int n = sizeof(arr) / sizeof(arr[0]);
    int target = 23;
    int result = binarySearch(arr, n, target);
    if (result != -1) printf("Found at index %d\\n", result);
    else printf("Not found\\n");
    return 0;
}`,
  },

  'jump-search': {
    id: 'jump-search',
    title: 'Jump Search',
    category: 'Searching Algorithms',
    sampleInput: 'Sorted Array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], Target: 56',
    sampleOutput: 'Target found at index 7',
    keySectionExplanations: [
      { lines: '6-11', title: 'Block Jumping', explanation: 'Jumps ahead by sqrt(n) elements at a time until it finds a block that could contain the target.' },
      { lines: '16-19', title: 'Linear Scan Within Block', explanation: 'Once the right block is found, does a plain linear scan within that block.' },
    ],
    code: `/*
 * Jump Search in C11
 * Requires sorted array. Time Complexity: O(sqrt(n))
 */
#include <stdio.h>
#include <math.h>

int jumpSearch(const int arr[], int n, int target) {
    int step = (int)sqrt((double)n);
    int prev = 0;

    // Jumping block by block
    while (arr[(step < n ? step : n) - 1] < target) {
        prev = step;
        step += (int)sqrt((double)n);
        if (prev >= n) return -1;
    }

    // Linear scan within identified block
    int end = step < n ? step : n;
    for (int i = prev; i < end; i++) {
        if (arr[i] == target) return i; // FOUND
    }
    return -1; // NOT FOUND
}

int main() {
    int arr[] = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    int n = sizeof(arr) / sizeof(arr[0]);
    int target = 56;
    int result = jumpSearch(arr, n, target);
    if (result != -1) printf("Found at index %d\\n", result);
    else printf("Not found\\n");
    return 0;
}`,
  },

  'interpolation-search': {
    id: 'interpolation-search',
    title: 'Interpolation Search',
    category: 'Searching Algorithms',
    sampleInput: 'Uniformly distributed sorted array, Target: 8',
    sampleOutput: 'Target found via probe formula',
    keySectionExplanations: [
      { lines: '13', title: 'Probe Position Formula', explanation: 'Estimates the probable position of the target using linear interpolation of value distribution instead of a plain midpoint.' },
      { lines: '7', title: 'Duplicate-Value Guard', explanation: 'When arr[high] == arr[low] the probe formula denominator would be zero; this case is resolved directly without dividing.' },
    ],
    code: `/*
 * Interpolation Search in C11
 * Best on uniformly distributed sorted data. Time: O(log log n) average
 */
#include <stdio.h>

int interpolationSearch(const int arr[], int n, int target) {
    int low = 0, high = n - 1;

    while (low <= high && target >= arr[low] && target <= arr[high]) {
        if (low == high || arr[high] == arr[low]) {
            // Range collapsed to a single/duplicate value
            return (arr[low] == target) ? low : -1;
        }

        // Probe position formula (safe: arr[high] != arr[low] here)
        int pos = low + (((double)(high - low) / (arr[high] - arr[low])) * (target - arr[low]));
        if (pos < low || pos > high) break;

        if (arr[pos] == target) return pos; // FOUND
        if (arr[pos] < target) low = pos + 1; // Adjust low bound
        else high = pos - 1;                  // Adjust high bound
    }
    return -1; // NOT FOUND
}

int main() {
    int arr[] = {10, 12, 13, 16, 18, 19, 20, 21, 22, 23, 24, 33, 35, 42, 47};
    int n = sizeof(arr) / sizeof(arr[0]);
    int target = 18;
    int result = interpolationSearch(arr, n, target);
    if (result != -1) printf("Found at index %d\\n", result);
    else printf("Not found\\n");
    return 0;
}`,
  },

  'exponential-search': {
    id: 'exponential-search',
    title: 'Exponential Search',
    category: 'Searching Algorithms',
    sampleInput: 'Sorted/unbounded Array, Target: 72',
    sampleOutput: 'Target found at index 8',
    keySectionExplanations: [
      { lines: '9-13', title: 'Exponential Range Finding', explanation: 'Doubles the index (1, 2, 4, 8...) until it finds a value >= target, establishing a bounded range.' },
      { lines: '16-27', title: 'Bounded Binary Search', explanation: 'Runs a standard binary search within the [low, high] range found by the doubling phase.' },
    ],
    code: `/*
 * Exponential Search in C11
 * Useful for unbounded/infinite sorted arrays. Time: O(log n)
 */
#include <stdio.h>

int binarySearchRange(const int arr[], int low, int high, int target) {
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}

int exponentialSearch(const int arr[], int n, int target) {
    if (arr[0] == target) return 0; // Found at index 0

    int i = 1;
    // Exponential range check: double i until arr[i] > target
    while (i < n && arr[i] <= target) {
        i *= 2;
    }

    int low = i / 2;
    int high = (i < n) ? i : n - 1;
    return binarySearchRange(arr, low, high, target); // Bounded binary search
}

int main() {
    int arr[] = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    int n = sizeof(arr) / sizeof(arr[0]);
    int target = 72;
    int result = exponentialSearch(arr, n, target);
    if (result != -1) printf("Found at index %d\\n", result);
    else printf("Not found\\n");
    return 0;
}`,
  },

  /* ========================= LINEAR DATA STRUCTURES ========================= */
  array: {
    id: 'array',
    title: 'Dynamic Array Operations',
    category: 'Linear Data Structures',
    sampleInput: 'Array: [10, 25, 42, 68], Insert 99 at index 1',
    sampleOutput: 'Array: [10, 99, 25, 42, 68]',
    keySectionExplanations: [
      { lines: '8-12', title: 'Shift-Right Insert', explanation: 'Shifts every element from the insertion point rightward by one to open a gap, then places the new value.' },
      { lines: '19-23', title: 'Shift-Left Delete', explanation: 'Shifts every element after the deleted index leftward by one to close the gap.' },
    ],
    code: `/*
 * Dynamic Array Operations in C11
 * Insert/Delete: O(n) due to shifting; Access: O(1)
 */
#include <stdio.h>

void insertAt(int arr[], int *size, int index, int value) {
    for (int i = *size; i > index; i--) {
        arr[i] = arr[i - 1]; // Shift element right
    }
    arr[index] = value;
    (*size)++;
}

void deleteAt(int arr[], int *size, int index) {
    for (int i = index; i < *size - 1; i++) {
        arr[i] = arr[i + 1]; // Shift element left
    }
    (*size)--;
}

int searchValue(const int arr[], int size, int value) {
    for (int i = 0; i < size; i++) {
        if (arr[i] == value) return i; // Found
    }
    return -1;
}

int main() {
    int arr[20] = {10, 25, 42, 68};
    int size = 4;
    insertAt(arr, &size, 1, 99);
    for (int i = 0; i < size; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  'singly-linked-list': {
    id: 'singly-linked-list',
    title: 'Singly Linked List',
    category: 'Linear Data Structures',
    sampleInput: 'InsertAtHead(10), InsertAtTail(20), InsertAtHead(5)',
    sampleOutput: 'List: 5 -> 10 -> 20 -> NULL',
    keySectionExplanations: [
      { lines: '13-22', title: 'Dynamic Heap Allocation', explanation: 'Allocates memory on the heap with malloc(sizeof(Node)) and checks for NULL to prevent memory faults.' },
      { lines: '24-34', title: 'Pointer Rewiring', explanation: 'Links newNode->next to current head and reassigns head pointer to newNode in O(1) time.' },
    ],
    code: `/*
 * Singly Linked List Implementation in C11
 * Demonstrating explicit pointer management and dynamic allocation
 */
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node* createNode(int value) {
    Node *newNode = (Node*)malloc(sizeof(Node));
    newNode->data = value;
    newNode->next = NULL;
    return newNode;
}

void insertAtPosition(Node **headRef, int pos, int value) {
    Node *newNode = createNode(value);
    if (pos == 0) {
        newNode->next = *headRef; // Link new node to old head
        *headRef = newNode;       // Reassign head pointer
        return;
    }
    Node *prev = *headRef;
    for (int i = 0; i < pos - 1 && prev->next; i++) prev = prev->next; // Traverse
    newNode->next = prev->next; // Splice into list
    prev->next = newNode;
}

void deleteAtPosition(Node **headRef, int pos) {
    Node *temp = *headRef;
    if (pos == 0) { *headRef = temp->next; free(temp); return; }
    for (int i = 0; i < pos - 1 && temp->next; i++) temp = temp->next;
    Node *target = temp->next;
    temp->next = target->next; // Bypass node
    free(target);              // Free memory
}

void printList(const Node *head) {
    while (head) { printf("%d -> ", head->data); head = head->next; }
    printf("NULL\\n");
}

int main() {
    Node *head = NULL;
    insertAtPosition(&head, 0, 20);
    insertAtPosition(&head, 0, 10);
    insertAtPosition(&head, 0, 5);
    printList(head);
    return 0;
}`,
  },

  'doubly-linked-list': {
    id: 'doubly-linked-list',
    title: 'Doubly Linked List',
    category: 'Linear Data Structures',
    sampleInput: 'InsertAtPosition(1, 99) into [10, 25, 42, 68]',
    sampleOutput: 'List: 10 <-> 99 <-> 25 <-> 42 <-> 68',
    keySectionExplanations: [
      { lines: '16-22', title: 'Bidirectional Link Wiring', explanation: 'Each insertion must wire FOUR pointers: newNode->prev, newNode->next, prevNode->next, and nextNode->prev.' },
      { lines: '28-32', title: 'Bidirectional Unlink', explanation: 'Deletion rewires the neighbor on each side directly to each other, bypassing the removed node in both directions.' },
    ],
    code: `/*
 * Doubly Linked List Implementation in C11
 * Each node stores both next and prev pointers
 */
#include <stdio.h>
#include <stdlib.h>

typedef struct DNode {
    int data;
    struct DNode *prev;
    struct DNode *next;
} DNode;

DNode* createNode(int value) {
    DNode *n = (DNode*)malloc(sizeof(DNode));
    n->data = value; n->prev = NULL; n->next = NULL;
    return n;
}

void insertAtPosition(DNode **headRef, int pos, int value) {
    DNode *newNode = createNode(value); // Allocate node
    if (pos == 0) {
        newNode->next = *headRef;
        if (*headRef) (*headRef)->prev = newNode;
        *headRef = newNode;
        return;
    }
    DNode *cur = *headRef;
    for (int i = 0; i < pos - 1 && cur->next; i++) cur = cur->next;
    newNode->next = cur->next;
    newNode->prev = cur;
    if (cur->next) cur->next->prev = newNode; // Wire next->prev
    cur->next = newNode;                      // Wire prev->next
}

void deleteAtPosition(DNode **headRef, int pos) {
    DNode *cur = *headRef;
    for (int i = 0; i < pos && cur; i++) cur = cur->next;
    if (!cur) return;
    if (cur->prev) cur->prev->next = cur->next; else *headRef = cur->next;
    if (cur->next) cur->next->prev = cur->prev; // Rewire both neighbors
    free(cur);
}

int main() {
    DNode *head = createNode(10);
    insertAtPosition(&head, 1, 99);
    for (DNode *c = head; c; c = c->next) printf("%d ", c->data);
    printf("\\n");
    return 0;
}`,
  },

  'circular-list': {
    id: 'circular-list',
    title: 'Circular Linked List',
    category: 'Linear Data Structures',
    sampleInput: 'Ring of [10, 25, 42, 68], tail->next wraps to head',
    sampleOutput: 'List: 10 -> 25 -> 42 -> 68 -> (back to HEAD)',
    keySectionExplanations: [
      { lines: '16-24', title: 'Ring Closure on Insert', explanation: 'After inserting at head or tail, the last node\'s next pointer must still point back to the (possibly new) head to keep the ring closed.' },
      { lines: '30-33', title: 'Loop Termination in Traversal', explanation: 'Traversal must stop after one full loop back to head, since there is no NULL terminator.' },
    ],
    code: `/*
 * Circular Linked List Implementation in C11
 * The last node's "next" always points back to the head
 */
#include <stdio.h>
#include <stdlib.h>

typedef struct CNode {
    int data;
    struct CNode *next;
} CNode;

CNode* createNode(int value) {
    CNode *n = (CNode*)malloc(sizeof(CNode));
    n->data = value; n->next = NULL;
    return n;
}

void insertAtPosition(CNode **headRef, int pos, int value) {
    CNode *newNode = createNode(value);
    if (*headRef == NULL) { newNode->next = newNode; *headRef = newNode; return; }

    if (pos == 0) {
        CNode *tail = *headRef;
        while (tail->next != *headRef) tail = tail->next; // find tail
        newNode->next = *headRef;
        tail->next = newNode;   // re-close the ring to new head
        *headRef = newNode;
        return;
    }
    CNode *cur = *headRef;
    for (int i = 0; i < pos - 1; i++) cur = cur->next; // traverse circularly
    newNode->next = cur->next;
    cur->next = newNode;        // splice node into ring
}

void traverse(const CNode *head) {
    if (!head) return;
    const CNode *cur = head;
    do {
        printf("%d -> ", cur->data);
        cur = cur->next;
    } while (cur != head); // loop closes back to HEAD
    printf("(HEAD)\\n");
}

int main() {
    CNode *head = NULL;
    insertAtPosition(&head, 0, 68);
    insertAtPosition(&head, 0, 42);
    insertAtPosition(&head, 0, 25);
    insertAtPosition(&head, 0, 10);
    traverse(head);
    return 0;
}`,
  },

  stack: {
    id: 'stack',
    title: 'Stack (LIFO)',
    category: 'Linear Data Structures',
    sampleInput: 'Push(10), Push(20), Push(30), Pop()',
    sampleOutput: 'Popped: 30. Stack: [10, 20]',
    keySectionExplanations: [
      { lines: '9-13', title: 'Push Operation', explanation: 'Increments the top pointer and stores the new value; fails with an overflow if capacity is reached.' },
      { lines: '16-20', title: 'Pop Operation', explanation: 'Reads the element at top, then decrements top; fails with underflow if the stack is empty.' },
    ],
    code: `/*
 * Stack (LIFO) Implementation in C11 using a fixed-capacity array
 * Push/Pop/Peek: O(1)
 */
#include <stdio.h>

typedef struct {
    int data[100];
    int top;
    int capacity;
} Stack;

void initStack(Stack *s, int capacity) { s->top = -1; s->capacity = capacity; }

int push(Stack *s, int value) {
    if (s->top >= s->capacity - 1) return -1; // STACK OVERFLOW
    s->data[++s->top] = value; // Increment top, store value
    return 0;
}

int pop(Stack *s, int *out) {
    if (s->top < 0) return -1; // STACK UNDERFLOW
    *out = s->data[s->top--]; // Read top, then decrement
    return 0;
}

int peek(const Stack *s, int *out) {
    if (s->top < 0) return -1;
    *out = s->data[s->top]; // Top element without removing
    return 0;
}

int main() {
    Stack s; initStack(&s, 10);
    push(&s, 10); push(&s, 20); push(&s, 30);
    int popped;
    pop(&s, &popped);
    printf("Popped: %d\\n", popped);
    return 0;
}`,
  },

  queue: {
    id: 'queue',
    title: 'Queue (FIFO)',
    category: 'Linear Data Structures',
    sampleInput: 'Enqueue(10), Enqueue(20), Dequeue()',
    sampleOutput: 'Dequeued: 10. Queue: [20]',
    keySectionExplanations: [
      { lines: '9-12', title: 'Enqueue at Rear', explanation: 'Appends the new value at the rear index and advances rear.' },
      { lines: '15-20', title: 'Dequeue from Front & Shift', explanation: 'Removes the front element, then shifts all remaining elements left by one position.' },
    ],
    code: `/*
 * Queue (FIFO) Implementation in C11 using a dynamic array
 * Enqueue: O(1); Dequeue: O(n) due to shifting (array-backed)
 */
#include <stdio.h>

typedef struct {
    int data[100];
    int size;
} Queue;

void initQueue(Queue *q) { q->size = 0; }

void enqueue(Queue *q, int value) {
    q->data[q->size++] = value; // Append at REAR
}

int dequeue(Queue *q, int *out) {
    if (q->size <= 0) return -1; // QUEUE UNDERFLOW
    *out = q->data[0]; // Extract FRONT
    for (int i = 0; i < q->size - 1; i++) q->data[i] = q->data[i + 1]; // Shift forward
    q->size--;
    return 0;
}

int main() {
    Queue q; initQueue(&q);
    enqueue(&q, 10); enqueue(&q, 20);
    int dq;
    dequeue(&q, &dq);
    printf("Dequeued: %d\\n", dq);
    return 0;
}`,
  },

  'circular-queue': {
    id: 'circular-queue',
    title: 'Circular Queue',
    category: 'Linear Data Structures',
    sampleInput: 'Capacity 8, Enqueue(10..40), Dequeue()',
    sampleOutput: 'Rear wraps via modulo; Front advances circularly',
    keySectionExplanations: [
      { lines: '12-16', title: 'Modulo Wraparound Enqueue', explanation: 'rear = (rear + 1) % capacity lets the rear pointer wrap back to index 0 once it passes the end of the buffer.' },
      { lines: '19-24', title: 'Modulo Wraparound Dequeue', explanation: 'front = (front + 1) % capacity advances the front pointer circularly after removing an element.' },
    ],
    code: `/*
 * Circular Queue (Ring Buffer) Implementation in C11
 * Enqueue/Dequeue: O(1), fixed capacity, wraps via modulo arithmetic
 */
#include <stdio.h>

typedef struct {
    int data[100];
    int front, rear, size, capacity;
} CircularQueue;

void initCQ(CircularQueue *q, int capacity) {
    q->front = 0; q->rear = -1; q->size = 0; q->capacity = capacity;
}

int enqueue(CircularQueue *q, int value) {
    if (q->size >= q->capacity) return -1; // QUEUE FULL
    q->rear = (q->rear + 1) % q->capacity; // Wraparound via modulo
    q->data[q->rear] = value;
    q->size++;
    return 0;
}

int dequeue(CircularQueue *q, int *out) {
    if (q->size <= 0) return -1; // QUEUE EMPTY
    *out = q->data[q->front];
    q->front = (q->front + 1) % q->capacity; // Advance front circularly
    q->size--;
    return 0;
}

int main() {
    CircularQueue q; initCQ(&q, 8);
    enqueue(&q, 10); enqueue(&q, 20); enqueue(&q, 30);
    int dq; dequeue(&q, &dq);
    printf("Dequeued: %d\\n", dq);
    return 0;
}`,
  },

  deque: {
    id: 'deque',
    title: 'Deque (Double-Ended Queue)',
    category: 'Linear Data Structures',
    sampleInput: 'PushFront(5), PushBack(99)',
    sampleOutput: 'Deque supports insertion/removal at BOTH ends',
    keySectionExplanations: [
      { lines: '9-13', title: 'Push Front / Push Back', explanation: 'push_front shifts all elements right and inserts at index 0; push_back simply appends at the end.' },
      { lines: '16-23', title: 'Pop Front / Pop Back', explanation: 'pop_front removes index 0 and shifts remaining elements left; pop_back simply shrinks the size.' },
    ],
    code: `/*
 * Deque (Double-Ended Queue) Implementation in C11
 * Supports insertion and deletion at BOTH the front and the rear
 */
#include <stdio.h>

typedef struct {
    int data[100];
    int size;
} Deque;

void initDeque(Deque *d) { d->size = 0; }

void pushFront(Deque *d, int value) {
    for (int i = d->size; i > 0; i--) d->data[i] = d->data[i - 1]; // shift right
    d->data[0] = value;
    d->size++;
}

void pushBack(Deque *d, int value) {
    d->data[d->size++] = value; // append at rear
}

int popFront(Deque *d, int *out) {
    if (d->size <= 0) return -1;
    *out = d->data[0];
    for (int i = 0; i < d->size - 1; i++) d->data[i] = d->data[i + 1]; // shift left
    d->size--;
    return 0;
}

int popBack(Deque *d, int *out) {
    if (d->size <= 0) return -1;
    *out = d->data[d->size - 1];
    d->size--; // simply shrink
    return 0;
}

int main() {
    Deque d; initDeque(&d);
    pushBack(&d, 10); pushBack(&d, 20);
    pushFront(&d, 5);
    for (int i = 0; i < d.size; i++) printf("%d ", d.data[i]);
    printf("\\n");
    return 0;
}`,
  },

  /* ========================= HASH TABLE ========================= */
  hash: {
    id: 'hash',
    title: 'Hash Table & Collision Resolution',
    category: 'Hash-Based Structures',
    sampleInput: 'Insert keys 15, 25, 35 with table size 10 (linear probing)',
    sampleOutput: 'Collisions resolved by probing to next free slot',
    keySectionExplanations: [
      { lines: '9', title: 'Hash Function', explanation: 'h(k) = k % table_size maps any key into a valid slot index.' },
      { lines: '14-20', title: 'Linear / Quadratic Probing', explanation: 'On collision, probes slot (h+i) % size (linear) or (h+i*i) % size (quadratic) until an empty slot is found.' },
      { lines: '26-32', title: 'Separate Chaining', explanation: 'Each bucket holds a linked list (chain) of all keys that hash to it, so no key is ever dropped on collision.' },
    ],
    code: `/*
 * Hash Table with Collision Resolution Strategies in C11
 * Supports: Linear Probing, Quadratic Probing, Separate Chaining
 */
#include <stdio.h>
#include <stdlib.h>

typedef struct ChainNode {
    int key;
    struct ChainNode *next;
} ChainNode;

int hashFunc(int key, int table_size) {
    return (key >= 0 ? key : -key) % table_size; // h(k) = k % size
}

void insertLinearProbe(int table[], int size, int key) {
    int h = hashFunc(key, size);
    for (int i = 0; i < size; i++) {
        int slot = (h + i) % size; // Linear probe
        if (table[slot] == -1) { table[slot] = key; return; }
    }
}

void insertQuadraticProbe(int table[], int size, int key) {
    int h = hashFunc(key, size);
    for (int i = 0; i < size; i++) {
        int slot = (h + i * i) % size; // Quadratic probe
        if (table[slot] == -1) { table[slot] = key; return; }
    }
}

void insertChaining(ChainNode *buckets[], int size, int key) {
    int h = hashFunc(key, size);
    ChainNode *node = (ChainNode*)malloc(sizeof(ChainNode));
    node->key = key;
    node->next = buckets[h]; // Link new node into bucket's chain
    buckets[h] = node;
}

int main() {
    int size = 10;
    int table[10];
    for (int i = 0; i < size; i++) table[i] = -1;
    insertLinearProbe(table, size, 15);
    insertLinearProbe(table, size, 25); // collides with 15's slot
    for (int i = 0; i < size; i++) printf("[%d]=%d ", i, table[i]);
    printf("\\n");
    return 0;
}`,
  },

  /* ========================= TREES ========================= */
  bst: {
    id: 'bst',
    title: 'Binary Search Tree',
    category: 'Non-Linear Data Structures',
    sampleInput: 'Insert: 50, 30, 70, 20, 40, 60, 80',
    sampleOutput: 'BST rooted at 50, left subtree < 50, right subtree > 50',
    keySectionExplanations: [
      { lines: '12-20', title: 'Recursive Insert', explanation: 'Recurses left if key < node, right if key > node, creating a new leaf when it reaches a NULL pointer.' },
      { lines: '24-35', title: 'Delete with Successor', explanation: 'A node with two children is replaced by its inorder successor (minimum of right subtree).' },
    ],
    code: `/*
 * Binary Search Tree Implementation in C11
 * Average: O(log n); Worst: O(n) for insert/search/delete
 */
#include <stdio.h>
#include <stdlib.h>

typedef struct BSTNode {
    int key;
    struct BSTNode *left, *right;
} BSTNode;

BSTNode* newNode(int key) {
    BSTNode *n = (BSTNode*)malloc(sizeof(BSTNode));
    n->key = key; n->left = n->right = NULL;
    return n;
}

BSTNode* insert(BSTNode *root, int key) {
    if (!root) return newNode(key); // Created new node as subtree root
    if (key < root->key) root->left = insert(root->left, key);   // Recurse LEFT
    else if (key > root->key) root->right = insert(root->right, key); // Recurse RIGHT
    return root;
}

BSTNode* minNode(BSTNode *node) {
    while (node->left) node = node->left;
    return node;
}

BSTNode* deleteNode(BSTNode *root, int key) {
    if (!root) return NULL;
    if (key < root->key) root->left = deleteNode(root->left, key);
    else if (key > root->key) root->right = deleteNode(root->right, key);
    else {
        if (!root->left) { BSTNode *r = root->right; free(root); return r; }
        if (!root->right) { BSTNode *l = root->left; free(root); return l; }
        BSTNode *succ = minNode(root->right); // Inorder successor
        root->key = succ->key;
        root->right = deleteNode(root->right, succ->key);
    }
    return root;
}

int search(BSTNode *root, int key) {
    while (root) {
        if (root->key == key) return 1; // FOUND
        root = (key < root->key) ? root->left : root->right;
    }
    return 0; // NOT FOUND
}

int main() {
    BSTNode *root = NULL;
    int keys[] = {50, 30, 70, 20, 40, 60, 80};
    for (int i = 0; i < 7; i++) root = insert(root, keys[i]);
    printf("Root: %d\\n", root->key);
    return 0;
}`,
  },

  avl: {
    id: 'avl',
    title: 'AVL Self-Balancing Binary Search Tree',
    category: 'Non-Linear Data Structures',
    sampleInput: 'Insert: 10, 20, 30, 40, 50, 25',
    sampleOutput: 'Balanced AVL Root: 30 with Balance Factors in {-1, 0, 1}',
    keySectionExplanations: [
      { lines: '27-46', title: 'Tree Rotations (Left and Right)', explanation: 'Re-parents nodes in O(1) time to restore height invariant: |height(left) - height(right)| <= 1.' },
    ],
    code: `/*
 * AVL Tree Implementation in C11
 * Guaranteed O(log n) search, insertion, and deletion via strict rebalancing
 */
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int key;
    struct Node *left, *right;
    int height;
} Node;

int max(int a, int b) { return (a > b) ? a : b; }
int height(Node *N) { return (N == NULL) ? 0 : N->height; }

Node* newNode(int key) {
    Node *node = (Node*)malloc(sizeof(Node));
    node->key = key; node->left = NULL; node->right = NULL; node->height = 1;
    return node;
}

Node* rightRotate(Node *y) {
    Node *x = y->left;
    Node *T2 = x->right;
    x->right = y; // Rotate
    y->left = T2;
    y->height = max(height(y->left), height(y->right)) + 1;
    x->height = max(height(x->left), height(x->right)) + 1;
    return x;
}

Node* leftRotate(Node *x) {
    Node *y = x->right;
    Node *T2 = y->left;
    y->left = x; // Rotate
    x->right = T2;
    x->height = max(height(x->left), height(x->right)) + 1;
    y->height = max(height(y->left), height(y->right)) + 1;
    return y;
}

int getBalance(Node *N) { return (N == NULL) ? 0 : height(N->left) - height(N->right); }

Node* insert(Node *node, int key) {
    if (node == NULL) return newNode(key);
    if (key < node->key) node->left = insert(node->left, key);
    else if (key > node->key) node->right = insert(node->right, key);
    else return node;

    node->height = 1 + max(height(node->left), height(node->right));
    int balance = getBalance(node); // Compute balance factor

    if (balance > 1 && key < node->left->key) return rightRotate(node);   // LL
    if (balance < -1 && key > node->right->key) return leftRotate(node); // RR
    if (balance > 1 && key > node->left->key) {                          // LR
        node->left = leftRotate(node->left);
        return rightRotate(node);
    }
    if (balance < -1 && key < node->right->key) {                        // RL
        node->right = rightRotate(node->right);
        return leftRotate(node);
    }
    return node;
}

int main() {
    Node *root = NULL;
    int keys[] = {10, 20, 30, 40, 50, 25};
    for (int i = 0; i < 6; i++) root = insert(root, keys[i]);
    printf("AVL Root key: %d\\n", root->key);
    return 0;
}`,
  },

  'red-black': {
    id: 'red-black',
    title: 'Red-Black Tree',
    category: 'Non-Linear Data Structures',
    sampleInput: 'Insert: 10, 20, 30, 15',
    sampleOutput: 'Root BLACK, no two consecutive RED nodes',
    keySectionExplanations: [
      { lines: '20-26', title: 'Rotation Helpers', explanation: 'Standard left/right rotations re-parent nodes while preserving BST ordering.' },
      { lines: '30-55', title: 'Insertion Fixup', explanation: "Walks up from the newly inserted RED node, recoloring or rotating based on the uncle's color until Red-Black properties are restored." },
    ],
    code: `/*
 * Red-Black Tree Implementation in C11
 * Guarantees O(log n) operations via recoloring + rotation fixups
 */
#include <stdio.h>
#include <stdlib.h>

typedef enum { RED, BLACK } Color;
typedef struct RBNode {
    int key;
    Color color;
    struct RBNode *left, *right, *parent;
} RBNode;

RBNode* newNode(int key) {
    RBNode *n = (RBNode*)malloc(sizeof(RBNode));
    n->key = key; n->color = RED; n->left = n->right = n->parent = NULL;
    return n;
}

void rotateLeft(RBNode **root, RBNode *x) {
    RBNode *y = x->right;
    x->right = y->left;
    if (y->left) y->left->parent = x;
    y->parent = x->parent;
    if (!x->parent) *root = y;
    else if (x == x->parent->left) x->parent->left = y;
    else x->parent->right = y;
    y->left = x; x->parent = y; // Re-parent
}

void rotateRight(RBNode **root, RBNode *x) {
    RBNode *y = x->left;
    x->left = y->right;
    if (y->right) y->right->parent = x;
    y->parent = x->parent;
    if (!x->parent) *root = y;
    else if (x == x->parent->right) x->parent->right = y;
    else x->parent->left = y;
    y->right = x; x->parent = y; // Re-parent
}

void fixup(RBNode **root, RBNode *z) {
    while (z->parent && z->parent->color == RED) {
        RBNode *gp = z->parent->parent;
        if (!gp) break;
        if (z->parent == gp->left) {
            RBNode *uncle = gp->right;
            if (uncle && uncle->color == RED) {
                z->parent->color = BLACK; uncle->color = BLACK; gp->color = RED; // Recolor
                z = gp;
            } else {
                if (z == z->parent->right) { z = z->parent; rotateLeft(root, z); }
                z->parent->color = BLACK; gp->color = RED;
                rotateRight(root, gp);
            }
        } else {
            RBNode *uncle = gp->left;
            if (uncle && uncle->color == RED) {
                z->parent->color = BLACK; uncle->color = BLACK; gp->color = RED;
                z = gp;
            } else {
                if (z == z->parent->left) { z = z->parent; rotateRight(root, z); }
                z->parent->color = BLACK; gp->color = RED;
                rotateLeft(root, gp);
            }
        }
    }
    (*root)->color = BLACK; // Root always BLACK
}

int main() {
    RBNode *root = newNode(10);
    root->color = BLACK;
    printf("Root: %d (%s)\\n", root->key, root->color == BLACK ? "BLACK" : "RED");
    return 0;
}`,
  },

  heap: {
    id: 'heap',
    title: 'Binary Heap (Min/Max)',
    category: 'Non-Linear Data Structures',
    sampleInput: 'Max-Heap Insert: 50, 30, 70, 20, 40, 60, 80',
    sampleOutput: 'Heap array satisfies parent >= children',
    keySectionExplanations: [
      { lines: '9-17', title: 'Sift-Up (Insert)', explanation: 'A newly appended element is swapped upward with its parent until the heap property is restored.' },
      { lines: '21-33', title: 'Sift-Down (Extract)', explanation: 'After replacing the root with the last element, it is swapped downward with its larger (max) or smaller (min) child.' },
    ],
    code: `/*
 * Binary Heap (Max-Heap shown; Min-Heap flips comparisons) in C11
 * Array-based complete binary tree. Insert/Extract: O(log n)
 */
#include <stdio.h>

void siftUp(int arr[], int i) {
    while (i > 0) {
        int parent = (i - 1) / 2;
        if (arr[i] > arr[parent]) { // Max-Heap condition
            int t = arr[i]; arr[i] = arr[parent]; arr[parent] = t; // Swap
            i = parent;
        } else break;
    }
}

void siftDown(int arr[], int n, int i) {
    while (1) {
        int largest = i, left = 2*i+1, right = 2*i+2;
        if (left < n && arr[left] > arr[largest]) largest = left;
        if (right < n && arr[right] > arr[largest]) largest = right;
        if (largest == i) break;
        int t = arr[i]; arr[i] = arr[largest]; arr[largest] = t; // Swap
        i = largest;
    }
}

void insertHeap(int arr[], int *n, int value) {
    arr[*n] = value; // Insert at end
    siftUp(arr, *n);
    (*n)++;
}

int extractRoot(int arr[], int *n) {
    int root = arr[0];
    arr[0] = arr[*n - 1]; // Move last to root
    (*n)--;
    siftDown(arr, *n, 0);
    return root;
}

int main() {
    int arr[20]; int n = 0;
    int keys[] = {50, 30, 70, 20, 40, 60, 80};
    for (int i = 0; i < 7; i++) insertHeap(arr, &n, keys[i]);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}`,
  },

  trie: {
    id: 'trie',
    title: 'Trie (Prefix Tree)',
    category: 'Non-Linear Data Structures',
    sampleInput: 'Insert: cat, car, card, dog. Search: "car"',
    sampleOutput: 'Word "car" FOUND (valid end-of-word path)',
    keySectionExplanations: [
      { lines: '16-23', title: 'Character-by-Character Insert', explanation: 'Each character walks (or creates) a child node indexed by letter, marking the final node as end-of-word.' },
      { lines: '26-33', title: 'Prefix-Path Search', explanation: 'Search follows the exact same character path; if any branch is missing the word cannot exist in the trie.' },
    ],
    code: `/*
 * Trie (Prefix Tree) Implementation in C11
 * Insert/Search: O(L) where L is the word length
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define ALPHABET 26

typedef struct TrieNode {
    struct TrieNode *children[ALPHABET];
    bool isEndOfWord;
} TrieNode;

TrieNode* newTrieNode(void) {
    TrieNode *n = (TrieNode*)calloc(1, sizeof(TrieNode));
    return n;
}

void insertWord(TrieNode *root, const char *word) {
    TrieNode *cur = root;
    for (int i = 0; word[i]; i++) {
        int idx = word[i] - 'a';
        if (!cur->children[idx]) cur->children[idx] = newTrieNode(); // Create node
        cur = cur->children[idx];
    }
    cur->isEndOfWord = true; // Mark terminal node
}

bool searchWord(TrieNode *root, const char *word) {
    TrieNode *cur = root;
    for (int i = 0; word[i]; i++) {
        int idx = word[i] - 'a';
        if (!cur->children[idx]) return false; // No branch -> not found
        cur = cur->children[idx];
    }
    return cur->isEndOfWord;
}

int main() {
    TrieNode *root = newTrieNode();
    insertWord(root, "cat");
    insertWord(root, "car");
    insertWord(root, "card");
    printf("Search 'car': %s\\n", searchWord(root, "car") ? "FOUND" : "NOT FOUND");
    return 0;
}`,
  },

  btree: {
    id: 'btree',
    title: 'B-Tree / B+ Tree',
    category: 'Non-Linear Data Structures',
    sampleInput: 'Order 4, Insert: 10, 20, 30, 40, 50',
    sampleOutput: 'Node overflow triggers split with median promotion',
    keySectionExplanations: [
      { lines: '20-24', title: 'Sorted Leaf Insert', explanation: 'Keys are inserted into a node\'s key array in sorted order using an insertion-sort-style shift.' },
      { lines: '28-35', title: 'Split with Median Promotion', explanation: 'When a node reaches order-1 keys, it splits into two nodes and the median key is promoted to the parent.' },
    ],
    code: `/*
 * B-Tree Implementation in C11 (simplified single-node demo)
 * Order M: each node holds at most M-1 keys before splitting
 */
#include <stdio.h>
#include <stdlib.h>

#define MAX_ORDER 8

typedef struct BTreeNode {
    int keys[MAX_ORDER];
    int keyCount;
    bool isLeaf;
} BTreeNode;

void insertSorted(BTreeNode *node, int key) {
    int i = node->keyCount - 1;
    while (i >= 0 && node->keys[i] > key) {
        node->keys[i + 1] = node->keys[i]; // Shift right
        i--;
    }
    node->keys[i + 1] = key;
    node->keyCount++;
}

void splitNode(BTreeNode *node, int order, int *medianOut) {
    int mid = node->keyCount / 2;
    *medianOut = node->keys[mid]; // Median promoted to parent
    node->keyCount = mid;         // Left node keeps keys < median
}

int main() {
    BTreeNode node = {.keyCount = 0, .isLeaf = true};
    int order = 4;
    int keys[] = {10, 20, 30};
    for (int i = 0; i < 3; i++) insertSorted(&node, keys[i]);

    insertSorted(&node, 40); // Causes overflow at order-1 = 3 keys
    if (node.keyCount >= order - 1) {
        int median;
        splitNode(&node, order, &median);
        printf("Split! Median promoted: %d\\n", median);
    }
    return 0;
}`,
  },

  /* ========================= TREE TRAVERSALS & LCA ========================= */
  traversal: {
    id: 'traversal',
    title: 'Tree Traversals (In/Pre/Post/Level Order)',
    category: 'Tree Algorithms',
    sampleInput: 'BST: 50, 30, 70, 20, 40, 60, 80',
    sampleOutput: 'Inorder: 20 30 40 50 60 70 80 (sorted output)',
    keySectionExplanations: [
      { lines: '7-11', title: 'Inorder (L-Root-R)', explanation: 'Visits left subtree, then root, then right subtree — produces sorted output for a BST.' },
      { lines: '14-18', title: 'Preorder (Root-L-R)', explanation: 'Visits the root before its children — useful for tree serialization/copying.' },
      { lines: '21-25', title: 'Postorder (L-R-Root)', explanation: 'Visits children before the root — useful for safe deletion/cleanup.' },
      { lines: '28-38', title: 'Level Order (BFS)', explanation: 'Visits nodes level-by-level using a FIFO queue.' },
    ],
    code: `/*
 * Binary Tree Traversals in C11
 * All traversals run in O(n) time, O(h) space (O(n) for level order queue)
 */
#include <stdio.h>

typedef struct Node { int key; struct Node *left, *right; } Node;

void inorder(Node *root) {
    if (!root) return;
    inorder(root->left);
    printf("%d ", root->key); // Visit ROOT between children
    inorder(root->right);
}

void preorder(Node *root) {
    if (!root) return;
    printf("%d ", root->key); // Visit ROOT first
    preorder(root->left);
    preorder(root->right);
}

void postorder(Node *root) {
    if (!root) return;
    postorder(root->left);
    postorder(root->right);
    printf("%d ", root->key); // Visit ROOT last
}

void levelOrder(Node *root) {
    if (!root) return;
    Node *queue[256]; int front = 0, rear = 0;
    queue[rear++] = root;
    while (front < rear) {
        Node *cur = queue[front++];
        printf("%d ", cur->key); // Visit current level node
        if (cur->left) queue[rear++] = cur->left;
        if (cur->right) queue[rear++] = cur->right;
    }
}

int main() {
    /* Tree built from keys, traversal selected by request type */
    return 0;
}`,
  },

  lca: {
    id: 'lca',
    title: 'Lowest Common Ancestor (BST)',
    category: 'Tree Algorithms',
    sampleInput: 'Find LCA(20, 40) in BST rooted at 50',
    sampleOutput: 'LCA(20, 40) = 30',
    keySectionExplanations: [
      { lines: '7-14', title: 'BST-Property Walk', explanation: 'Uses the BST ordering property: if both targets are smaller, go left; if both are larger, go right; otherwise the current node is the LCA.' },
    ],
    code: `/*
 * Lowest Common Ancestor in a Binary Search Tree (C11)
 * Time Complexity: O(h) where h is tree height
 */
#include <stdio.h>

typedef struct Node { int key; struct Node *left, *right; } Node;

Node* findLCA(Node *root, int n1, int n2) {
    Node *cur = root;
    while (cur) {
        if (n1 < cur->key && n2 < cur->key) {
            cur = cur->left;              // Both smaller: go LEFT
        } else if (n1 > cur->key && n2 > cur->key) {
            cur = cur->right;             // Both larger: go RIGHT
        } else {
            return cur;                   // LCA FOUND: split point
        }
    }
    return NULL; // Not found
}

int main() {
    /* Example: LCA(20, 40) in tree rooted at 50 */
    return 0;
}`,
  },

  /* ========================= GRAPH ALGORITHMS ========================= */
  bfs: {
    id: 'bfs',
    title: 'Breadth First Search (BFS)',
    category: 'Graph Algorithms',
    sampleInput: 'Graph with 6 vertices, Start: 0',
    sampleOutput: 'Visit order: 0, 1, 2, 3, 4, 5',
    keySectionExplanations: [
      { lines: '8-14', title: 'FIFO Queue Processing', explanation: 'Dequeues a vertex, visits it, and enqueues every unvisited neighbor, ensuring level-by-level exploration.' },
    ],
    code: `/*
 * Breadth First Search (BFS) in C11
 * Time Complexity: O(V + E)
 */
#include <stdio.h>
#include <stdbool.h>

#define MAXV 32

void bfs(int adj[MAXV][MAXV], int V, int start) {
    bool visited[MAXV] = {false};
    int queue[MAXV], front = 0, rear = 0;
    visited[start] = true;
    queue[rear++] = start;

    while (front < rear) {
        int u = queue[front++]; // Dequeue
        printf("%d ", u);       // Visit vertex

        for (int v = 0; v < V; v++) {
            if (adj[u][v] && !visited[v]) {
                visited[v] = true;
                queue[rear++] = v; // Enqueue unvisited neighbor
            }
        }
    }
}

int main() {
    int V = 6;
    int adj[MAXV][MAXV] = {0};
    bfs(adj, V, 0);
    return 0;
}`,
  },

  dfs: {
    id: 'dfs',
    title: 'Depth First Search (DFS)',
    category: 'Graph Algorithms',
    sampleInput: 'Graph with 6 vertices, Start: 0',
    sampleOutput: 'Visit order via recursive depth-first exploration',
    keySectionExplanations: [
      { lines: '8-15', title: 'Recursive Depth Exploration', explanation: 'Visits a vertex, then recurses fully into each unvisited neighbor before backtracking.' },
    ],
    code: `/*
 * Depth First Search (DFS) in C11 (recursive)
 * Time Complexity: O(V + E)
 */
#include <stdio.h>
#include <stdbool.h>

#define MAXV 32

void dfs(int adj[MAXV][MAXV], int V, bool visited[], int u) {
    visited[u] = true;
    printf("%d ", u); // Visit vertex

    for (int v = 0; v < V; v++) {
        if (adj[u][v] && !visited[v]) {
            dfs(adj, V, visited, v); // Recurse into unvisited neighbor
        }
    }
    // Backtrack implicitly on return
}

int main() {
    int V = 6;
    int adj[MAXV][MAXV] = {0};
    bool visited[MAXV] = {false};
    dfs(adj, V, visited, 0);
    return 0;
}`,
  },

  dijkstra: {
    id: 'dijkstra',
    title: "Dijkstra's Shortest Path Algorithm",
    category: 'Graph Algorithms',
    sampleInput: 'Weighted Graph with 6 vertices, Start: 0, Destination: 5',
    sampleOutput: 'Shortest Distance: 11',
    keySectionExplanations: [
      { lines: '29-37', title: 'Edge Relaxation Step', explanation: 'Tests if distance to vertex v can be improved by traveling through vertex u: dist[v] = min(dist[v], dist[u] + weight).' },
    ],
    code: `/*
 * Dijkstra's Single-Source Shortest Path in C11
 * Time Complexity: O(V^2) matrix or O(E log V) with Priority Queue
 */
#include <stdio.h>
#include <stdbool.h>

#define V 6
#define INF 999999

int minDistance(int dist[], bool sptSet[]) {
    int min = INF, min_index = -1;
    for (int v = 0; v < V; v++) {
        if (!sptSet[v] && dist[v] < min) { min = dist[v]; min_index = v; } // Select MIN
    }
    return min_index;
}

void dijkstra(int graph[V][V], int src) {
    int dist[V];
    bool sptSet[V];
    for (int i = 0; i < V; i++) { dist[i] = INF; sptSet[i] = false; }
    dist[src] = 0;

    for (int count = 0; count < V - 1; count++) {
        int u = minDistance(dist, sptSet); // Greedy minimum pick
        if (u == -1) break;
        sptSet[u] = true;

        for (int v = 0; v < V; v++) {
            if (!sptSet[v] && graph[u][v] && dist[u] != INF
                && dist[u] + graph[u][v] < dist[v]) {
                dist[v] = dist[u] + graph[u][v]; // RELAXATION
            }
        }
    }
    for (int i = 0; i < V; i++) printf("%d: %d\\n", i, dist[i]);
}

int main() {
    int graph[V][V] = {0};
    dijkstra(graph, 0);
    return 0;
}`,
  },

  'bellman-ford': {
    id: 'bellman-ford',
    title: 'Bellman-Ford Algorithm',
    category: 'Graph Algorithms',
    sampleInput: 'Graph with negative weights allowed, Start: 0',
    sampleOutput: 'Shortest distances, or negative-cycle detection',
    keySectionExplanations: [
      { lines: '9-18', title: 'V-1 Relaxation Passes', explanation: 'Relaxes every edge up to |V|-1 times — guaranteed to find shortest paths if no negative cycle exists.' },
      { lines: '22-28', title: 'Negative Cycle Detection', explanation: 'A further relaxation that still improves a distance after |V|-1 passes proves a negative-weight cycle exists.' },
    ],
    code: `/*
 * Bellman-Ford Algorithm in C11
 * Handles negative edge weights; detects negative cycles
 * Time Complexity: O(V * E)
 */
#include <stdio.h>

#define INF 999999

typedef struct { int u, v, w; } Edge;

void bellmanFord(Edge edges[], int E, int V, int src) {
    int dist[32];
    for (int i = 0; i < V; i++) dist[i] = INF;
    dist[src] = 0;

    for (int i = 1; i <= V - 1; i++) {           // |V|-1 passes
        for (int j = 0; j < E; j++) {
            int u = edges[j].u, v = edges[j].v, w = edges[j].w;
            if (dist[u] != INF && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w; // Relax edge
            }
        }
    }

    for (int j = 0; j < E; j++) {                 // Check for negative cycle
        int u = edges[j].u, v = edges[j].v, w = edges[j].w;
        if (dist[u] != INF && dist[u] + w < dist[v]) {
            printf("Negative weight cycle detected!\\n");
            return;
        }
    }
    for (int i = 0; i < V; i++) printf("%d: %d\\n", i, dist[i]);
}

int main() {
    Edge edges[9];
    bellmanFord(edges, 9, 6, 0);
    return 0;
}`,
  },

  'floyd-warshall': {
    id: 'floyd-warshall',
    title: 'Floyd-Warshall Algorithm',
    category: 'Graph Algorithms',
    sampleInput: 'All-pairs shortest paths for a 6-vertex graph',
    sampleOutput: 'V x V distance matrix with shortest path for every pair',
    keySectionExplanations: [
      { lines: '9-16', title: 'Triple Nested DP', explanation: 'For every intermediate vertex k, checks whether routing i -> k -> j is shorter than the current known i -> j distance.' },
    ],
    code: `/*
 * Floyd-Warshall All-Pairs Shortest Path in C11
 * Time Complexity: O(V^3), Space Complexity: O(V^2)
 */
#include <stdio.h>

#define V 6
#define INF 999999

void floydWarshall(int dist[V][V]) {
    for (int k = 0; k < V; k++) {           // Intermediate pivot vertex
        for (int i = 0; i < V; i++) {
            for (int j = 0; j < V; j++) {
                if (dist[i][k] != INF && dist[k][j] != INF
                    && dist[i][k] + dist[k][j] < dist[i][j]) {
                    dist[i][j] = dist[i][k] + dist[k][j]; // Path improved via k
                }
            }
        }
    }
}

int main() {
    int dist[V][V];
    for (int i = 0; i < V; i++)
        for (int j = 0; j < V; j++)
            dist[i][j] = (i == j) ? 0 : INF;
    floydWarshall(dist);
    return 0;
}`,
  },

  kruskal: {
    id: 'kruskal',
    title: "Kruskal's Minimum Spanning Tree",
    category: 'Graph Algorithms',
    sampleInput: 'Weighted graph, find MST',
    sampleOutput: 'Sorted edges added if they connect disjoint sets',
    keySectionExplanations: [
      { lines: '7-11', title: 'Disjoint Set Union (Find)', explanation: 'Path-compressed find() locates the representative root of a vertex\'s set.' },
      { lines: '20-29', title: 'Edge Selection by Weight', explanation: 'Processes edges in ascending weight order, adding an edge to the MST only if it connects two different sets (no cycle formed).' },
    ],
    code: `/*
 * Kruskal's Minimum Spanning Tree (MST) Algorithm in C11
 * Uses Disjoint Set Union (Union-Find). Time: O(E log E)
 */
#include <stdio.h>

typedef struct { int u, v, w; } Edge;

int find(int parent[], int i) {
    if (parent[i] == i) return i;
    return parent[i] = find(parent, parent[i]); // Path compression
}

void unionSets(int parent[], int rank[], int x, int y) {
    int rx = find(parent, x), ry = find(parent, y);
    if (rank[rx] < rank[ry]) parent[rx] = ry;
    else if (rank[rx] > rank[ry]) parent[ry] = rx;
    else { parent[ry] = rx; rank[rx]++; }
}

void kruskalMST(Edge edges[], int E, int V) {
    int parent[32], rank[32] = {0};
    for (int i = 0; i < V; i++) parent[i] = i;

    // (edges assumed pre-sorted ascending by weight)
    int mstWeight = 0, mstEdges = 0;
    for (int i = 0; i < E && mstEdges < V - 1; i++) {
        int ru = find(parent, edges[i].u);
        int rv = find(parent, edges[i].v);
        if (ru != rv) {                     // Connects disjoint sets
            unionSets(parent, rank, ru, rv);
            mstWeight += edges[i].w;
            mstEdges++;
        }
        // else: would form a CYCLE -> rejected
    }
    printf("MST total weight: %d\\n", mstWeight);
}

int main() {
    Edge edges[9];
    kruskalMST(edges, 9, 6);
    return 0;
}`,
  },

  prim: {
    id: 'prim',
    title: "Prim's Minimum Spanning Tree",
    category: 'Graph Algorithms',
    sampleInput: 'Weighted graph, Start: 0',
    sampleOutput: 'MST grown greedily from the starting vertex',
    keySectionExplanations: [
      { lines: '9-13', title: 'Minimum Key Selection', explanation: 'Greedily picks the unvisited vertex with the smallest edge weight connecting it to the growing MST.' },
      { lines: '18-24', title: 'Cut Update', explanation: 'After adding a vertex to the MST, updates the key[] of its neighbors if a cheaper connecting edge is found.' },
    ],
    code: `/*
 * Prim's Minimum Spanning Tree (MST) Algorithm in C11
 * Time Complexity: O(V^2) with adjacency matrix, O(E log V) with heap
 */
#include <stdio.h>
#include <stdbool.h>

#define V 6
#define INF 999999

void primMST(int graph[V][V], int start) {
    int key[V], parent[V];
    bool inMST[V] = {false};
    for (int i = 0; i < V; i++) key[i] = INF;
    key[start] = 0;

    for (int count = 0; count < V - 1; count++) {
        int u = -1, minKey = INF;
        for (int v = 0; v < V; v++) {
            if (!inMST[v] && key[v] < minKey) { minKey = key[v]; u = v; } // Minimum key
        }
        if (u == -1) break;
        inMST[u] = true; // Added to MST

        for (int v = 0; v < V; v++) {
            if (graph[u][v] && !inMST[v] && graph[u][v] < key[v]) {
                parent[v] = u;
                key[v] = graph[u][v]; // Updated crossing edge
            }
        }
    }
}

int main() {
    int graph[V][V] = {0};
    primMST(graph, 0);
    return 0;
}`,
  },

  'topological-sort': {
    id: 'topological-sort',
    title: "Topological Sorting (Kahn's Algorithm)",
    category: 'Graph Algorithms',
    sampleInput: 'Directed Acyclic Graph (DAG)',
    sampleOutput: 'Linear ordering respecting all directed edges',
    keySectionExplanations: [
      { lines: '8-12', title: 'In-Degree Initialization', explanation: 'Counts how many incoming edges point to each vertex; vertices with in-degree 0 have no prerequisites.' },
      { lines: '16-24', title: 'Kahn\'s Queue Processing', explanation: 'Repeatedly removes a zero-in-degree vertex, outputs it, and decrements the in-degree of its neighbors, enqueueing any that drop to zero.' },
    ],
    code: `/*
 * Topological Sort (Kahn's Algorithm, BFS-based) in C11
 * Only valid on a Directed Acyclic Graph (DAG). Time: O(V + E)
 */
#include <stdio.h>

#define V 6

void topologicalSort(int adj[V][V]) {
    int inDegree[V] = {0};
    for (int u = 0; u < V; u++)
        for (int v = 0; v < V; v++)
            if (adj[u][v]) inDegree[v]++; // Count incoming edges

    int queue[V], front = 0, rear = 0;
    for (int i = 0; i < V; i++)
        if (inDegree[i] == 0) queue[rear++] = i; // Zero in-degree: enqueue

    int order[V], count = 0;
    while (front < rear) {
        int u = queue[front++];
        order[count++] = u; // Add to topological order

        for (int v = 0; v < V; v++) {
            if (adj[u][v]) {
                if (--inDegree[v] == 0) queue[rear++] = v; // Dropped to 0: enqueue
            }
        }
    }

    if (count != V) printf("CYCLE DETECTED: not a DAG\\n");
    else for (int i = 0; i < count; i++) printf("%d ", order[i]);
}

int main() {
    int adj[V][V] = {0};
    topologicalSort(adj);
    return 0;
}`,
  },
};
