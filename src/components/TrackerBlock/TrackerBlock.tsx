import { useCallback, useMemo, useEffect } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import { CSS_CLASSES, ViewMode, ERROR_MESSAGES } from "../../constants";
import { DateService } from "../../services/date-service";
import type { TrackerBlockProps } from "../types";
import { TrackerContext } from "../TrackerContext";
import { DatePicker } from "./DatePicker";
import { LoadingIndicator } from "./LoadingIndicator";
import { FolderNode } from "./FolderNode";
import { trackerStore } from "../../store";

/**
 * Main tracker block component - root of the Preact tree
 * Uses signals for reactive date management
 */
export function TrackerBlock({
  plugin,
  folderTree,
  initialDateIso,
  viewMode,
  opts,
  folderPath,
}: TrackerBlockProps) {
  // Use signals for reactive state
  const isUpdating = useSignal(false);
  
  // Initialize the store date on mount
  useEffect(() => {
    trackerStore.setDate(initialDateIso);
  }, [initialDateIso]);

  // Computed value that reads from the signal
  const dateIso = useComputed(() => trackerStore.currentDateIso.value);

  // Handle date change - updates the global signal
  const handleDateChange = useCallback((newDate: string) => {
    const newDateIso = DateService.resolveDateIso(newDate, plugin.settings.dateFormat);
    trackerStore.setDate(newDateIso);
  }, [plugin.settings.dateFormat]);

  // Handle date navigation
  const handleNavigate = useCallback((days: number) => {
    const currentDateIso = trackerStore.currentDateIso.value;
    const currentDateObj = DateService.parse(currentDateIso, plugin.settings.dateFormat);
    const newDate = currentDateObj.clone().add(days, "days");
    const newDateStr = DateService.format(newDate, plugin.settings.dateFormat);
    trackerStore.setDate(newDateStr);
  }, [plugin.settings.dateFormat]);

  // Context value for child components - uses .value to get current date
  const contextValue = useMemo(() => ({
    plugin,
    dateIso: dateIso.value,
    viewMode,
    opts,
    onDateChange: handleDateChange,
  }), [plugin, dateIso.value, viewMode, opts, handleDateChange]);

  // Render error state if no folder tree
  if (!folderTree || (folderTree.files.length === 0 && folderTree.children.length === 0)) {
    return (
      <div class={CSS_CLASSES.ERROR}>
        tracker: {ERROR_MESSAGES.NO_TRACKERS} {folderPath}
      </div>
    );
  }

  // Get folder name for header
  const folderName = folderPath.split("/").pop() || folderPath;

  return (
    <TrackerContext.Provider value={contextValue}>
      {viewMode === ViewMode.CONTROL && (
        <div class={CSS_CLASSES.TRACKER_NOTES_HEADER}>
          <div class="tracker-notes__header-title">
            <span class="tracker-notes__header-label">{folderName}</span>
          </div>
          <DatePicker
            dateIso={dateIso.value}
            onDateChange={handleDateChange}
            onNavigate={handleNavigate}
            isUpdating={isUpdating.value}
          />
          <LoadingIndicator isActive={isUpdating.value} />
        </div>
      )}

      <div class={CSS_CLASSES.TRACKER_NOTES}>
        <div class={CSS_CLASSES.TRACKER_NOTES_HIERARCHY}>
          <FolderNode
            node={folderTree}
            plugin={plugin}
            dateIso={dateIso.value}
            viewMode={viewMode}
            opts={opts}
          />
        </div>
      </div>
    </TrackerContext.Provider>
  );
}
