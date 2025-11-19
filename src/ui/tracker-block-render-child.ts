import {
  MarkdownRenderChild,
  MarkdownPostProcessorContext,
  TFile,
} from "obsidian";
import type TrackerPlugin from "../core/tracker-plugin";
import type { FolderNode } from "../domain/types";
import { parseOptions } from "../utils/options";
import { resolveDateIso, formatDate, parseDate, addDays } from "../utils/date";

export class TrackerBlockRenderChild extends MarkdownRenderChild {
  private readonly plugin: TrackerPlugin;
  private readonly source: string;
  private readonly folderPath: string;
  private readonly opts: Record<string, string>;
  private readonly ctx: MarkdownPostProcessorContext;

  constructor(
    plugin: TrackerPlugin,
    source: string,
    containerEl: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);
    this.plugin = plugin;
    this.source = source;
    this.opts = parseOptions(source);
    this.folderPath = this.opts.folder || plugin.settings.trackersFolder;
    this.ctx = ctx;
  }

  async render() {
    this.containerEl.empty();

    try {
      const folderTree = this.plugin.getFolderTree(this.folderPath);
      if (!folderTree || (folderTree.files.length === 0 && folderTree.children.length === 0)) {
        this.containerEl.createEl("div", {
          text: `tracker: в папке ${this.folderPath} не найдено трекеров`,
          cls: "tracker-notes__error",
        });
        return;
      }

      const view = (this.opts.view ?? "control").toLowerCase();

      let initialDate: string | undefined = this.opts.date;
      if (!initialDate && this.ctx.sourcePath) {
        try {
          const noteFile = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
          if (noteFile instanceof TFile) {
            const fileName = noteFile.basename;
            if (fileName) {
              const m = (window as any).moment;
              if (m) {
                const dateFormats = [
                  "YYYY-MM-DD",
                  "YYYY/MM/DD",
                  "DD.MM.YYYY",
                  "YYYY-MM-DD HH:mm",
                  "YYYY/MM/DD HH:mm",
                ];
                for (const fmt of dateFormats) {
                  const parsedDate = m(fileName, fmt, true);
                  if (parsedDate.isValid()) {
                    initialDate = parsedDate.format(this.plugin.settings.dateFormat);
                    break;
                  }
                }
                if (!initialDate) {
                  const datePattern = /(\d{4}[-/]\d{2}[-/]\d{2})|(\d{2}\.\d{2}\.\d{4})/;
                  const match = fileName.match(datePattern);
                  if (match) {
                    const dateStr = match[0];
                    const parsedDate = m(dateStr, ["YYYY-MM-DD", "YYYY/MM/DD", "DD.MM.YYYY"], true);
                    if (parsedDate.isValid()) {
                      initialDate = parsedDate.format(this.plugin.settings.dateFormat);
                    }
                  }
                }
              } else {
                const datePatterns = [
                  /(\d{4})-(\d{2})-(\d{2})/,
                  /(\d{4})\/(\d{2})\/(\d{2})/,
                  /(\d{2})\.(\d{2})\.(\d{4})/,
                ];
                for (const pattern of datePatterns) {
                  const match = fileName.match(pattern);
                  if (match) {
                    let year: number;
                    let month: number;
                    let day: number;
                    if (pattern === datePatterns[2]) {
                      day = parseInt(match[1]);
                      month = parseInt(match[2]) - 1;
                      year = parseInt(match[3]);
                    } else {
                      year = parseInt(match[1]);
                      month = parseInt(match[2]) - 1;
                      day = parseInt(match[3]);
                    }
                    const date = new Date(year, month, day);
                    if (!isNaN(date.getTime())) {
                      initialDate = formatDate(date, this.plugin.settings.dateFormat);
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Tracker: Error reading note filename", error);
        }
      }

      let dateIso = resolveDateIso(initialDate, this.plugin.settings.dateFormat);

      const mainContainer = this.containerEl.createDiv({ cls: "tracker-notes" });

      if (view === "control") {
        const blockHeader = this.containerEl.createDiv({ cls: "tracker-notes__header" });
        this.containerEl.insertBefore(blockHeader, mainContainer);

        const headerTitle = blockHeader.createDiv({ cls: "tracker-notes__header-title" });
        const folderName = this.folderPath.split("/").pop() || this.folderPath;
        headerTitle.createEl("span", { text: folderName, cls: "tracker-notes__header-label" });

        const datePickerContainer = blockHeader.createDiv({
          cls: "tracker-notes__date-picker-container",
        });
        const datePicker = datePickerContainer.createDiv({ cls: "tracker-notes__date-picker" });

        const updateDate = async (newDate: string) => {
          const newDateIso = resolveDateIso(newDate, this.plugin.settings.dateFormat);
          dateInput.value = newDateIso;
          dateIso = newDateIso;

          const trackerItems = mainContainer.querySelectorAll(".tracker-notes__tracker");
          for (const trackerItem of Array.from(trackerItems)) {
            const filePath = (trackerItem as HTMLElement).dataset.filePath;
            if (filePath) {
              const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
              if (file instanceof TFile) {
                await this.plugin.updateTrackerDate(trackerItem as HTMLElement, file, newDateIso, this.opts);
              }
            }
          }
        };

        const navigateDate = async (days: number) => {
          const m = (window as any).moment;
          const currentDateObj = m
            ? m(dateIso, this.plugin.settings.dateFormat)
            : parseDate(dateIso, this.plugin.settings.dateFormat);
          const newDate = m
            ? currentDateObj.clone().add(days, "days")
            : addDays(new Date(currentDateObj.getTime()), days);
          const newDateStr = m
            ? newDate.format(this.plugin.settings.dateFormat)
            : formatDate(newDate, this.plugin.settings.dateFormat);
          await updateDate(newDateStr);
        };

        const dayBackBtn = datePicker.createEl("button", {
          text: "◀",
          cls: "tracker-notes__date-nav-btn tracker-notes__date-nav-btn-left",
        });
        dayBackBtn.onclick = () => navigateDate(-1);
        dayBackBtn.title = "Вчера";

        const dateInput = datePicker.createEl("input", {
          type: "date",
          cls: "tracker-notes__date-input",
          value: dateIso,
        }) as HTMLInputElement;
        dateInput.onchange = () => updateDate(dateInput.value);

        const dayForwardBtn = datePicker.createEl("button", {
          text: "▶",
          cls: "tracker-notes__date-nav-btn tracker-notes__date-nav-btn-right",
        });
        dayForwardBtn.onclick = () => navigateDate(1);
        dayForwardBtn.title = "Завтра";
      }

      const trackersContainer = mainContainer.createDiv({ cls: "tracker-notes__hierarchy" });
      await this.renderFolderNode(folderTree, trackersContainer, dateIso, view, this.opts);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.containerEl.createEl("div", {
        text: `tracker: ошибка при обработке блока: ${errorMsg}`,
        cls: "tracker-notes__error",
      });
      console.error("Tracker: ошибка обработки блока", error);
    }
  }

  private async renderFolderNode(
    node: FolderNode,
    parentEl: HTMLElement,
    dateIso: string,
    view: string,
    opts: Record<string, string>,
  ): Promise<void> {
    const nodeContainer = parentEl.createDiv({
      cls: `tracker-notes__folder-node level-${node.level}`,
    });

    const shouldShowHeader =
      node.files.length > 0 || (node.level > 0 && node.children.length > 0);

    if (shouldShowHeader) {
      const folderHeader = nodeContainer.createDiv({
        cls: `tracker-notes__folder-header level-${node.level}`,
      });
      folderHeader.setText(node.name);
    }

    if (node.files.length > 0) {
      const trackersContainer = nodeContainer.createDiv({ cls: "tracker-notes__trackers" });

      for (const file of node.files) {
        await this.plugin.renderTracker(trackersContainer, file, dateIso, view, opts);
      }
    }

    for (const childNode of node.children) {
      await this.renderFolderNode(childNode, nodeContainer, dateIso, view, opts);
    }
  }

  getFolderPath(): string {
    return this.folderPath;
  }

  onload() {}

  onunload() {
    this.plugin.removeActiveBlock(this);
  }
}

