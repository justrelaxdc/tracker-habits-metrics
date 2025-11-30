import type { TFile } from "obsidian";
import type { TrackerSettings, TrackerFileOptions } from "../domain/types";
import { CSS_CLASSES, TrackerType, UI_CONSTANTS, STATS_LABELS } from "../constants";
import { DateService } from "./date-service";
import { countWords } from "../utils/misc";

/**
 * Service for rendering visualizations (heatmaps, stats)
 */
export class VisualizationService {
  /**
   * Calculates statistics for habits (good-habit and bad-habit)
   */
  private calculateHabitStats(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    dateIso: string,
    daysToShow: number,
    trackerType: string,
    startTrackingDateStr?: string | null
  ): {
    total: number;
    sum: number;
    avg: number;
    periodDays: number[];
    min: number | null;
    max: number | null;
    median: number | null;
    completionRate: number | null;
    activeDays: number;
    actualDaysCount: number;
  } {
    const endDate = DateService.parse(dateIso, settings.dateFormat);
    const startDate = endDate.clone().subtract(daysToShow - 1, 'days');
    
    // Determine actual start date considering tracking start date
    let actualStartDate = startDate;
    if (startTrackingDateStr) {
      const trackingStartDate = DateService.parseMultiple(startTrackingDateStr, [
        settings.dateFormat,
        'YYYY-MM-DD',
        'YYYY/MM/DD',
        'DD.MM.YYYY'
      ]);
      if (trackingStartDate.isValid() && DateService.isAfter(trackingStartDate, startDate)) {
        actualStartDate = trackingStartDate;
      }
    }
    
    const periodDays: number[] = [];
    const metricType = trackerType.toLowerCase();
    const isBadHabit = metricType === TrackerType.BAD_HABIT;
    let actualDaysCount = 0;
    
    // Iterate through all days from actualStartDate to endDate
    let currentDate = actualStartDate.clone();
    while (!DateService.isAfter(currentDate, endDate)) {
      const dateStr = DateService.format(currentDate, settings.dateFormat);
      const val = entries.get(dateStr);
      let numVal = 0;
      
      if (val != null) {
        if (typeof val === "number") {
          numVal = val;
        } else if (val === "1" || String(val) === "true") {
          numVal = 1;
        } else {
          numVal = Number(val) || 0;
        }
      }
      
      // For bad habits: invert logic - absence or 0 = success (1), presence = failure (0)
      // For good habits: presence = success (1), absence = failure (0)
      if (isBadHabit) {
        // Bad habit: success = no value or value is 0/false
        numVal = (numVal === 0 || val == null) ? 1 : 0;
      } else {
        // Good habit: success = value exists and is truthy
        numVal = (val != null && numVal > 0) ? 1 : 0;
      }
      
      periodDays.push(numVal);
      actualDaysCount++;
      currentDate = currentDate.add(1, 'days');
    }
    
    const sum = periodDays.reduce((a, b) => a + b, 0);
    const avg = actualDaysCount > 0 ? sum / actualDaysCount : 0;
    const total = entries.size;
    
    // For habits: calculate completion rate and active days
    // activeDays = days with success (value = 1)
    const activeDays = periodDays.filter(v => v > 0).length;
    const completionRate = actualDaysCount > 0 ? (activeDays / actualDaysCount) * 100 : 0;
    
    return { 
      total, 
      sum, 
      avg, 
      periodDays, 
      min: null, 
      max: null, 
      median: null, 
      completionRate, 
      activeDays, 
      actualDaysCount 
    };
  }

