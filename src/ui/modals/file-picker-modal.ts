import { Modal, Notice } from "obsidian";
import type { App, TFile } from "obsidian";
import { MODAL_LABELS } from "../../constants";

export class FilePickerModal extends Modal {
  private readonly files: TFile[];
  private readonly onPick: (file: TFile | null) => void;

  constructor(app: App, files: TFile[], onPick: (file: TFile | null) => void) {
    super(app);
    this.files = files;
    this.onPick = onPick;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    if (this.files.length === 0) {
      new Notice(MODAL_LABELS.NO_TRACKERS_FOUND);
      this.close();
      return;
    }

    contentEl.createEl("h3", { text: MODAL_LABELS.SELECT_TRACKER });
    this.files.slice(0, 200).forEach((file) => {
      const btn = contentEl.createEl("button", { text: file.path });
      btn.onclick = () => {
        this.close();
        this.onPick(file);
      };
    });
  }

  onClose() {
    this.onPick(null);
    this.contentEl.empty();
  }
}

