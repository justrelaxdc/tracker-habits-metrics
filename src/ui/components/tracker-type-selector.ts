import { TrackerType, TRACKER_TYPE_LABELS, MODAL_LABELS } from "../../constants";
import type { TrackerTypeValue } from "../../constants";

/**
 * Creates a tracker type dropdown with grouped options
 * 
 * @param selectElement - The select element to populate
 * @param defaultValue - Default selected value
 */
export function populateTrackerTypeSelector(
  selectElement: HTMLSelectElement,
  defaultValue: TrackerTypeValue = TrackerType.GOOD_HABIT
): void {
  // Clear existing options safely
  while (selectElement.firstChild) {
    selectElement.removeChild(selectElement.firstChild);
  }
  
  // Create Habits group
  const habitsGroup = selectElement.createEl("optgroup", {
    attr: { label: MODAL_LABELS.HABITS_GROUP },
  });
  
  habitsGroup.createEl("option", {
    value: TrackerType.GOOD_HABIT,
    text: TRACKER_TYPE_LABELS[TrackerType.GOOD_HABIT],
  });
  
  habitsGroup.createEl("option", {
    value: TrackerType.BAD_HABIT,
    text: TRACKER_TYPE_LABELS[TrackerType.BAD_HABIT],
  });
  
  // Create Metrics group
  const metricsGroup = selectElement.createEl("optgroup", {
    attr: { label: MODAL_LABELS.METRICS_GROUP },
  });
  
  metricsGroup.createEl("option", {
    value: TrackerType.NUMBER,
    text: TRACKER_TYPE_LABELS[TrackerType.NUMBER],
  });
  
  metricsGroup.createEl("option", {
    value: TrackerType.SCALE,
    text: TRACKER_TYPE_LABELS[TrackerType.SCALE],
  });
  
  metricsGroup.createEl("option", {
    value: TrackerType.PLUSMINUS,
    text: TRACKER_TYPE_LABELS[TrackerType.PLUSMINUS],
  });
  
  metricsGroup.createEl("option", {
    value: TrackerType.TEXT,
    text: TRACKER_TYPE_LABELS[TrackerType.TEXT],
  });
  
  // Set default value
  selectElement.value = defaultValue;
}

/**
 * Checks if a tracker type is a metric (vs a habit)
 * 
 * @param type - Tracker type to check
 * @returns True if type is a metric
 */
export function isMetricType(type: string): boolean {
  return [
    TrackerType.NUMBER,
    TrackerType.PLUSMINUS,
    TrackerType.TEXT,
    TrackerType.SCALE,
  ].includes(type as TrackerTypeValue);
}

/**
 * Checks if a tracker type is a habit (good or bad)
 * 
 * @param type - Tracker type to check
 * @returns True if type is a habit
 */
export function isHabitType(type: string): boolean {
  return type === TrackerType.GOOD_HABIT || type === TrackerType.BAD_HABIT;
}

