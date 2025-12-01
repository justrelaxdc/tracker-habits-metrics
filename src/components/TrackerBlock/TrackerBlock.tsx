import { useState, useCallback, useMemo } from "preact/hooks";
import { CSS_CLASSES, ViewMode, ERROR_MESSAGES } from "../../constants";
import { resolveDateIso } from "../../utils/date";
import { DateService } from "../../services/date-service";
import type { TrackerBlockProps } from "../types";
import { TrackerContext } from "../TrackerContext";
import { DatePicker } from "./DatePicker";
import { LoadingIndicator } from "./LoadingIndicator";
import { FolderNode } from "./FolderNode";

/**
 * Main tracker block component - root of the Preact tree
 */
export function TrackerBlock({
  plugin,
  folderTree,
  initialDateIso,
  viewMode,
  opts,
  folderPath,
}: TrackerBlockProps) {
  const [dateIso, setDateIso] = useState(initialDateIso);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  // Handle date change with debouncing
  const handleDateChange = useCallback(async (newDate: string) => {
    const newDateIso = resolveDateIso(newDate, plugin.settings.dateFormat);
    setDateIso(newDateIso);
    setPendingDate(newDateIso);
    
    setIsUpdating(true);
    try {
      // The date change will propagate through props
      // Components will re-render with new date
    } finally {
      setIsUpdating(false);
      setPendingDate(null);
    }
  }, [plugin.settings.dateFormat]);

  // Handle date navigation
  const handleNavigate = useCallback((days: number) => {
    const referenceIso = pendingDate ?? dateIso;
    const currentDateObj = DateService.parse(referenceIso, plugin.settings.dateFormat);
    const newDate = currentDateObj.clone().add(days, "days");
    const newDateStr = DateService.format(newDate, plugin.settings.dateFormat);
    handleDateChange(newDateStr);
  }, [pendingDate, dateIso, plugin.settings.dateFormat, handleDateChange]);

  // Context value for child components
  const contextValue = useMemo(() => ({
    plugin,
    dateIso,
    viewMode,
    opts,
    onDateChange: handleDateChange,
  }), [plugin, dateIso, viewMode, opts, handleDateChange]);

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
            dateIso={dateIso}
            onDateChange={handleDateChange}
            onNavigate={handleNavigate}
            isUpdating={isUpdating}
          />
          <LoadingIndicator isActive={isUpdating} />
        </div>
      )}

      <div class={CSS_CLASSES.TRACKER_NOTES}>
        <div class={CSS_CLASSES.TRACKER_NOTES_HIERARCHY}>
          <FolderNode
            node={folderTree}
            plugin={plugin}
            dateIso={dateIso}
            viewMode={viewMode}
            opts={opts}
          />
        </div>
      </div>
    </TrackerContext.Provider>
  );
}

