import type { TFile } from "obsidian";
import type { TrackerFileOptions } from "../domain/types";

interface CacheEntry {
  mtime: number;
  frontmatter?: TrackerFileOptions;
  entries?: Map<string, string | number>;
}

export class TrackerDataCache {
  private readonly cache = new Map<string, CacheEntry>();

  private getKey(file: TFile): string {
    return file.path;
  }

  private getMtime(file: TFile): number {
    return file.stat?.mtime ?? 0;
  }

  private ensureEntry(file: TFile): CacheEntry {
    const key = this.getKey(file);
    let entry = this.cache.get(key);
    if (!entry) {
      entry = { mtime: this.getMtime(file) };
      this.cache.set(key, entry);
    }
    return entry;
  }

  private isStale(file: TFile, entry?: CacheEntry): boolean {
    if (!entry) return true;
    return entry.mtime !== this.getMtime(file);
  }

  invalidate(path: string) {
    this.cache.delete(path);
  }

  invalidateAll() {
    this.cache.clear();
  }

  async getFrontmatter(
    file: TFile,
    loader: () => Promise<TrackerFileOptions>,
  ): Promise<TrackerFileOptions> {
    const key = this.getKey(file);
    const entry = this.cache.get(key);
    if (this.isStale(file, entry) || !entry?.frontmatter) {
      const freshEntry: CacheEntry = {
        mtime: this.getMtime(file),
        frontmatter: await loader(),
        entries: this.isStale(file, entry) ? undefined : entry?.entries,
      };
      this.cache.set(key, freshEntry);
      return freshEntry.frontmatter ?? {};
    }
    return entry.frontmatter;
  }

  async getEntries(
    file: TFile,
    loader: () => Promise<Map<string, string | number>>,
  ): Promise<Map<string, string | number>> {
    const key = this.getKey(file);
    const entry = this.cache.get(key);
    if (this.isStale(file, entry) || !entry?.entries) {
      const freshEntry: CacheEntry = {
        mtime: this.getMtime(file),
        entries: await loader(),
        frontmatter: this.isStale(file, entry) ? undefined : entry?.frontmatter,
      };
      this.cache.set(key, freshEntry);
      return freshEntry.entries ?? new Map();
    }
    return entry.entries;
  }
}


