import type { TFile, TFolder, App } from "obsidian";
import type { TrackerFileOptions } from "../../domain/types";
import type { TrackerFileService } from "../../services/tracker-file-service";
import type { FolderTreeService } from "../../services/folder-tree-service";
import { MAX_CACHE_SIZE } from "../../constants";

export interface TrackerState {
  entries: Map<string, string | number>;
  fileOpts: TrackerFileOptions;
}

/**
 * Manages tracker state caching with LRU eviction policy
 * Uses Map<string, number> for O(1) access time tracking instead of array with O(n) indexOf
 */
export class StateManager {
  private trackerState: Map<string, TrackerState> = new Map();
  // LRU tracking: Map of filePath -> last access timestamp
  private accessTimestamps: Map<string, number> = new Map();

  constructor(
    private readonly app: App,
    private readonly trackerFileService: TrackerFileService,
    private readonly folderTreeService: FolderTreeService
  ) {}

  /**
   * Update access timestamp for LRU cache - O(1) operation
   */
  private updateAccessTime(filePath: string): void {
    this.accessTimestamps.set(filePath, Date.now());
  }

  /**
   * Find and evict least recently used cache entry - O(n) only when eviction needed
   */
  private evictIfNeeded(): void {
    if (this.trackerState.size >= MAX_CACHE_SIZE) {
      // Find the entry with the oldest timestamp
      let oldestPath: string | null = null;
      let oldestTime = Infinity;
      
      for (const [path, timestamp] of this.accessTimestamps) {
        if (timestamp < oldestTime) {
          oldestTime = timestamp;
          oldestPath = path;
        }
      }
      
      if (oldestPath) {
        this.trackerState.delete(oldestPath);
        this.accessTimestamps.delete(oldestPath);
      }
    }
  }

  /**
   * Ensure tracker state is loaded for a file
   */
  async ensureTrackerState(file: TFile): Promise<TrackerState> {
    const existing = this.trackerState.get(file.path);
    if (existing) {
      // Update access time for LRU - O(1)
      this.updateAccessTime(file.path);
      return existing;
    }
    
    // Evict LRU entry if cache is full
    this.evictIfNeeded();
    
    const [entries, fileOpts] = await Promise.all([
      this.trackerFileService.readAllEntries(file),
      this.trackerFileService.getFileTypeFromFrontmatter(file)
    ]);
    const state = { entries, fileOpts };
    this.trackerState.set(file.path, state);
    this.updateAccessTime(file.path);
    return state;
  }

  /**
   * Clear tracker state for a specific path - O(1)
   */
  clearTrackerState(path: string): void {
    this.trackerState.delete(path);
    this.accessTimestamps.delete(path);
  }

  /**
   * Clears all backend state (trackerState, FolderTreeService cache)
   * Use sparingly - prefer selective cache invalidation
   */
  async clearAllCaches(): Promise<void> {
    this.trackerState.clear();
    this.accessTimestamps.clear();
    this.folderTreeService.invalidate();
  }

  /**
   * Invalidate cache for a folder and all its contents
   */
  invalidateCacheForFolder(folderPath: string, normalizePath: (p: string) => string): void {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
    // Use duck typing to check if it's a folder
    if (folder && 'children' in folder) {
      this.clearCacheForFolder(folder as TFolder);
    }
  }

  private clearCacheForFolder(folder: TFolder): void {
    for (const child of folder.children) {
      if ('extension' in child && (child as TFile).extension === 'md') {
        this.clearTrackerState(child.path);
      } else if ('children' in child) {
        this.clearCacheForFolder(child as TFolder);
      }
    }
  }

  /**
   * Move tracker state from old path to new path - O(1)
   */
  moveTrackerState(oldPath: string, newPath: string): void {
    if (oldPath === newPath) return;
    
    const state = this.trackerState.get(oldPath);
    const timestamp = this.accessTimestamps.get(oldPath);
    
    if (state) {
      // Move state to new path
      this.trackerState.delete(oldPath);
      this.trackerState.set(newPath, state);
      
      // Move timestamp to new path
      this.accessTimestamps.delete(oldPath);
      if (timestamp !== undefined) {
        this.accessTimestamps.set(newPath, timestamp);
      } else {
        this.updateAccessTime(newPath);
      }
    } else {
      // Just clean up any stale entries
      this.trackerState.delete(newPath);
      this.accessTimestamps.delete(newPath);
    }
  }

  /**
   * Updates trackerState after renaming multiple files/folders
   */
  updateTrackerStateAfterRename(newPathsMap: Map<string, string>): void {
    for (const [oldPath, newPath] of newPathsMap.entries()) {
      this.moveTrackerState(oldPath, newPath);
    }
  }

  /**
   * Updates trackerState for all trackers inside renamed folders
   */
  updateTrackerStateForRenamedFolders(
    folderPathsMap: Map<string, string>,
    normalizePath: (p: string) => string
  ): void {
    const filePathsMap = new Map<string, string>();
    
    for (const [oldFolderPath, newFolderPath] of folderPathsMap.entries()) {
      const oldFolder = this.app.vault.getAbstractFileByPath(oldFolderPath);
      if (!oldFolder || !('children' in oldFolder)) continue;
      
      const getAllFiles = (folder: TFolder): TFile[] => {
        const files: TFile[] = [];
        for (const child of folder.children) {
          if ('extension' in child && (child as TFile).extension === 'md') {
            files.push(child as TFile);
          } else if ('children' in child) {
            files.push(...getAllFiles(child as TFolder));
          }
        }
        return files;
      };
      
      const files = getAllFiles(oldFolder as TFolder);
      const normalizedOldPath = normalizePath(oldFolderPath);
      const normalizedNewPath = normalizePath(newFolderPath);
      
      for (const file of files) {
        const normalizedFilePath = normalizePath(file.path);
        if (normalizedFilePath.startsWith(normalizedOldPath + '/')) {
          const relativePath = normalizedFilePath.substring(normalizedOldPath.length);
          const newFilePath = normalizedNewPath + relativePath;
          filePathsMap.set(file.path, newFilePath);
        }
      }
    }
    
    this.updateTrackerStateAfterRename(filePathsMap);
  }
}
