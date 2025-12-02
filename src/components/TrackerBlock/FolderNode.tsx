import { useCallback, useRef } from "preact/hooks";
import type { TFile } from "obsidian";
import { CSS_CLASSES, MODAL_LABELS } from "../../constants";
import { normalizePath } from "../../utils/path";
import type { FolderNodeProps } from "../types";
import { TrackerItem } from "../TrackerItem/TrackerItem";
import { Icon } from "../Icon";
import { ErrorBoundary } from "../TrackerItem/ErrorBoundary";

/**
 * Folder node component - renders a folder with its trackers and subfolders
 * Uses declarative Icon component instead of imperative DOM manipulation
 */
export function FolderNode({ node, plugin, dateIso, viewMode, opts }: FolderNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  const shouldShowHeader = node.files.length > 0 || (node.level > 0 && node.children.length > 0);

  const handleMoveUp = useCallback(async () => {
    const folderPath = normalizePath(node.path);
    await plugin.moveFolderUp(folderPath);
  }, [plugin, node.path]);

  const handleMoveDown = useCallback(async () => {
    const folderPath = normalizePath(node.path);
    await plugin.moveFolderDown(folderPath);
  }, [plugin, node.path]);

  return (
    <div
      ref={nodeRef}
      class={`${CSS_CLASSES.FOLDER_NODE} level-${node.level}`}
      data-folder-path={normalizePath(node.path)}
    >
      {shouldShowHeader && (
        <div class={`${CSS_CLASSES.FOLDER_HEADER} level-${node.level}`}>
          <span>
            <Icon path={node.path} isFile={false} className="tracker-notes__folder-icon" />
            <span>{node.name}</span>
          </span>
          <div class={CSS_CLASSES.ORDER_BTN_CONTAINER}>
            <button
              type="button"
              class={CSS_CLASSES.ORDER_BTN_UP}
              onClick={handleMoveUp}
              title={MODAL_LABELS.MOVE_UP}
            >
              ↑
            </button>
            <button
              type="button"
              class={CSS_CLASSES.ORDER_BTN_DOWN}
              onClick={handleMoveDown}
              title={MODAL_LABELS.MOVE_DOWN}
            >
              ↓
            </button>
          </div>
        </div>
      )}

      {node.files.length > 0 && (
        <div class={CSS_CLASSES.TRACKERS_CONTAINER} data-folder-path={normalizePath(node.path)}>
          {node.files.map((file: TFile) => (
            <ErrorBoundary key={file.path}>
              <TrackerItem
                file={file}
                plugin={plugin}
                dateIso={dateIso}
                viewMode={viewMode}
                opts={opts}
              />
            </ErrorBoundary>
          ))}
        </div>
      )}

      {node.children.map((childNode) => (
        <FolderNode
          key={childNode.path}
          node={childNode}
          plugin={plugin}
          dateIso={dateIso}
          viewMode={viewMode}
          opts={opts}
        />
      ))}
    </div>
  );
}
