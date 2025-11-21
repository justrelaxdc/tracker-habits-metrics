import { App, TFile, TFolder } from "obsidian";
import { parseFilename, formatFilename } from "../utils/filename-parser";

/**
 * Service for managing tracker and folder ordering through filename prefixes
 */
export class TrackerOrderService {
  constructor(private readonly app: App) {}

  /**
   * Reorders trackers in a folder by renaming them with numeric prefixes
   * @param folderPath Path to the folder containing trackers
   * @param newOrder Array of files in the desired order
   */
  async reorderTrackers(folderPath: string, newOrder: TFile[]): Promise<void> {
    if (newOrder.length === 0) return;

    // Determine prefix width based on the number of files
    const prefixWidth = newOrder.length >= 100 ? 3 : newOrder.length >= 10 ? 2 : 2;

    // Rename files with correct prefixes
    for (let i = 0; i < newOrder.length; i++) {
      const file = newOrder[i];
      const parsed = parseFilename(file.basename);
      const newBasename = formatFilename(parsed.name, i + 1);
      const newPath = `${folderPath}/${newBasename}.md`;

      if (file.path !== newPath) {
        await this.app.vault.rename(file, newPath);
      }
    }
  }

  /**
   * Reorders folders in a parent folder by renaming them with numeric prefixes
   * @param parentFolderPath Path to the parent folder
   * @param newOrder Array of folders in the desired order
   */
  async reorderFolders(parentFolderPath: string, newOrder: TFolder[]): Promise<void> {
    if (newOrder.length === 0) return;

    // Determine prefix width based on the number of folders
    const prefixWidth = newOrder.length >= 100 ? 3 : newOrder.length >= 10 ? 2 : 2;

    // Rename folders with correct prefixes
    for (let i = 0; i < newOrder.length; i++) {
      const folder = newOrder[i];
      const parsed = parseFilename(folder.name);
      const newName = formatFilename(parsed.name, i + 1);
      const newPath = parentFolderPath ? `${parentFolderPath}/${newName}` : newName;

      if (folder.path !== newPath) {
        await this.app.vault.rename(folder, newPath);
      }
    }
  }
}

