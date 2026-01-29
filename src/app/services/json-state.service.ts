import { Injectable, signal, computed, effect } from '@angular/core';

export type TreeCommand = { action: 'expand' | 'collapse', _ts: number };

@Injectable({
  providedIn: 'root'
})
export class JsonStateService {
  // --- Core State ---
  // The raw string in the editor
  readonly jsonContent = signal<string>(`{
  "project": "Pro JSON Editor",
  "features": [
    "Syntax Highlighting",
    "Tree View",
    "Gemini AI Integration"
  ],
  "settings": {
    "theme": "light",
    "autoSave": true,
    "maxLines": 1000
  },
  "users": [
    { "id": 1, "name": "Alice", "active": true },
    { "id": 2, "name": "Bob", "active": false }
  ],
  "stats": null
}`);

  readonly searchQuery = signal<string>('');
  
  // Tree View Actions Global Signal
  readonly treeCommand = signal<TreeCommand | null>(null);

  // --- Derived State ---
  readonly parsedJson = computed(() => {
    try {
      return JSON.parse(this.jsonContent());
    } catch (e) {
      return null;
    }
  });

  readonly error = computed(() => {
    try {
      JSON.parse(this.jsonContent());
      return null;
    } catch (e: any) {
      return e.message;
    }
  });

  readonly isValid = computed(() => this.error() === null);

  // Filtered JSON for Tree View based on Search
  readonly filteredJson = computed(() => {
    const data = this.parsedJson();
    const query = this.searchQuery().trim().toLowerCase();
    
    if (!data || !query) return data;
    
    return this.filterData(data, query);
  });

  readonly stats = computed(() => {
    const json = this.parsedJson();
    if (!json) return { size: '0 B', items: 0 };
    const str = JSON.stringify(json);
    const bytes = new Blob([str]).size;
    
    const countKeys = (obj: any): number => {
      if (typeof obj !== 'object' || obj === null) return 0;
      let count = Object.keys(obj).length;
      Object.values(obj).forEach(val => {
        count += countKeys(val);
      });
      return count;
    };

    return {
      size: this.formatBytes(bytes),
      items: countKeys(json)
    };
  });

  // --- History Management ---
  private historyStack: string[] = [];
  private redoStack: string[] = [];
  private isUndoRedoOp = false;
  private maxHistory = 50;

  constructor() {
    // Initialize history with initial state
    this.historyStack.push(this.jsonContent());
  }

  updateContent(newContent: string, saveToHistory = true) {
    if (newContent === this.jsonContent()) return;

    // If this update comes from undo/redo, don't push to history stack
    if (this.isUndoRedoOp) {
      this.jsonContent.set(newContent);
      this.isUndoRedoOp = false;
      return;
    }

    if (saveToHistory) {
      // Basic debounce logic could go here, but for now we push on every major change
      this.historyStack.push(this.jsonContent());
      if (this.historyStack.length > this.maxHistory) {
        this.historyStack.shift();
      }
      // Clear redo stack on new change
      this.redoStack = [];
    }
    
    this.jsonContent.set(newContent);
  }

  undo() {
    if (this.historyStack.length === 0) return;
    
    const current = this.jsonContent();
    this.redoStack.push(current);
    
    const prev = this.historyStack.pop();
    if (prev !== undefined) {
      this.isUndoRedoOp = true;
      this.jsonContent.set(prev);
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    
    const current = this.jsonContent();
    this.historyStack.push(current);
    
    const next = this.redoStack.pop();
    if (next !== undefined) {
      this.isUndoRedoOp = true;
      this.jsonContent.set(next);
    }
  }

  reset() {
    this.jsonContent.set('{}');
    this.historyStack = ['{}'];
    this.redoStack = [];
    this.isUndoRedoOp = false;
  }

  get canUndo() { return this.historyStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  // --- Actions ---

  formatContent() {
    const parsed = this.parsedJson();
    if (parsed) {
      this.updateContent(JSON.stringify(parsed, null, 2));
    }
  }

  minifyContent() {
    const parsed = this.parsedJson();
    if (parsed) {
      this.updateContent(JSON.stringify(parsed));
    }
  }

  sortContent() {
    const parsed = this.parsedJson();
    if (parsed) {
      const sorted = this.sortObject(parsed);
      this.updateContent(JSON.stringify(sorted, null, 2));
    }
  }

  triggerTreeAction(action: 'expand' | 'collapse') {
    // We update the signal with a new object to ensure effects trigger even if action is same
    this.treeCommand.set({ action, _ts: Date.now() });
  }

  private sortObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj)
        .sort()
        .reduce((acc: any, key) => {
          acc[key] = this.sortObject(obj[key]);
          return acc;
        }, {});
    }
    return obj;
  }

  // --- Search / Filter Logic ---

  setSearchQuery(query: string) {
    this.searchQuery.set(query);
  }

  private filterData(data: any, query: string): any {
    // If primitive match
    if (typeof data === 'string' && data.toLowerCase().includes(query)) return data;
    if ((typeof data === 'number' || typeof data === 'boolean') && String(data).toLowerCase().includes(query)) return data;
    
    if (Array.isArray(data)) {
      const filtered = data
        .map(item => this.filterData(item, query))
        .filter(item => item !== undefined);
      return filtered.length > 0 ? filtered : undefined;
    }
    
    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      let hasMatch = false;
      
      Object.keys(data).forEach(key => {
        // If key matches, keep the whole subtree (or arguably just the key?)
        // Let's keep subtree for better context if key matches
        if (key.toLowerCase().includes(query)) {
          result[key] = data[key];
          hasMatch = true;
        } else {
          // Otherwise check value
          const filteredVal = this.filterData(data[key], query);
          if (filteredVal !== undefined) {
            result[key] = filteredVal;
            hasMatch = true;
          }
        }
      });
      
      return hasMatch ? result : undefined;
    }
    
    return undefined;
  }

  // --- Utilities ---
  private formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
}