import { TrackerType } from "../constants";

/**
 * Parses a string value to number if possible
 * 
 * @param value - String value to parse
 * @returns Number if parseable, original string otherwise
 */
export function parseMaybeNumber(value: string): string | number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

/**
 * Counts words in a text string
 * 
 * @param text - Text to count words in
 * @returns Number of words
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Converts a tracker entry value to a numeric value
 * Unified function to avoid duplication across services
 * 
 * @param val - Raw value from tracker entries (can be null/undefined)
 * @param trackerType - Type of tracker (affects how text values are handled)
 * @returns Numeric value for calculations
 */
export function parseTrackerValueToNumber(
  val: string | number | null | undefined,
  trackerType?: string
): number {
  if (val == null) {
    return 0;
  }

  // For text trackers, count words
  if (trackerType?.toLowerCase() === TrackerType.TEXT) {
    return countWords(String(val));
  }

  // Already a number
  if (typeof val === "number") {
    return val;
  }

  // Boolean-like strings
  if (val === "1" || String(val).toLowerCase() === "true") {
    return 1;
  }

  if (val === "0" || String(val).toLowerCase() === "false") {
    return 0;
  }

  // Try to parse as number
  const numVal = Number(val);
  return isNaN(numVal) ? 0 : numVal;
}

/**
 * Converts tracker value to success/failure for habits
 * 
 * @param val - Raw value from tracker entries
 * @param isBadHabit - Whether this is a bad habit tracker
 * @returns 1 for success, 0 for failure
 */
export function parseHabitValueToSuccess(
  val: string | number | null | undefined,
  isBadHabit: boolean
): number {
  const numVal = parseTrackerValueToNumber(val);
  
  if (isBadHabit) {
    // Bad habit: success = no value or value is 0/false
    return (numVal === 0 || val == null) ? 1 : 0;
  } else {
    // Good habit: success = value exists and is truthy
    return (val != null && numVal > 0) ? 1 : 0;
  }
}
