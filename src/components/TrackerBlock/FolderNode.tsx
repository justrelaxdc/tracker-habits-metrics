import { useCallback, useRef, useEffect } from "preact/hooks";
import type { TFile } from "obsidian";
import { CSS_CLASSES, MODAL_LABELS } from "../../constants";
import { normalizePath } from "../../utils/path";
import type { FolderNodeProps } from "../types";
import { TrackerItem } from "../TrackerItem/TrackerItem";

/**
 * Folder node component - renders a folder with its trackers and subfolders
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

  // Render folder icon
  const renderFolderIcon = useCallback(() => {
    const folderIcon = plugin.getIconForPath(node.path, false);
    if (!folderIcon) return null;
    
    // Create a span to hold the icon and render it using plugin method
    const iconContainer = document.createElement('span');
    plugin.renderIcon(folderIcon, iconContainer);
    
    return (
      <span 
        class="tracker-notes__folder-icon"
        ref={(el) => {
          if (el && iconContainer.firstChild) {
            el.innerHTML = '';
            el.appendChild(iconContainer.firstChild);
          }
        }}
      />
    );
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
            {renderFolderIcon()}
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
            <TrackerItem
              key={file.path}
              file={file}
              plugin={plugin}
              dateIso={dateIso}
              viewMode={viewMode}
              opts={opts}
            />
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

