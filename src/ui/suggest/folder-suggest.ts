import type { App, TFolder } from "obsidian";
import { AbstractInputSuggest } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private readonly folders: TFolder[];

  constructor(app: App, inputEl: HTMLInputElement, folders: TFolder[]) {
    super(app, inputEl);
    this.folders = folders;
  }

  getSuggestions(query: string): TFolder[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return this.folders.slice(0, 100);
    }

    return this.folders
      .filter((folder) => {
        const path = folder.path || "";
        return path.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 100);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    const path = folder.path || "";
    el.textContent = path || "/ (корневая папка)";
  }

  selectSuggestion(folder: TFolder): void {
    const path = folder.path || "";
    this.setValue(path);
    this.close();
  }
}

