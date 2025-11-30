import { App, TFile, TFolder } from "obsidian";
import type { FolderNode, TrackerSettings } from "../domain/types";
import { normalizePath } from "../utils/path";

export class FolderTreeService {
  private readonly cache = new Map<string, FolderNode | null>();
  private customSortOrder: Record<string, string[]> | undefined = undefined;

  constructor(private readonly app: App) {}

  /**
   * Updates settings for sorting
   */
  updateSettings(settings: TrackerSettings): void {
    this.customSortOrder = settings.customSortOrder;
  }

  private cacheKey(folderPath: string, maxDepth: number): string {
    return `${normalizePath(folderPath)}::${maxDepth}`;
  }

  getFolderTree(folderPath: string, maxDepth: number = 3): FolderNode | null {
    const key = this.cacheKey(folderPath, maxDepth);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      return null;
    }

    if (folder instanceof TFile) {
      return {
        name: folder.basename,
        path: folder.path,
        level: 0,
        files: [folder],
        children: [],
      };
    }

    if (folder instanceof TFolder) {
      const tree = this.buildFolderTree(folder, maxDepth, 0);
      this.cache.set(key, tree);
      return tree;
    }

    return null;
  }

  /**
   * Gets normalized full path from vault root
   * Returns the full normalized path as-is, without relative calculations
   */
  private getRelativePath(fullPath: string): string {
    return normalizePath(fullPath);
  }

  /**
   * Sorts items using custom sort order if available, otherwise alphabetically
   */
  private sortItems<T extends TFile | TFolder>(
    items: T[],
    folderPath: string
  ): T[] {
    const relativePath = this.getRelativePath(folderPath);
    const sortOrder = this.customSortOrder?.[relativePath];
    
    if (!sortOrder || sortOrder.length === 0) {
      // No custom sort order - sort alphabetically
      return [...items].sort((a, b) => {
        const aName = a instanceof TFile ? a.basename : a.name;
        const bName = b instanceof TFile ? b.basename : b.name;
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });
    }
    
    // Create a map for quick lookup
    const itemMap = new Map<string, T>();
    const itemNames = new Set<string>();
    
    for (const item of items) {
      const itemName = item instanceof TFile ? item.basename : item.name;
      itemMap.set(itemName, item);
      itemNames.add(itemName);
    }
    
    // Build sorted array based on custom order
    const sorted: T[] = [];
    const added = new Set<string>();
    
    // Add items in custom order
    for (const orderedName of sortOrder) {
      const item = itemMap.get(orderedName);
      if (item) {
        sorted.push(item);
        added.add(orderedName);
      }
    }
    
    // Add remaining items (new ones not in sort order) at the end, sorted alphabetically
    const remaining: T[] = [];
    for (const item of items) {
      const itemName = item instanceof TFile ? item.basename : item.name;
      if (!added.has(itemName)) {
        remaining.push(item);
      }
    }
    remaining.sort((a, b) => {
      const aName = a instanceof TFile ? a.basename : a.name;
      const bName = b instanceof TFile ? b.basename : b.name;
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
    
    return [...sorted, ...remaining];
  }

  private buildFolderTree(folder: TFolder, maxDepth: number, currentLevel: number): FolderNode {
    const node: FolderNode = {
      name: folder.name,
      path: folder.path,
      level: currentLevel,
      files: [],
      children: [],
    };

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        node.files.push(child);
      }
    }

    // Sort files using custom sort order or alphabetically
    node.files = this.sortItems(node.files, folder.path);

    if (currentLevel < maxDepth) {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          // Ignore folders containing "archive" in name (case-insensitive)
          if (child.name.toLowerCase().includes("archive")) {
            continue;
          }
          const childNode = this.buildFolderTree(child, maxDepth, currentLevel + 1);
          if (childNode.files.length > 0 || childNode.children.length > 0) {
            node.children.push(childNode);
          }
        }
      }

      // Sort folders using custom sort order or alphabetically
      // For folders, we need to use the parent folder path (folder.path) as the key
      node.children = this.sortItems(node.children, folder.path);
    }

    return node;
  }

  invalidate(folderPath?: string) {
    if (!folderPath) {
      this.cache.clear();
      return;
    }
    const normalized = normalizePath(folderPath);
    for (const key of Array.from(this.cache.keys())) {
      const [cachedPath] = key.split("::");
      if (
        cachedPath === normalized ||
        cachedPath.startsWith(`${normalized}/`) ||
        normalized.startsWith(`${cachedPath}/`)
      ) {
        this.cache.delete(key);
      }
    }
  }
}

