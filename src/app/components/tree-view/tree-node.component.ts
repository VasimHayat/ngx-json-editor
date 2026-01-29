import { Component, input, computed, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JsonStateService } from '../../services/json-state.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="font-mono text-sm leading-6">
      <!-- Container for a single line -->
      <div class="flex items-start hover:bg-gray-100 rounded px-1 transition-colors duration-150 group">
        
        <!-- Toggle Button (only for objects/arrays) -->
        @if (isExpandable()) {
          <button 
            (click)="toggle()" 
            class="w-4 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none mr-1 select-none"
            aria-label="Toggle">
            <svg 
              class="w-3 h-3 transition-transform duration-200" 
              [class.rotate-90]="expanded()"
              fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 6L14 10L6 14V6Z" />
            </svg>
          </button>
        } @else {
          <span class="w-4 mr-1"></span>
        }

        <!-- Content -->
        <div class="flex-1 break-all flex items-center">
          
          <!-- Key (if exists) -->
          @if (key()) {
            <span class="text-purple-700 font-semibold opacity-95 mr-1" 
                  [class.bg-yellow-200]="isKeyMatch()">"{{ key() }}"</span>
            <span class="text-gray-800 mr-1">:</span> 
          }

          <!-- Value Display Logic -->
          @if (isExpandable()) {
            <!-- Object/Array Summary -->
            <span class="text-gray-500 cursor-pointer flex items-center" (click)="toggle()">
              @if (isArray()) {
                <span class="text-gray-900 font-bold mr-1">[</span>
                @if (!expanded()) { 
                  <span class="text-xs text-gray-400 mx-1 bg-gray-50 px-1 rounded border border-gray-100">{{ getChildCount() }}</span> 
                }
                @if (!expanded()) {
                  <span class="text-gray-900 font-bold">]</span>
                }
              } @else {
                <span class="text-gray-900 font-bold mr-1">{{ '{' }}</span>
                @if (!expanded()) { 
                   <span class="text-xs text-gray-400 mx-1 bg-gray-50 px-1 rounded border border-gray-100">{{ getChildCount() }}</span> 
                }
                @if (!expanded()) {
                  <span class="text-gray-900 font-bold">{{ '}' }}</span>
                }
              }
            </span>
          } @else {
            <!-- Primitive Values -->
            <span [class.bg-yellow-200]="isValueMatch()">
              @if (isString()) {
                <span class="text-green-600">"{{ value() }}"</span>
              } @else if (isNumber()) {
                <span class="text-red-600">{{ value() }}</span>
              } @else if (isBoolean()) {
                <span class="text-orange-600 font-bold">{{ value() }}</span>
              } @else if (isNull()) {
                <span class="text-blue-600 font-bold italic">null</span>
              }
            </span>
          }
        </div>
      </div>

      <!-- Children (Recursive) -->
      @if (expanded() && isExpandable()) {
        <div class="pl-5 border-l border-gray-200 ml-2.5">
          @for (item of children(); track $index) {
            <app-tree-node 
              [key]="item.key" 
              [value]="item.val">
            </app-tree-node>
          }
          <div class="pl-1 text-gray-500">
             @if (isArray()) { 
               <span class="text-gray-900 font-bold">]</span> 
             } @else { 
               <span class="text-gray-900 font-bold">{{ '}' }}</span> 
             }
          </div>
        </div>
      }
    </div>
  `
})
export class TreeNodeComponent {
  state = inject(JsonStateService);
  
  key = input<string | null>(null);
  value = input<any>(null);

  expanded = signal(true); 

  constructor() {
    // React to Search Query
    effect(() => {
      if (this.state.searchQuery()) {
        this.expanded.set(true);
      }
    });

    // React to Global Expand/Collapse Actions
    effect(() => {
      const cmd = this.state.treeCommand();
      if (cmd && this.isExpandable()) {
        this.expanded.set(cmd.action === 'expand');
      }
    });
  }

  isExpandable = computed(() => {
    const v = this.value();
    return v !== null && typeof v === 'object';
  });

  isArray = computed(() => Array.isArray(this.value()));

  isString = computed(() => typeof this.value() === 'string');
  isNumber = computed(() => typeof this.value() === 'number');
  isBoolean = computed(() => typeof this.value() === 'boolean');
  isNull = computed(() => this.value() === null);

  isKeyMatch = computed(() => {
    const q = this.state.searchQuery().toLowerCase();
    return q && this.key()?.toLowerCase().includes(q);
  });

  isValueMatch = computed(() => {
    const q = this.state.searchQuery().toLowerCase();
    if (!q) return false;
    if (this.isExpandable()) return false;
    return String(this.value()).toLowerCase().includes(q);
  });

  children = computed(() => {
    const v = this.value();
    if (!this.isExpandable()) return [];
    
    if (this.isArray()) {
      return (v as any[]).map((val, index) => ({ key: index.toString(), val: val }));
    } else {
      return Object.entries(v).map(([key, val]) => ({ key, val }));
    }
  });

  getChildCount() {
    const v = this.value();
    if (this.isArray()) return v.length;
    return Object.keys(v).length;
  }

  toggle() {
    this.expanded.update(e => !e);
  }
}