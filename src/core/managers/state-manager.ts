import type { TFile, TFolder, App } from "obsidian";
import type { TrackerFileOptions } from "../../domain/types";
import type { TrackerFileService } from "../../services/tracker-file-service";
import type { FolderTreeService } from "../../services/folder-tree-service";

export interface TrackerState {
  entries: Map<string, string | number>;
  fileOpts: TrackerFileOptions;
}

/**
 * Manages tracker state caching
 */
export class StateManager {
  private trackerState: Map<string, TrackerState> = new Map();
  private currentNotePath: string | null = null;
  // Track which files are referenced by which notes for selective cache invalidation
  private noteFileReferences: Map<string, Set<string>> = new Map();

  constructor(
    private readonly app: App,
    private readonly trackerFileService: TrackerFileService,
    private readonly folderTreeService: FolderTreeService
  ) {}

  /**
   * Check if note changed and selectively clear caches
   * Only clears caches for files that are no longer referenced
   */
  async checkNoteChange(notePath: string | null): Promise<boolean> {
    if (notePath !== this.currentNotePath) {
      const oldNotePath = this.currentNotePath;
      
      // Clear caches for files that were only referenced by the old note
      if (oldNotePath) {
        const oldNoteFiles = this.noteFileReferences.get(oldNotePath);
        if (oldNoteFiles) {
          // Check if any other note references these files
          const filesToKeep = new Set<string>();
          for (const [otherNotePath, files] of this.noteFileReferences.entries()) {
            if (otherNotePath !== oldNotePath) {
              for (const filePath of files) {
                filesToKeep.add(filePath);
              }
            }
          }
          
          // Clear caches for files that are no longer referenced
          for (const filePath of oldNoteFiles) {
            if (!filesToKeep.has(filePath)) {
              this.clearTrackerState(filePath);
            }
          }
          
          // Remove old note's file references
          this.noteFileReferences.delete(oldNotePath);
        }
      }
      
      this.currentNotePath = notePath;
      return true;
    }
    return false;
  }

  /**
   * Register a file reference for the current note
   */
  registerFileReference(filePath: string): void {
    if (!this.currentNotePath) return;
    
    let fileSet = this.noteFileReferences.get(this.currentNotePath);
    if (!fileSet) {
      fileSet = new Set();
      this.noteFileReferences.set(this.currentNotePath, fileSet);
    }
    fileSet.add(filePath);
  }

  /**
   * Ensure tracker state is loaded for a file
   */
  async ensureTrackerState(file: TFile): Promise<TrackerState> {
    // Register file reference for current note
    this.registerFileReference(file.path);
    
    const existing = this.trackerState.get(file.path);
    if (existing) {
      return existing;
    }
    
    const [entries, fileOpts] = await Promise.all([
      this.trackerFileService.readAllEntries(file),
      this.trackerFileService.getFileTypeFromFrontmatter(file)
    ]);
    const state = { entries, fileOpts };
    this.trackerState.set(file.path, state);
    return state;
  }

  /**
   * Clear tracker state for a specific path
   */
  clearTrackerState(path: string): void {
    this.trackerState.delete(path);
  }

  /**
   * Clears all backend state (trackerState, FolderTreeService cache)
   * Use sparingly - prefer selective cache invalidation
   */
  async clearAllCaches(): Promise<void> {
    this.trackerState.clear();
    this.noteFileReferences.clear();
    this.folderTreeService.invalidate();
  }

  /**
   * Invalidate cache for a folder and all its contents
   */
  invalidateCacheForFolder(folderPath: string, normalizePath: (p: string) => string): void {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (folder instanceof this.app.vault.adapter.constructor) {
      // This is a workaround since we can't import TFolder here directly
    }
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
   * Move tracker state from old path to new path
   */
  moveTrackerState(oldPath: string, newPath: string): void {
    if (oldPath === newPath) return;
    const state = this.trackerState.get(oldPath);
    if (state) {
      this.trackerState.delete(oldPath);
      this.trackerState.set(newPath, state);
    } else {
      this.trackerState.delete(newPath);
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

