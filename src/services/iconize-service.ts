import { App } from "obsidian";
import { trackerStore } from "../store";
import type { IconizeData } from "../store";

// Polling interval for checking icon data changes (0.5 seconds)
// We use this method until Iconize plugin implements API for reactive updates
const ICONIZE_POLL_INTERVAL_MS = 500;

/**
 * Service for integration with Iconize plugin
 * Reads icon data from Iconize plugin data property
 * Updates the global store which triggers reactive updates in Icon components
 */
export class IconizeService {
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private lastDataHash: string = "";
  
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
   * Loads icon data from Iconize plugin data property
   * Updates the global store for reactive updates
   */
  loadIconizeData(): void {
    try {
      const iconizePlugin = this.getIconizePlugin();
      
      if (!iconizePlugin || !iconizePlugin.data) {
        trackerStore.setIconizeData(null);
        return;
      }

      // Extract icon data from plugin.data (path->icon mappings at root level)
      // Create a new object to ensure signal detects the change
      const iconData: IconizeData = { ...iconizePlugin.data };
      
      // Update hash for change detection
      this.lastDataHash = this.hashData(iconizePlugin.data);
      
      // Update global store for reactive updates (pass new object reference)
      trackerStore.setIconizeData(iconData);
    } catch {
      // Silently fail if Iconize is not installed or data is unavailable
      trackerStore.setIconizeData(null);
    }
  }

  /**
   * Starts watching the Iconize plugin data for changes
   * Uses polling interval, only checks when there are active blocks
   * Compares plugin.data object to detect changes
   */
  startWatching(): void {
    // Stop existing watcher if any
    this.stopWatching();
    
    // Load data immediately on start
    this.loadIconizeData();
    
    // Check for data changes every interval (only when active blocks exist)
    this.watchInterval = setInterval(() => {
      // Skip if no active tracker blocks are displayed
      if (this.hasActiveBlocks && !this.hasActiveBlocks()) {
        return;
      }
      
      try {
        const iconizePlugin = this.getIconizePlugin();
        
        if (!iconizePlugin || !iconizePlugin.data) {
          return;
        }
        
        // Create hash of current data
        const currentDataHash = this.hashData(iconizePlugin.data);
        
        // If data changed, reload
        if (currentDataHash !== this.lastDataHash) {
          this.lastDataHash = currentDataHash;
          this.loadIconizeData();
        }
      } catch {
        // Silently ignore errors
      }
    }, ICONIZE_POLL_INTERVAL_MS);
  }

  /**
   * Stops watching the icon data
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  /**
   * Called when a file or folder is renamed
   * Iconize plugin automatically updates its data with the new path,
   * so we reload data after a short delay to allow the plugin to update
   * @param _oldPath - Old file/folder path (unused, kept for interface compatibility)
   * @param _newPath - New file/folder path (unused, kept for interface compatibility)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameters kept for interface compatibility
  updateIconPath(_oldPath: string, _newPath: string): void {
    // Iconize plugin updates its data asynchronously after rename
    // Small delay ensures we pick up the updated data
    setTimeout(() => {
      this.loadIconizeData();
    }, 300);
  }

  /**
   * Creates a hash string from data object for comparison
   */
  private hashData(data: Record<string, unknown>): string {
    return JSON.stringify(data);
  }

  /**
   * Gets the Iconize plugin instance
   */
  private getIconizePlugin(): { data?: IconizeData } | null {
    const pluginsManager = this.app.plugins;
    const plugin = pluginsManager?.plugins?.['obsidian-icon-folder'] || pluginsManager?.getPlugin?.('obsidian-icon-folder');
    return (plugin as { data?: IconizeData } | null) || null;
  }
}
