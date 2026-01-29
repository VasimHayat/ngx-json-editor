import { Component, inject, signal, ViewChild, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JsonStateService } from './services/json-state.service';
import { GeminiService } from './services/gemini.service';
import { CodeEditorComponent } from './components/code-editor/code-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CodeEditorComponent],
  templateUrl:'app.html'
})
export class App {
  state = inject(JsonStateService);
  gemini = inject(GeminiService);

  // We can access all editors to trigger global actions
  @ViewChildren(CodeEditorComponent) editors!: QueryList<CodeEditorComponent>;

  viewMode = signal<'code' | 'tree' | 'split'>('split');
  isLoading = signal(false);
  notification = signal<string | null>(null);
  
  showGenerateModal = signal(false);
  generatePrompt = '';

  // --- Actions ---

  resetNew() {
    if (confirm('Create new document? This will clear current changes.')) {
      this.state.reset();
      this.showNotification('Editor cleared');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        this.state.updateContent(text);
        input.value = '';
        this.showNotification(`Loaded ${file.name}`);
      };
      reader.readAsText(file);
    }
  }

  saveFile() {
    const blob = new Blob([this.state.jsonContent()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `json-editor-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showNotification('File saved to downloads');
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.state.jsonContent());
      this.showNotification('Copied to clipboard! 📋');
    } catch (err) {
      console.error('Failed to copy', err);
      this.showNotification('Failed to copy');
    }
  }

  // --- UI Helpers ---

  showNotification(message: string) {
    this.notification.set(message);
    setTimeout(() => {
      this.notification.set(null);
    }, 2500);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  openUrlModal() {
    const url = prompt('Enter URL to JSON (must be CORS accessible):');
    if (url) {
      this.isLoading.set(true);
      fetch(url)
        .then(res => {
          if(!res.ok) throw new Error('Network response was not ok');
          return res.text();
        })
        .then(text => {
          this.state.updateContent(text);
          this.showNotification('JSON loaded from URL');
        })
        .catch(err => {
          alert('Failed to load URL: ' + err.message);
        })
        .finally(() => {
          this.isLoading.set(false);
        });
    }
  }

  openGenerateModal() { this.showGenerateModal.set(true); this.generatePrompt = ''; }
  closeGenerateModal() { this.showGenerateModal.set(false); }

  async fixJson() {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    try {
      const fixed = await this.gemini.fixJson(this.state.jsonContent());
      this.state.updateContent(fixed);
      this.state.formatContent();
      this.showNotification('JSON Fixed via Gemini AI ✨');
    } catch (e) {
      alert('AI Fix failed.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async confirmGenerate() {
    this.closeGenerateModal();
    this.isLoading.set(true);
    try {
      const generated = await this.gemini.generateJson(this.generatePrompt);
      this.state.updateContent(generated);
      this.state.formatContent();
      this.showNotification('Generated successfully ✨');
    } catch (e) {
      alert('Generation failed.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // View Actions applied to all active editors
  onExpandAll() {
    this.editors.forEach(editor => editor.unfoldAll());
  }

  onCollapseAll() {
    this.editors.forEach(editor => editor.foldAll());
  }
}