import { useCallback, useRef, useEffect } from "preact/hooks";
import { CSS_CLASSES, MODAL_LABELS } from "../../constants";
import type { TrackerHeaderProps } from "../types";

/**
 * Tracker header with title, icon, and action buttons
 */
export function TrackerHeader({
  file,
  displayName,
  plugin,
  onEdit,
  onMoveUp,
  onMoveDown,
  limitProgress,
}: TrackerHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const iconContainerRef = useRef<HTMLSpanElement>(null);

  // Render tracker icon
  useEffect(() => {
    if (iconContainerRef.current) {
      const trackerIcon = plugin.getIconForPath(file.path, true);
      if (trackerIcon) {
        iconContainerRef.current.innerHTML = '';
        plugin.renderIcon(trackerIcon, iconContainerRef.current);
      }
    }
  }, [plugin, file.path]);

  // Apply limit progress styles
  useEffect(() => {
    if (headerRef.current) {
      if (limitProgress) {
        headerRef.current.style.setProperty('--limit-progress-width', limitProgress.width);
        headerRef.current.style.setProperty('--limit-progress-color', limitProgress.color);
      } else {
        headerRef.current.style.setProperty('--limit-progress-width', '0%');
        headerRef.current.style.setProperty('--limit-progress-color', 'transparent');
      }
    }
  }, [limitProgress]);

  const handleTitleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Open file using Obsidian API
    plugin.app.workspace.openLinkText(file.path, "", false);
  }, [plugin, file.path]);

  return (
    <div ref={headerRef} class={CSS_CLASSES.TRACKER_HEADER}>
      <div class={CSS_CLASSES.TRACKER_TITLE}>
        <span ref={iconContainerRef} class="tracker-notes__tracker-icon" />
        <a
          class="internal-link"
          href={file.path}
          data-href={file.path}
          onClick={handleTitleClick}
        >
          {displayName}
        </a>
      </div>

      {(onMoveUp || onMoveDown) && (
        <div class={CSS_CLASSES.ORDER_BTN_CONTAINER}>
          {onMoveUp && (
            <button
              type="button"
              class={CSS_CLASSES.ORDER_BTN_UP}
              onClick={onMoveUp}
              title={MODAL_LABELS.MOVE_UP}
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              class={CSS_CLASSES.ORDER_BTN_DOWN}
              onClick={onMoveDown}
              title={MODAL_LABELS.MOVE_DOWN}
            >
              ↓
            </button>
          )}
        </div>
      )}

      {onEdit && (
        <button
          type="button"
          class={CSS_CLASSES.SETTINGS_BTN}
          onClick={onEdit}
          title={MODAL_LABELS.TRACKER_SETTINGS}
        >
          ⚙️
        </button>
      )}
    </div>
  );
}