  /**
   * Calculates statistics for metrics (number, plusminus, scale, text)
   */
  private calculateMetricStats(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    dateIso: string,
    daysToShow: number,
    trackerType: string,
    startTrackingDateStr?: string | null
  ): {
    total: number;
    sum: number;
    avg: number;
    periodDays: number[];
    min: number | null;
    max: number | null;
    median: number | null;
    completionRate: number | null;
    activeDays: number;
    actualDaysCount: number;
  } {
    const endDate = DateService.parse(dateIso, settings.dateFormat);
    const startDate = endDate.clone().subtract(daysToShow - 1, 'days');
    
    // Determine actual start date considering tracking start date
    let actualStartDate = startDate;
    if (startTrackingDateStr) {
      const trackingStartDate = DateService.parseMultiple(startTrackingDateStr, [
        settings.dateFormat,
        'YYYY-MM-DD',
        'YYYY/MM/DD',
        'DD.MM.YYYY'
      ]);
      if (trackingStartDate.isValid() && DateService.isAfter(trackingStartDate, startDate)) {
        actualStartDate = trackingStartDate;
      }
    }
    
    const periodDays: number[] = [];
    const metricType = trackerType.toLowerCase();
    let actualDaysCount = 0;
    
    // Iterate through all days from actualStartDate to endDate
    let currentDate = actualStartDate.clone();
    while (!DateService.isAfter(currentDate, endDate)) {
      const dateStr = DateService.format(currentDate, settings.dateFormat);
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
      
      periodDays.push(numVal);
      actualDaysCount++;
      currentDate = currentDate.add(1, 'days');
    }
    
    const sum = periodDays.reduce((a, b) => a + b, 0);
    const avg = actualDaysCount > 0 ? sum / actualDaysCount : 0;
    const total = entries.size;
    
    // For metrics: calculate min, max, median
    let min: number | null = null;
    let max: number | null = null;
    let median: number | null = null;
    const nonZeroValues = periodDays.filter(v => v > 0);
    
    if (periodDays.length > 0) {
      const sortedValues = [...periodDays].sort((a, b) => a - b);
      min = sortedValues[0];
      max = sortedValues[sortedValues.length - 1];
      
      // Calculate median for all values (including zeros)
      const mid = Math.floor(sortedValues.length / 2);
      if (sortedValues.length % 2 === 0) {
        median = (sortedValues[mid - 1] + sortedValues[mid]) / 2;
      } else {
        median = sortedValues[mid];
      }
    }
    
    const activeDays = nonZeroValues.length;
    
    return { 
      total, 
      sum, 
      avg, 
      periodDays, 
      min, 
      max, 
      median, 
      completionRate: null, 
      activeDays, 
      actualDaysCount 
    };
  }

  /**
   * Calculates statistics for a tracker
   */
  calculateStats(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    dateIso: string,
    daysToShow: number,
    trackerType: string,
    startTrackingDateStr?: string | null
  ): {
    total: number;
    sum: number;
    avg: number;
    periodDays: number[];
    min: number | null;
    max: number | null;
    median: number | null;
    completionRate: number | null;
    activeDays: number;
    actualDaysCount: number;
  } {
    const metricType = trackerType.toLowerCase();
    const isHabit = metricType === TrackerType.GOOD_HABIT || metricType === TrackerType.BAD_HABIT;
    
    // Use specialized functions based on tracker type
    if (isHabit) {
      return this.calculateHabitStats(entries, settings, dateIso, daysToShow, trackerType, startTrackingDateStr);
    } else {
      return this.calculateMetricStats(entries, settings, dateIso, daysToShow, trackerType, startTrackingDateStr);
    }
  }
  
  /**
   * Displays statistics for habits
   */
  private displayHabitStats(
    statsDiv: HTMLElement,
    stats: { 
      total: number; 
      sum: number; 
      avg: number; 
      completionRate: number | null; 
      activeDays: number;
      actualDaysCount: number;
    },
    currentStreak: number,
    bestStreak: number | undefined,
    trackerType: string,
    fileOpts?: TrackerFileOptions
  ): void {
    const metricType = trackerType.toLowerCase();
    const isBadHabit = metricType === TrackerType.BAD_HABIT;
    
    // Helper function to get completion rate color
    const getCompletionColor = (rate: number): string => {
      if (rate >= 80) return "var(--text-success, var(--text-normal))";
      if (rate >= 50) return "var(--text-warning, var(--text-normal))";
      return "var(--text-error, var(--text-normal))";
    };
    
    // General
    const generalSection = statsDiv.createDiv({ cls: "tracker-notes__stats-section" });
    generalSection.createEl("div", { 
      text: `📊 ${STATS_LABELS.TOTAL_RECORDS}: ${stats.total}`,
      cls: "tracker-notes__stats-item"
    });
    
    // Period
    const periodSection = statsDiv.createDiv({ cls: "tracker-notes__stats-section" });
    
    if (stats.completionRate !== null) {
      const completionEl = periodSection.createEl("div", { 
        cls: "tracker-notes__stats-item"
      });
      const rate = Math.round(stats.completionRate);
      
      // Different labels for good vs bad habits
      const completionLabel = isBadHabit 
        ? "Days without" 
        : STATS_LABELS.COMPLETION_RATE;
      
      completionEl.createSpan({ text: `✅ ${completionLabel}: ` });
      const rateSpan = completionEl.createSpan({ text: `${rate}%` });
      rateSpan.style.color = getCompletionColor(rate);
      rateSpan.style.fontWeight = "600";
      completionEl.createSpan({ text: ` (${stats.activeDays}/${stats.actualDaysCount})` });
    }
    
    const activeDaysLabel = isBadHabit 
      ? "Days without" 
      : STATS_LABELS.ACTIVE_DAYS;
    
    periodSection.createEl("div", { 
      text: `📅 ${activeDaysLabel}: ${stats.activeDays}/${stats.actualDaysCount}`,
      cls: "tracker-notes__stats-item"
    });
    
    // Records (streaks)
    if (currentStreak > 0 || bestStreak) {
      const recordsSection = statsDiv.createDiv({ cls: "tracker-notes__stats-section" });
      
      if (currentStreak > 0) {
        const daysLabel = currentStreak === 1 ? STATS_LABELS.DAYS_SINGULAR : currentStreak < 5 ? STATS_LABELS.DAYS_PLURAL_2_4 : STATS_LABELS.DAYS_PLURAL_5_PLUS;
        const streakEl = recordsSection.createEl("div", { 
          text: `🔥 ${STATS_LABELS.CURRENT_STREAK}: ${currentStreak} ${daysLabel}`,
          cls: "tracker-notes__stats-item tracker-notes__stats-streak"
        });
        streakEl.style.color = "var(--interactive-accent)";
        streakEl.style.fontWeight = UI_CONSTANTS.FONT_WEIGHT_BOLD;
      }
      
      if (bestStreak && bestStreak > currentStreak) {
        const bestDaysLabel = bestStreak === 1 ? STATS_LABELS.DAYS_SINGULAR : bestStreak < 5 ? STATS_LABELS.DAYS_PLURAL_2_4 : STATS_LABELS.DAYS_PLURAL_5_PLUS;
        recordsSection.createEl("div", { 
          text: `⭐ ${STATS_LABELS.BEST_STREAK}: ${bestStreak} ${bestDaysLabel}`,
          cls: "tracker-notes__stats-item"
        });
      }
    }
  }

