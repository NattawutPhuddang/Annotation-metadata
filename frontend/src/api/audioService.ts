// src/api/audioService.ts
import { API_BASE } from './client';
import { AudioItem } from '../types';

export const audioService = {
  // --- Loading Data ---
  async loadTSV(filename: string): Promise<AudioItem[]> {
    try {
      const res = await fetch(`${API_BASE}/api/load-file?filename=${filename}`);
      if (!res.ok) return [];
      const txt = await res.text();
      return txt
        .split("\n")
        .slice(1)
        .map((r) => {
          const [f, t] = r.trim().split("\t");
          return f && t ? { filename: f, text: t } : null;
        })
        .filter(Boolean) as AudioItem[];
    } catch {
      return [];
    }
  },

  async loadChanges(): Promise<Array<{ original: string; changed: string }>> {
    try {
      const res = await fetch(`${API_BASE}/api/load-file?filename=ListOfChange.tsv`);
      if (!res.ok) return [];
      const txt = await res.text();
      return txt
        .split("\n")
        .slice(1)
        .map((r) => {
          const [o, c] = r.trim().split("\t");
          return o && c ? { original: o, changed: c } : null;
        })
        .filter(Boolean) as any;
    } catch {
      return [];
    }
  },
    async moveToTrash(filename: string, sourceFile: string = 'Correct.tsv') {
    const res = await fetch(`${API_BASE}/api/move-to-trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, sourceFile }),
    });
    if (!res.ok) throw new Error('Failed to move to trash');
    return res.json();
  },

  async checkFileMtime(filename: string): Promise<number> {
    try {
      const res = await fetch(`${API_BASE}/api/check-mtime?filename=${filename}`);
      const data = await res.json();
      return data.mtime || 0;
    } catch {
      return 0;
    }
  },

  // --- Saving Data ---
  async appendTsv(filename: string, item: AudioItem) {
    await fetch(`${API_BASE}/api/append-tsv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, item }),
    });
  },

  async deleteTsvEntry(filename: string, key: string) {
    await fetch(`${API_BASE}/api/delete-tsv-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, key }),
    });
  },

  async saveChangeLog(original: string, changed: string) {
    await fetch(`${API_BASE}/api/append-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original, changed }),
    });
  },

  // --- NLP & Processing ---
  async tokenize(text: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/tokenize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  },

  async tokenizeBatch(texts: string[]): Promise<string[][]> {
    const res = await fetch(`${API_BASE}/api/tokenize-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    return await res.json();
  },

  async scanAudio(path: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/scan-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return await res.json();
  },

  // --- Utils ---
  getAudioUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("blob:") || path.startsWith("http")) return path;
    return `${API_BASE}/api/audio?path=${encodeURIComponent(path)}`;
  }
};