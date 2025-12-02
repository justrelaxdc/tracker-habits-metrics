import { App, normalizePath } from "obsidian";
import { trackerStore } from "../store";
import type { IconizeData } from "../store";
import { logError } from "../utils/notifications";

// Polling interval for checking icon file changes (2 seconds)
// stat() is a very lightweight operation - only checks file metadata, not content
const ICONIZE_POLL_INTERVAL_MS = 2000;

/**
 * Service for integration with Iconize plugin
 * Reads icon data from .obsidian/plugins/obsidian-icon-folder/data.json
 * Updates the global store which triggers reactive updates in Icon components
 */
export class IconizeService {
  private iconData: IconizeData | null = null;
  private dataLoaded: boolean = false;
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private lastModifiedTime: number = 0;
  private iconDataPath: string = "";
  
  // Callback to check if there are active tracker blocks
  private hasActiveBlocks: (() => boolean) | null = null;

  constructor(private readonly app: App) {}

  /**
   * Set callback to check for active blocks
   * Polling only happens when trackers are displayed
   */
  setActiveBlocksChecker(checker: () => boolean): void {
    this.hasActiveBlocks = checker;
  }

  /**
   * Loads icon data from Iconize plugin data file
   * Updates the global store for reactive updates
   */
  async loadIconizeData(): Promise<void> {
    const configDir = this.app.vault.configDir || ".obsidian";
    const relativePath = normalizePath(`${configDir}/plugins/obsidian-icon-folder/data.json`);
    this.iconDataPath = relativePath;

    try {
      // Try to read file using adapter (expects relative path)
      try {
        const content = await this.app.vault.adapter.read(relativePath);
        this.iconData = JSON.parse(content);
        this.dataLoaded = true;
        
        // Update global store for reactive updates
        trackerStore.setIconizeData(this.iconData);
        
        // Get file modification time
        try {
          const stat = await this.app.vault.adapter.stat(relativePath);
          this.lastModifiedTime = stat?.mtime || 0;
        } catch {
          // If stat fails, use current time
          this.lastModifiedTime = Date.now();
        }
      } catch (readError) {
        // File doesn't exist or can't be read
        this.iconData = null;
        this.dataLoaded = true;
        this.lastModifiedTime = 0;
        trackerStore.setIconizeData(null);
      }
    } catch (error) {
      // Silently fail if Iconize is not installed or data is invalid
      logError("[Iconize] Error loading data", error);
      this.iconData = null;
      this.dataLoaded = true;
      this.lastModifiedTime = 0;
      trackerStore.setIconizeData(null);
    }
  }

  /**
   * Starts watching the icon data file for changes
   * Uses a 2 second interval, only checks when there are active blocks
   * stat() is lightweight - only reads file metadata
   */
  startWatching(): void {
    // Stop existing watcher if any
    this.stopWatching();
    
    // Check for file changes every 2 seconds (only when active blocks exist)
    this.watchInterval = setInterval(async () => {
      // Skip if no active tracker blocks are displayed
      if (this.hasActiveBlocks && !this.hasActiveBlocks()) {
        return;
      }
      
      if (!this.iconDataPath) return;
      
      try {
        const stat = await this.app.vault.adapter.stat(this.iconDataPath);
        const currentMtime = stat?.mtime || 0;
        
        // If file was modified, reload data
        if (currentMtime > this.lastModifiedTime) {
          this.dataLoaded = false; // Force reload
          await this.loadIconizeData();
        }
      } catch {
        // File might not exist or be inaccessible, ignore
      }
    }, ICONIZE_POLL_INTERVAL_MS);
  }

  /**
   * Stops watching the icon data file
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  /**
   * Called when a file or folder is renamed
   * Iconize plugin automatically updates its data.json with the new path,
   * so we just need to reload data after a short delay to pick up the changes
   */
  updateIconPath(oldPath: string, newPath: string): void {
    // Iconize automatically updates icons for renamed files
    // We just need to reload data after a short delay to pick up the changes
    this.reloadAfterDelay(300);
  }

  /**
   * Reload icon data after a delay
   * Useful after file operations where Iconize needs time to update its data
   */
  private reloadAfterDelay(delayMs: number): void {
    setTimeout(async () => {
      // Force reload by resetting mtime check
      this.lastModifiedTime = 0;
      await this.loadIconizeData();
    }, delayMs);
  }

  /**
   * Invalidates cached data (useful if Iconize data changes)
   */
  invalidateCache(): void {
    this.dataLoaded = false;
    this.iconData = null;
    trackerStore.setIconizeData(null);
  }
}
