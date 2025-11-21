import { TFile } from "obsidian";
import type { TrackerSettings, TrackerFileOptions } from "../domain/types";
import { CSS_CLASSES, TrackerType, ViewMode, MODAL_LABELS } from "../constants";
import type { ControlsRenderer } from "./controls-renderer";
import type { HeatmapService } from "./heatmap-service";
import { removePrefix } from "../utils/filename-parser";

/**
 * Service for rendering tracker items
 */
export class TrackerRenderer {
  constructor(
    private readonly settings: TrackerSettings,
    private readonly getFileTypeFromFrontmatter: (file: TFile) => Promise<TrackerFileOptions>,
    private readonly readValueForDate: (file: TFile, dateIso: string) => Promise<string | number | null>,
    private readonly controlsRenderer: ControlsRenderer,
    private readonly renderChart?: (container: HTMLElement, file: TFile, dateIso?: string, daysToShow?: number, entries?: Map<string, string | number>) => Promise<void>,
    private readonly renderStats?: (container: HTMLElement, file: TFile, dateIso?: string, daysToShow?: number, trackerType?: string, entries?: Map<string, string | number>) => Promise<void>,
    private readonly isMobileDevice?: () => boolean,
    private readonly onEditTracker?: (file: TFile) => void,
    private readonly onMoveTrackerUp?: (file: TFile) => Promise<void>,
    private readonly onMoveTrackerDown?: (file: TFile) => Promise<void>,
    private readonly getIconForPath?: (path: string, isFile: boolean) => string | null,
    private readonly renderIcon?: (icon: string | null, container: HTMLElement) => void
  ) {}

