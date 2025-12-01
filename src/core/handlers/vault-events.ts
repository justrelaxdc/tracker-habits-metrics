import type { TFile, TFolder } from "obsidian";
import type { TrackerSettings } from "../../domain/types";
import type { SortOrderManager } from "../managers/sort-order-manager";
import type { StateManager } from "../managers/state-manager";
import type { FolderTreeService } from "../../services/folder-tree-service";

/**
 * Handles vault events (rename, delete) for trackers
 */
export class VaultEventHandlers {
  constructor(
    private readonly sortOrderManager: SortOrderManager,
    private readonly stateManager: StateManager,
    private readonly folderTreeService: FolderTreeService,
    private readonly getSettings: () => TrackerSettings,
    private readonly normalizePath: (path: string) => string,
    private readonly getFolderPathFromFile: (path: string) => string
  ) {}

  /**
   * Handles rename events from Obsidian vault
   */
  handleRename(file: TFile | TFolder, oldPath: string): void {
    const settings = this.getSettings();
    if (!settings.customSortOrder) {
      return;
    }

    const normalizedOldPath = this.normalizePath(oldPath);
    const normalizedNewPath = this.normalizePath(file.path);
    const isFolder = 'children' in file;

    void this.sortOrderManager.updateCustomSortOrderOnRename(
      normalizedOldPath,
      normalizedNewPath,
      isFolder,
      this.getFolderPathFromFile,
      this.normalizePath
    );
  }

  /**
   * Handles file deletion events
   */
  async handleFileDelete(file: TFile, filePath: string): Promise<void> {
    // Update sort order
    await this.sortOrderManager.handleFileDeleteSortOrder(
      filePath,
      this.getFolderPathFromFile,
      this.normalizePath
    );
    
    // Invalidate folder tree cache
    const folderPath = this.getFolderPathFromFile(filePath);
    if (folderPath) {
      this.folderTreeService.invalidate(folderPath);
    }
  }

  /**
   * Handles folder deletion events
   */
  async handleFolderDelete(folderPath: string): Promise<void> {
    // Update sort order
    await this.sortOrderManager.handleFolderDeleteSortOrder(
      folderPath,
      this.normalizePath
    );
    
    // Update folder tree service settings
    this.folderTreeService.updateSettings(this.getSettings());
    
    // Invalidate folder tree cache
    this.folderTreeService.invalidate(folderPath);
  }

  /**
   * Handle tracker renamed event
   */
  handleTrackerRenamed(oldPath: string, file: TFile): void {
    this.stateManager.moveTrackerState(oldPath, file.path);
  }
}

