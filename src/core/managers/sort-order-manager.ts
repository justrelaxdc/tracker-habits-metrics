import type { TFile, TFolder } from "obsidian";
import type { TrackerSettings } from "../../domain/types";

/**
 * Manages custom sort order for trackers and folders
 */
export class SortOrderManager {
  constructor(
    private settings: TrackerSettings,
    private readonly saveSettingsCallback: () => Promise<void>
  ) {}

  /**
   * Update settings reference (called when settings change)
   */
  updateSettings(settings: TrackerSettings): void {
    this.settings = settings;
  }

  /**
   * Gets normalized full path from vault root
   */
  getRelativePath(fullPath: string, normalizePath: (p: string) => string): string {
    return normalizePath(fullPath);
  }

  /**
   * Gets current sort order for a folder from settings or creates alphabetical order
   */
  getSortOrderForFolder<T extends TFile | TFolder>(
    items: T[],
    folderPath: string,
    normalizePath: (p: string) => string
  ): string[] {
    const relativePath = this.getRelativePath(folderPath, normalizePath);
    const sortOrder = this.settings.customSortOrder?.[relativePath];
    
    if (sortOrder && sortOrder.length > 0) {
      return sortOrder;
    }
    
    return items
      .map(item => 'basename' in item ? (item as TFile).basename : (item as TFolder).name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  /**
   * Saves sort order for a folder to settings
   */
  async saveSortOrderForFolder(
    folderPath: string,
    order: string[],
    normalizePath: (p: string) => string
  ): Promise<void> {
    const relativePath = this.getRelativePath(folderPath, normalizePath);
    
    const updatedCustomSortOrder = this.settings.customSortOrder 
      ? { ...this.settings.customSortOrder }
      : {};
    
    updatedCustomSortOrder[relativePath] = order;
    this.settings.customSortOrder = updatedCustomSortOrder;
    await this.saveSettingsCallback();
  }

  /**
   * Sorts items using custom sort order if available, otherwise alphabetically
   */
  sortItemsByOrder<T extends TFile | TFolder>(
    items: T[],
    folderPath: string,
    normalizePath: (p: string) => string
  ): T[] {
    const order = this.getSortOrderForFolder(items, folderPath, normalizePath);
    
    const itemMap = new Map<string, T>();
    for (const item of items) {
      const itemName = 'basename' in item ? (item as TFile).basename : (item as TFolder).name;
      itemMap.set(itemName, item);
    }
    
    const sorted: T[] = [];
    const added = new Set<string>();
    
    for (const orderedName of order) {
      const item = itemMap.get(orderedName);
      if (item) {
        sorted.push(item);
        added.add(orderedName);
      }
    }
    
    const remaining: T[] = [];
    for (const item of items) {
      const itemName = 'basename' in item ? (item as TFile).basename : (item as TFolder).name;
      if (!added.has(itemName)) {
        remaining.push(item);
      }
    }
    remaining.sort((a, b) => {
      const aName = 'basename' in a ? (a as TFile).basename : (a as TFolder).name;
      const bName = 'basename' in b ? (b as TFile).basename : (b as TFolder).name;
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
    
    return [...sorted, ...remaining];
  }

  /**
   * Updates customSortOrder when a file or folder is renamed
   */
  async updateCustomSortOrderOnRename(
    oldPath: string,
    newPath: string,
    isFolder: boolean,
    getFolderPathFromFile: (path: string) => string,
    normalizePath: (p: string) => string
  ): Promise<void> {
    if (!this.settings.customSortOrder) {
      return;
    }

    const updated = { ...this.settings.customSortOrder };
    let hasChanges = false;

    if (isFolder) {
      if (updated[oldPath]) {
        updated[newPath] = updated[oldPath];
        delete updated[oldPath];
        hasChanges = true;
      }

      const oldPathPrefix = `${oldPath}/`;
      const newPathPrefix = `${newPath}/`;
      const keysToUpdate: string[] = [];

      for (const key of Object.keys(updated)) {
        if (key.startsWith(oldPathPrefix)) {
          keysToUpdate.push(key);
        }
      }

      for (const key of keysToUpdate) {
        const newKey = key.replace(oldPathPrefix, newPathPrefix);
        updated[newKey] = updated[key];
        delete updated[key];
        hasChanges = true;
      }

      const oldFolderName = oldPath.split('/').pop() || oldPath;
      const newFolderName = newPath.split('/').pop() || newPath;

      for (const key of Object.keys(updated)) {
        const order = updated[key];
        if (Array.isArray(order)) {
          let orderChanged = false;
          const updatedOrder = order.map(item => {
            if (item === oldFolderName) {
              orderChanged = true;
              return newFolderName;
            }
            return item;
          });
          if (orderChanged) {
            updated[key] = updatedOrder;
            hasChanges = true;
          }
        }
      }
    } else {
      const oldFullFileName = oldPath.split('/').pop() || oldPath;
      const newFullFileName = newPath.split('/').pop() || newPath;
      const oldFileName = oldFullFileName.replace(/\.md$/, '');
      const newFileName = newFullFileName.replace(/\.md$/, '');
      const oldFolderPath = getFolderPathFromFile(oldPath);
      const newFolderPath = getFolderPathFromFile(newPath);
      const normalizedOldFolderPath = normalizePath(oldFolderPath);
      const normalizedNewFolderPath = normalizePath(newFolderPath);

      const foldersToCheck = new Set<string>();
      if (normalizedOldFolderPath) {
        foldersToCheck.add(normalizedOldFolderPath);
      }
      if (normalizedNewFolderPath && normalizedNewFolderPath !== normalizedOldFolderPath) {
        foldersToCheck.add(normalizedNewFolderPath);
      }

      for (const folderPath of foldersToCheck) {
        if (updated[folderPath] && Array.isArray(updated[folderPath])) {
          const order = updated[folderPath];
          let orderChanged = false;
          const updatedOrder = order.map(item => {
            if (item === oldFileName) {
              orderChanged = true;
              return newFileName;
            }
            return item;
          });
          if (orderChanged) {
            updated[folderPath] = updatedOrder;
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      this.settings.customSortOrder = updated;
      await this.saveSettingsCallback();
    }
  }

  /**
   * Handles file deletion - removes tracker from customSortOrder
   */
  async handleFileDeleteSortOrder(
    filePath: string,
    getFolderPathFromFile: (path: string) => string,
    normalizePath: (p: string) => string
  ): Promise<void> {
    const folderPath = getFolderPathFromFile(filePath);
    if (!folderPath) return;

    const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') || '';
    if (!fileName) return;

    const normalizedFolderPath = normalizePath(folderPath);
    const relativePath = this.getRelativePath(normalizedFolderPath, normalizePath);
    
    if (!this.settings.customSortOrder?.[relativePath]) {
      return;
    }

    const currentSortOrder = this.settings.customSortOrder[relativePath];
    const updatedSortOrder = currentSortOrder.filter(name => name !== fileName);
    
    await this.saveSortOrderForFolder(normalizedFolderPath, updatedSortOrder, normalizePath);
  }

  /**
   * Handles folder deletion - removes folder and all nested sort order configs
   */
  async handleFolderDeleteSortOrder(
    folderPath: string,
    normalizePath: (p: string) => string
  ): Promise<void> {
    if (!this.settings.customSortOrder) {
      return;
    }

    const normalizedFolderPath = normalizePath(folderPath);
    const relativePath = this.getRelativePath(normalizedFolderPath, normalizePath);
    
    const updated = { ...this.settings.customSortOrder };
    let hasChanges = false;
    
    const folderPathPrefix = `${relativePath}/`;
    const keysToDelete: string[] = [];
    
    for (const key of Object.keys(updated)) {
      if (key === relativePath || key.startsWith(folderPathPrefix)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      delete updated[key];
      hasChanges = true;
    }
    
    if (hasChanges) {
      this.settings.customSortOrder = updated;
      await this.saveSettingsCallback();
    }
  }
}

