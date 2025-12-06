import { useCallback, useRef, useEffect } from "preact/hooks";
import { CSS_CLASSES, MODAL_LABELS } from "../../constants";
import type { TrackerHeaderProps } from "../types";
import { Icon } from "../Icon";
import { setCssProps } from "../../utils/theme";

/**
 * Tracker header with title, icon, and action buttons
 * Uses declarative Icon component for file icons
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

  // Apply limit progress styles
  useEffect(() => {
    if (headerRef.current) {
      if (limitProgress) {
        setCssProps(headerRef.current, {
          '--limit-progress-width': limitProgress.width,
          '--limit-progress-color': limitProgress.color,
        });
      } else {
        setCssProps(headerRef.current, {
          '--limit-progress-width': '0%',
          '--limit-progress-color': 'transparent',
        });
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
        <Icon path={file.path} isFile={true} className="tracker-notes__tracker-icon" />
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