  /**
   * Displays statistics for metrics
   */
  private displayMetricStats(
    statsDiv: HTMLElement,
    stats: { 
      total: number; 
      sum: number; 
      avg: number; 
      min: number | null; 
      max: number | null; 
      median: number | null; 
      activeDays: number;
      actualDaysCount: number;
    },
    fileOpts?: TrackerFileOptions
  ): void {
    const unit = fileOpts?.unit || "";
    const unitSuffix = unit ? ` ${unit}` : "";
    
    // Helper function to format value with unit
    const formatValue = (value: number, decimals: number = 1): string => {
      return `${value.toFixed(decimals)}${unitSuffix}`;
    };
    
    // General
    const generalSection = statsDiv.createDiv({ cls: "tracker-notes__stats-section" });
    generalSection.createEl("div", { 
      text: `📊 ${STATS_LABELS.TOTAL_RECORDS}: ${stats.total}`,
      cls: "tracker-notes__stats-item"
    });
    
    // Period
    const periodSection = statsDiv.createDiv({ cls: "tracker-notes__stats-section" });
    
    const daysLabel = stats.actualDaysCount === 1 ? STATS_LABELS.DAYS_SINGULAR : stats.actualDaysCount < 5 ? STATS_LABELS.DAYS_PLURAL_2_4 : STATS_LABELS.DAYS_PLURAL_5_PLUS;
    periodSection.createEl("div", { 
      text: `📈 ${STATS_LABELS.LAST_DAYS} ${stats.actualDaysCount} ${daysLabel}: ${formatValue(stats.sum)}`,
      cls: "tracker-notes__stats-item"
    });
    
    periodSection.createEl("div", { 
      text: `📊 ${STATS_LABELS.AVERAGE}: ${formatValue(stats.avg)}`,
      cls: "tracker-notes__stats-item"
    });
    
    if (stats.min !== null && stats.max !== null) {
      periodSection.createEl("div", { 
        text: `📉 ${STATS_LABELS.MIN}: ${formatValue(stats.min)} | ${STATS_LABELS.MAX}: ${formatValue(stats.max)}`,
        cls: "tracker-notes__stats-item"
      });
    }
    
    if (stats.median !== null) {
      periodSection.createEl("div", { 
        text: `📊 ${STATS_LABELS.MEDIAN}: ${formatValue(stats.median)}`,
        cls: "tracker-notes__stats-item"
      });
    }
    
    periodSection.createEl("div", { 
      text: `📅 ${STATS_LABELS.ACTIVE_DAYS}: ${stats.activeDays}/${stats.actualDaysCount}`,
      cls: "tracker-notes__stats-item"
    });
  }

  /**
   * Updates statistics DOM element
   */
  updateStatsDisplay(
    statsDiv: HTMLElement,
    stats: { 
      total: number; 
      sum: number; 
      avg: number; 
      min: number | null; 
      max: number | null; 
      median: number | null; 
      completionRate: number | null; 
      activeDays: number;
      actualDaysCount: number;
    },
    currentStreak: number,
    daysToShow: number,
    trackerType: string,
    fileOpts?: TrackerFileOptions,
    bestStreak?: number
  ): void {
    // Clear existing content
    statsDiv.empty();
    
    const metricType = trackerType.toLowerCase();
    const isHabit = metricType === TrackerType.GOOD_HABIT || metricType === TrackerType.BAD_HABIT;
    
    // Use specialized display functions
    if (isHabit) {
      this.displayHabitStats(statsDiv, stats, currentStreak, bestStreak, trackerType, fileOpts);
    } else {
      this.displayMetricStats(statsDiv, stats, fileOpts);
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

