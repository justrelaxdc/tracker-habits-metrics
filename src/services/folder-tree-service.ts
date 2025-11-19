import { App, TFile, TFolder } from "obsidian";
import type { FolderNode } from "../domain/types";

export class FolderTreeService {
  constructor(private readonly app: App) {}

  getFolderTree(folderPath: string, maxDepth: number = 3): FolderNode | null {
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
      return this.buildFolderTree(folder, maxDepth, 0);
    }

    return null;
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

    node.files.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { sensitivity: "base" }));

    if (currentLevel < maxDepth) {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          const childNode = this.buildFolderTree(child, maxDepth, currentLevel + 1);
          if (childNode.files.length > 0 || childNode.children.length > 0) {
            node.children.push(childNode);
          }
        }
      }

      node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }

    return node;
  }
}

