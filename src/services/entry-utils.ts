import type { TFile } from "obsidian";
import type { TrackerSettings } from "../domain/types";
import { DateService } from "./date-service";

/**
 * Common date formats to try when parsing dates
 */
export const DATE_FORMATS = [
  'YYYY-MM-DD',
  'DD.MM.YYYY',
  'MM/DD/YYYY',
  'YYYY/MM/DD'
];

/**
 * Gets entry value by date, trying multiple date formats
 * @param entries Map of date strings to values
 * @param date Date to look up (DateWrapper or Date)
 * @param settings Tracker settings containing dateFormat
 * @returns The value if found, undefined otherwise
 */
export function getEntryValueByDate(
  entries: Map<string, string | number>,
  date: any,
  settings: TrackerSettings
): string | number | undefined {
  // Try settings format first, then common formats
  const formats = [
    settings.dateFormat,
    ...DATE_FORMATS
  ];
  
  // Remove duplicates
  const uniqueFormats = [...new Set(formats)];
  
  for (const format of uniqueFormats) {
    const dateStr = DateService.format(date, format);
    const val = entries.get(dateStr);
    if (val !== undefined) {
      return val;
    }
  }
  
  return undefined;
}

/**
 * Determines the start tracking date with priorities:
 * 1. trackingStartDate from frontmatter
 * 2. File creation date
 * 3. First date from entries
 * 4. Fallback: 365 days ago from current date
 * 
 * @param startTrackingDateStr Optional tracking start date string from frontmatter
 * @param file Optional file to get creation date from
 * @param entries Map of entries to find first date
 * @param settings Tracker settings containing dateFormat
 * @param currentDate Current date as reference
 * @returns DateWrapper representing the start tracking date
 */
export function determineStartTrackingDate(
  startTrackingDateStr: string | null | undefined,
  file: TFile | undefined,
  entries: Map<string, string | number>,
  settings: TrackerSettings,
  currentDate: any
): any {
  let startTrackingDate = null;
  
  const parseFormats = ['YYYY-MM-DD', settings.dateFormat, ...DATE_FORMATS];
  const uniqueParseFormats = [...new Set(parseFormats)];
  
  // Priority 1: Date from frontmatter (trackingStartDate)
  if (startTrackingDateStr) {
    startTrackingDate = DateService.parseMultiple(startTrackingDateStr, uniqueParseFormats);
    if (startTrackingDate.isValid()) {
      startTrackingDate = DateService.startOfDay(startTrackingDate);
    } else {
      startTrackingDate = null;
    }
  }
  
  // Priority 2: File creation date
  if (!startTrackingDate && file?.stat?.ctime) {
    startTrackingDate = DateService.startOfDay(DateService.fromDate(new Date(file.stat.ctime)));
  }

  // Priority 3: First date from entries
  if (entries.size > 0) {
    const sortedDates = Array.from(entries.keys()).sort();
    const firstDateStr = sortedDates[0];
    const firstDate = DateService.parseMultiple(firstDateStr, [
      settings.dateFormat,
      ...DATE_FORMATS
    ]);
    if (firstDate.isValid()) {
      const firstDateNormalized = DateService.startOfDay(firstDate);
      if (!startTrackingDate || DateService.isBefore(firstDateNormalized, startTrackingDate)) {
        startTrackingDate = firstDateNormalized;
      }
    }
  }

  // Fallback: 365 days ago
  if (!startTrackingDate) {
    startTrackingDate = DateService.startOfDay(DateService.subtractDays(currentDate, 365));
  }

  return startTrackingDate;
}

