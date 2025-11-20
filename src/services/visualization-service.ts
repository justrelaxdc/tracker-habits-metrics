import type { TFile } from "obsidian";
import type { TrackerSettings } from "../domain/types";
import { CSS_CLASSES, TrackerType, UI_CONSTANTS, STATS_LABELS } from "../constants";
import { DateService } from "./date-service";
import { countWords } from "../utils/misc";

/**
 * Service for rendering visualizations (heatmaps, stats)
 */
export class VisualizationService {
  /**
   * Calculates statistics for a tracker
   */
  calculateStats(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    dateIso: string,
    daysToShow: number,
    trackerType: string
  ): {
    total: number;
    sum: number;
    avg: number;
    periodDays: number[];
  } {
    const endDate = DateService.parse(dateIso, settings.dateFormat);
    const startDate = endDate.clone().subtract(daysToShow - 1, 'days');
    
    const periodDays: number[] = [];
    const metricType = trackerType.toLowerCase();
    
    for (let i = 0; i < daysToShow; i++) {
      const date = startDate.clone().add(i, 'days');
      const dateStr = DateService.format(date, settings.dateFormat);
      const val = entries.get(dateStr);
      let numVal = 0;
      
      if (val != null) {
        if (metricType === TrackerType.TEXT) {
          numVal = countWords(String(val));
        } else if (typeof val === "number") {
          numVal = val;
        } else if (val === "1" || String(val) === "true") {
          numVal = 1;
        } else {
          numVal = Number(val) || 0;
        }
      }
      
      // For bad habits, invert: absence = success
      if (metricType === TrackerType.BAD_HABIT) {
        numVal = numVal === 1 ? 0 : 1;
      }
      
      periodDays.push(numVal);
    }
    
    const sum = periodDays.reduce((a, b) => a + b, 0);
    const avg = sum / daysToShow;
    const total = entries.size;
    
    return { total, sum, avg, periodDays };
  }
  
  /**
   * Updates statistics DOM element
   */
  updateStatsDisplay(
    statsDiv: HTMLElement,
    stats: { total: number; sum: number; avg: number },
    currentStreak: number,
    daysToShow: number
  ): void {
    const children = Array.from(statsDiv.children);
    
    if (children.length >= 1) {
      children[0].textContent = `${STATS_LABELS.TOTAL_RECORDS}: ${stats.total}`;
    } else {
      statsDiv.createEl("div", { text: `${STATS_LABELS.TOTAL_RECORDS}: ${stats.total}` });
    }
    
    if (children.length >= 2) {
      children[1].textContent = `${STATS_LABELS.LAST_DAYS} ${daysToShow} ${STATS_LABELS.DAYS_PLURAL_5_PLUS}: ${stats.sum.toFixed(1)} (${STATS_LABELS.AVERAGE}: ${stats.avg.toFixed(1)})`;
    } else {
      statsDiv.createEl("div", { text: `${STATS_LABELS.LAST_DAYS} ${daysToShow} ${STATS_LABELS.DAYS_PLURAL_5_PLUS}: ${stats.sum.toFixed(1)} (${STATS_LABELS.AVERAGE}: ${stats.avg.toFixed(1)})` });
    }
    
    // Update or create streak
    if (currentStreak > 0) {
      const daysLabel = currentStreak === 1 ? STATS_LABELS.DAYS_SINGULAR : currentStreak < 5 ? STATS_LABELS.DAYS_PLURAL_2_4 : STATS_LABELS.DAYS_PLURAL_5_PLUS;
      const streakText = `🔥 ${STATS_LABELS.CURRENT_STREAK}: ${currentStreak} ${daysLabel}`;
      if (children.length >= 3) {
        const streakEl = children[2] as HTMLElement;
        streakEl.textContent = streakText;
        streakEl.style.color = "var(--interactive-accent)";
        streakEl.style.fontWeight = UI_CONSTANTS.FONT_WEIGHT_BOLD;
      } else {
        const streakEl = statsDiv.createEl("div", { text: streakText });
        streakEl.style.color = "var(--interactive-accent)";
        streakEl.style.fontWeight = UI_CONSTANTS.FONT_WEIGHT_BOLD;
      }
    } else if (children.length >= 3) {
      // Remove streak if it's 0
      children[2].remove();
    }
  }
  
  /**
   * Updates heatmap day visual state
   */
  updateHeatmapDayState(
    dayDiv: HTMLElement,
    dateStr: string,
    entries: Map<string, string | number>,
    startTrackingDateStr: string | null,
    trackerType: string
  ): void {
    const value = entries.get(dateStr);
    const hasValue = value === 1 || value === "1" || String(value) === "true";
    
    // Update has-value class
    if (hasValue) {
      dayDiv.addClass(CSS_CLASSES.HEATMAP_DAY_HAS_VALUE);
    } else {
      dayDiv.removeClass(CSS_CLASSES.HEATMAP_DAY_HAS_VALUE);
    }
    
    // Update tracker type class
    dayDiv.removeClass(TrackerType.GOOD_HABIT);
    dayDiv.removeClass(TrackerType.BAD_HABIT);
    dayDiv.addClass(trackerType);
    
    // Update start-day class
    if (dateStr === startTrackingDateStr) {
      dayDiv.addClass(CSS_CLASSES.HEATMAP_DAY_START);
    } else {
      dayDiv.removeClass(CSS_CLASSES.HEATMAP_DAY_START);
    }
  }
}

