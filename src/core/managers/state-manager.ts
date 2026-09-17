import { TFile, TFolder, type App } from "obsidian";
import type { TrackerFileOptions } from "../../domain/types";
import type { TrackerFileService } from "../../services/tracker-file-service";
import type { FolderTreeService } from "../../services/folder-tree-service";
import { trackerStore } from "../../store";

export interface TrackerState {
  entries: Map<string, string | number>;
  fileOpts: TrackerFileOptions;
}

/**
 * Coordinates tracker state using trackerStore (@preact/signals)
 * as the single source of truth (SSOT). Eliminates duplicate cache layers.
 */
export class StateManager {
  constructor(
    private readonly app: App,
    private readonly trackerFileService: TrackerFileService,
    private readonly folderTreeService: FolderTreeService
  ) {}

  /**
   * Ensure tracker state is loaded for a file.
   * Reads from reactive trackerStore or loads directly from disk.
   */
  async ensureTrackerState(file: TFile): Promise<TrackerState> {
    const storeState = trackerStore.getTrackerState(file.path);
    if (storeState) {
      return {
        entries: storeState.entries,
        fileOpts: storeState.fileOptions,
      };
    }

    const { entries, fileOpts } = await this.trackerFileService.readTrackerFile(file);
    trackerStore.setTrackerState(file.path, {
      entries,
      fileOptions: fileOpts,
      lastUpdated: Date.now(),
    });

    return { entries, fileOpts };
  }

  /**
   * Clear tracker state for a specific path
   */
  clearTrackerState(path: string): void {
    trackerStore.clearTrackerState(path);
  }

  /**
   * Clears all state across store and folder tree
   */
  clearAllCaches(): void {
    trackerStore.clear();
    this.folderTreeService.invalidate();
  }

  /**
   * Invalidate cache for a folder and all its contents
   */
  invalidateCacheForFolder(folderPath: string, normalizePath: (p: string) => string): void {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (folder instanceof TFolder) {
      this.clearCacheForFolder(folder);
    }
  }

  private clearCacheForFolder(folder: TFolder): void {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        this.clearTrackerState(child.path);
      } else if (child instanceof TFolder) {
        this.clearCacheForFolder(child);
      }
    }
  }

  /**
   * Move tracker state from old path to new path in store
   */
  moveTrackerState(oldPath: string, newPath: string): void {
    if (oldPath === newPath) return;
    trackerStore.moveTrackerState(oldPath, newPath);
  }

  /**
   * Updates tracker state after renaming multiple files/folders
   */
  updateTrackerStateAfterRename(newPathsMap: Map<string, string>): void {
    for (const [oldPath, newPath] of newPathsMap.entries()) {
      this.moveTrackerState(oldPath, newPath);
    }
  }

  /**
   * Updates tracker state for all trackers inside renamed folders
   */
  updateTrackerStateForRenamedFolders(
    folderPathsMap: Map<string, string>,
    normalizePath: (p: string) => string
  ): void {
    const filePathsMap = new Map<string, string>();

    for (const [oldFolderPath, newFolderPath] of folderPathsMap.entries()) {
      const oldFolder = this.app.vault.getAbstractFileByPath(oldFolderPath);
      if (!oldFolder || !(oldFolder instanceof TFolder)) continue;

      const getAllFiles = (folder: TFolder): TFile[] => {
        const files: TFile[] = [];
        for (const child of folder.children) {
          if (child instanceof TFile && child.extension === "md") {
            files.push(child);
          } else if (child instanceof TFolder) {
            files.push(...getAllFiles(child));
          }
        }
        return files;
      };

      const files = getAllFiles(oldFolder);
      const normalizedOldPath = normalizePath(oldFolderPath);
      const normalizedNewPath = normalizePath(newFolderPath);

      for (const file of files) {
        const normalizedFilePath = normalizePath(file.path);
        if (normalizedFilePath.startsWith(normalizedOldPath + "/")) {
          const relativePath = normalizedFilePath.substring(normalizedOldPath.length);
          const newFilePath = normalizedNewPath + relativePath;
          filePathsMap.set(file.path, newFilePath);
        }
      }
    }

    this.updateTrackerStateAfterRename(filePathsMap);
  }
}
