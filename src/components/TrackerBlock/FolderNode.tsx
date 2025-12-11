import { useCallback, useRef, useEffect } from "preact/hooks";
import type { TFile } from "obsidian";
import { TFolder, Menu } from "obsidian";
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
  const folderNameRef = useRef<HTMLSpanElement>(null);

  // Normalize path once to avoid repeated calls
  const normalizedPath = normalizePath(node.path);

  const shouldShowHeader = node.files.length > 0 || (node.level > 0 && node.children.length > 0);

  const handleMoveUp = useCallback(() => {
    void plugin.moveFolderUp(normalizedPath);
  }, [plugin, normalizedPath]);

  const handleMoveDown = useCallback(() => {
    void plugin.moveFolderDown(normalizedPath);
  }, [plugin, normalizedPath]);

  // Add context menu handler for folder name using Obsidian API
  useEffect(() => {
    const folderNameElement = folderNameRef.current;
    if (!folderNameElement) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const folder = plugin.app.vault.getAbstractFileByPath(normalizedPath);
      
      if (folder && folder instanceof TFolder) {
        // Create context menu using Menu API
        const menu = new Menu();
        
        // Add custom menu item for creating tracker in this folder
        menu.addItem((item) => {
          item.setTitle(MODAL_LABELS.CREATE_TRACKER_IN_FOLDER);
          item.setIcon("plus");
          item.onClick(() => {
            plugin.createNewTracker(normalizedPath);
          });
        });
        
        // Trigger 'file-menu' event so other plugins (like Iconize) can add their items
        // This allows the standard Obsidian context menu to be built
        plugin.app.workspace.trigger('file-menu', menu, folder, 'file-explorer');
        
        // Show menu at mouse position
        menu.showAtMouseEvent(e);
      }
    };

    folderNameElement.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      folderNameElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [plugin, normalizedPath]);

  return (
    <div
      ref={nodeRef}
      class={`${CSS_CLASSES.FOLDER_NODE} level-${node.level}`}
      data-folder-path={normalizedPath}
    >
      {shouldShowHeader && (
        <div class={`${CSS_CLASSES.FOLDER_HEADER} level-${node.level}`}>
          <span>
            <Icon path={node.path} isFile={false} className="tracker-notes__folder-icon" />
            <span ref={folderNameRef} class="tracker-notes__folder-name">{node.name}</span>
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
        <div class={CSS_CLASSES.TRACKERS_CONTAINER} data-folder-path={normalizedPath}>
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
