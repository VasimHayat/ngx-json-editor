import { Component, ElementRef, ViewChild, inject, effect, AfterViewInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JsonStateService } from '../../services/json-state.service';

declare const ace: any;

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full w-full relative group">
      <div #editorContainer class="absolute inset-0 h-full"></div>
      
      <!-- Tree Mode Indicator -->
      @if (formattedMode) {
        <div class="absolute top-0 right-4 bg-green-100/80 text-green-800 text-[10px] px-2 py-0.5 rounded-b shadow-sm z-10 font-mono pointer-events-none backdrop-blur-sm">
          TREE / FORMATTED
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
  `]
})
export class CodeEditorComponent implements AfterViewInit, OnDestroy {
  state = inject(JsonStateService);
  
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;
  
  @Input() formattedMode = false;
  
  private editor: any;
  private isInternalUpdate = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Effect to sync State -> Editor
    effect(() => {
      const rawContent = this.state.jsonContent();
      let contentToDisplay = rawContent;

      // If in formatted/tree mode, try to pretty-print
      if (this.formattedMode) {
        try {
          const parsed = JSON.parse(rawContent);
          contentToDisplay = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // If invalid JSON, just show raw content so user can see/fix it
          contentToDisplay = rawContent;
        }
      }
      
      // Only update if the content is different and we didn't cause the update
      if (this.editor) {
        const currentVal = this.editor.getValue();
        if (contentToDisplay !== currentVal) {
          this.isInternalUpdate = true;
          // Set value and move cursor to start
          this.editor.setValue(contentToDisplay, -1);
          this.editor.clearSelection();
          
          // If formatted mode, maybe fold initially?
          // this.editor.getSession().foldAll(1); // Optional: Fold to level 1 for "Tree" feel?
          
          this.isInternalUpdate = false;
        }
      }
    });
  }

  ngAfterViewInit() {
    this.initAce();
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.editor) {
      this.editor.destroy();
    }
  }

  private initAce() {
    if (typeof ace === 'undefined') {
      console.error('Ace Editor script not loaded');
      return;
    }

    ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/');

    this.editor = ace.edit(this.editorContainer.nativeElement);
    this.editor.setTheme('ace/theme/tomorrow'); // Maybe 'chrome' or 'github' for cleaner look?
    this.editor.session.setMode('ace/mode/json');

    console.log(this.editor)
    
    this.editor.setOptions({
      fontSize: '13px',
      fontFamily: '"JetBrains Mono", monospace',
      showPrintMargin: false,
      useWorker: true,
      tabSize: 2,
      wrap: true,
      displayIndentGuides: true,
      foldStyle: 'markbeginend'
    });

    // Initial content set logic handled by effect, but might run before init
    // So we manually trigger once
    const raw = this.state.jsonContent();
    let initial = raw;
    if (this.formattedMode) {
      try { initial = JSON.stringify(JSON.parse(raw), null, 2); } catch {}
    }
    this.editor.setValue(initial, -1);
    this.editor.clearSelection();

    // Change Listener
    this.editor.on('change', () => {
      if (!this.isInternalUpdate) {
        const val = this.editor.getValue();
        // Even in formatted mode, typing updates the global state
        // If the user types invalid JSON, state updates to invalid.
        // The effect won't re-format (because parse fails), so it stays as user typed.
        this.state.updateContent(val);
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.editor.resize();
    });
    this.resizeObserver.observe(this.editorContainer.nativeElement);
  }

  foldAll() {
    if (this.editor) {
      this.editor.getSession().foldAll(1); // Fold at depth 1 for better "Tree" overview
    }
  }

  unfoldAll() {
    if (this.editor) {
      this.editor.getSession().unfold(null, true);
    }
  }
}