  /**
   * Renders a tracker item
   */
  async renderTracker(
    parentEl: HTMLElement,
    file: TFile,
    dateIso: string,
    view: string,
    opts: Record<string, string>,
    existingTracker?: HTMLElement,
  ): Promise<void> {
    // Create trackerItem outside DOM if it's a new tracker
    let trackerItem: HTMLElement;
    let isNewTracker = false;
    
    if (existingTracker) {
      trackerItem = existingTracker;
      // Remove only content, preserving dataset
      const header = trackerItem.querySelector(`.${CSS_CLASSES.TRACKER_HEADER}`);
      const controls = trackerItem.querySelector(`.${CSS_CLASSES.TRACKER_CONTROLS}`);
      const chart = trackerItem.querySelector(`.${CSS_CLASSES.CHART}`);
      const stats = trackerItem.querySelector(`.${CSS_CLASSES.STATS}`);
      
      header?.remove();
      controls?.remove();
      chart?.remove();
      stats?.remove();
    } else {
      // Create outside DOM
      trackerItem = document.createElement('div');
      isNewTracker = true;
    }
    
    trackerItem.classList.add(CSS_CLASSES.TRACKER);
    trackerItem.dataset.filePath = file.path;
    
    // Header with tracker name
    const header = trackerItem.createDiv({ cls: CSS_CLASSES.TRACKER_HEADER });
    // Get unit for display in name
    const fileOpts = await this.getFileTypeFromFrontmatter(file);
    const baseName = removePrefix(file.basename);
    const unit = fileOpts.unit || "";
    const displayName = unit ? `${baseName} (${unit})` : baseName;
    
    // Title container with icon
    const titleContainer = header.createDiv({ cls: CSS_CLASSES.TRACKER_TITLE });
    // file.path is a file path, so isFile = true
    const trackerIcon = this.getIconForPath?.(file.path, true);
    if (trackerIcon && this.renderIcon) {
      this.renderIcon(trackerIcon, titleContainer);
    }
    const titleLink = titleContainer.createEl("a", { 
      text: displayName, 
      cls: "internal-link",
      href: file.path
    });
    titleLink.setAttribute("data-href", file.path);
    
    // Sort buttons (left of settings button)
    if (this.onMoveTrackerUp || this.onMoveTrackerDown) {
      const orderBtnsContainer = header.createDiv({ cls: CSS_CLASSES.ORDER_BTN_CONTAINER });
      
      if (this.onMoveTrackerUp) {
        const upButton = orderBtnsContainer.createEl("button", {
          text: "↑",
          cls: CSS_CLASSES.ORDER_BTN_UP
        });
        upButton.title = MODAL_LABELS.MOVE_UP;
        upButton.onclick = async (e) => {
          e.stopPropagation();
          await this.onMoveTrackerUp!(file);
        };
      }
      
      if (this.onMoveTrackerDown) {
        const downButton = orderBtnsContainer.createEl("button", {
          text: "↓",
          cls: CSS_CLASSES.ORDER_BTN_DOWN
        });
        downButton.title = MODAL_LABELS.MOVE_DOWN;
        downButton.onclick = async (e) => {
          e.stopPropagation();
          await this.onMoveTrackerDown!(file);
        };
      }
    }
    
    // Settings button for editing tracker parameters
    if (this.onEditTracker) {
      const settingsButton = header.createEl("button", {
        text: "⚙️",
        cls: CSS_CLASSES.SETTINGS_BTN
      });
      settingsButton.title = MODAL_LABELS.TRACKER_SETTINGS;
      settingsButton.onclick = () => {
        this.onEditTracker!(file);
      };
    }
    
    const controlsContainer = trackerItem.createDiv({ cls: CSS_CLASSES.TRACKER_CONTROLS });

    if (view === ViewMode.DISPLAY) {
      const value = await this.readValueForDate(file, dateIso);
      trackerItem.createEl("div", { text: `${dateIso}: ${value ?? "—"}` });
      
      // Show additional visualizations if requested
      const daysToShow = parseInt(opts.days) || this.settings.daysToShow;
      const trackerType = (fileOpts.mode ?? TrackerType.GOOD_HABIT).toLowerCase();
      
      // Use default settings if parameters are not set directly
      const shouldShowChart = (opts.showChart === "true" || (opts.showChart === undefined && this.settings.showChartByDefault)) && 
                               !(this.isMobileDevice?.() && this.settings.hideChartOnMobile);
      const shouldShowStats = (opts.showStats === "true" || (opts.showStats === undefined && this.settings.showStatsByDefault)) && 
                              !(this.isMobileDevice?.() && this.settings.hideStatsOnMobile);
      
      if (shouldShowChart && this.renderChart) {
        await this.renderChart(trackerItem, file, dateIso, daysToShow);
      }
      if (shouldShowStats && this.renderStats) {
        await this.renderStats(trackerItem, file, dateIso, daysToShow, trackerType);
      }
      return;
    }

    // control view - render controls
    // Always determine type from frontmatter (ignore mode from opts)
    // Remove mode from opts to use only from fileOpts
    const { mode, ...optsWithoutMode } = opts;
    const mergedOpts = { ...optsWithoutMode, ...fileOpts };
    
    await this.controlsRenderer.renderControlsForDate(controlsContainer, file, dateIso, mergedOpts);

    // Show additional visualizations if requested
    const daysToShow = parseInt(opts.days) || this.settings.daysToShow;
    const trackerType = (fileOpts.mode ?? TrackerType.GOOD_HABIT).toLowerCase();
    
    // Use default settings if parameters are not set directly
    const shouldShowChart = (opts.showChart === "true" || (opts.showChart === undefined && this.settings.showChartByDefault)) && 
                             !(this.isMobileDevice?.() && this.settings.hideChartOnMobile);
    const shouldShowStats = (opts.showStats === "true" || (opts.showStats === undefined && this.settings.showStatsByDefault)) && 
                            !(this.isMobileDevice?.() && this.settings.hideStatsOnMobile);
    
    if (shouldShowChart && this.renderChart) {
      await this.renderChart(trackerItem, file, dateIso, daysToShow);
    }
    if (shouldShowStats && this.renderStats) {
      await this.renderStats(trackerItem, file, dateIso, daysToShow, trackerType);
    }
    
    // Add to DOM only if it's a new tracker (one operation)
    if (isNewTracker) {
      parentEl.appendChild(trackerItem);
    }
  }
}

