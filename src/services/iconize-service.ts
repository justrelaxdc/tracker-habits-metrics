import { App, TFile, normalizePath } from "obsidian";

interface IconizeData {
  settings?: any;
  [path: string]: string | any;
}

/**
 * Service for integration with Iconize plugin
 * Reads icon data from .obsidian/plugins/obsidian-icon-folder/data.json
 */
export class IconizeService {
  private iconData: IconizeData | null = null;
  private dataLoaded: boolean = false;

  constructor(private readonly app: App) {}

  /**
   * Loads icon data from Iconize plugin data file
   */
  async loadIconizeData(): Promise<void> {
    if (this.dataLoaded) {
      return;
    }

    const configDir = this.app.vault.configDir || ".obsidian";
    
    try {
      // Files in .obsidian are not part of the vault
      // vault.adapter.read() expects a path relative to vault root
      // configDir is already relative to vault root (e.g., ".obsidian")
      // So we need: configDir + "/plugins/obsidian-icon-folder/data.json"
      
      // Build relative path from vault root
      const relativePath = normalizePath(`${configDir}/plugins/obsidian-icon-folder/data.json`);
      
      // Try to read file using adapter (expects relative path)
      try {
        const content = await this.app.vault.adapter.read(relativePath);
        this.iconData = JSON.parse(content);
        this.dataLoaded = true;
      } catch (readError) {
        // File doesn't exist or can't be read
        this.iconData = null;
        this.dataLoaded = true;
      }
    } catch (error) {
      // Silently fail if Iconize is not installed or data is invalid
      console.error("[Iconize] Error loading data:", error);
      this.iconData = null;
      this.dataLoaded = true;
    }
  }

  /**
   * Gets icon for a given path (file or folder)
   * Only returns icon if it's explicitly set for this path - no inheritance from parent folders
   * @param path - Path to file or folder
   * @param isFile - Whether the path is a file (true) or folder (false) - not used anymore but kept for compatibility
   * @returns Icon string (emoji or Lucide icon name) or null if not found
   */
  getIcon(path: string, isFile: boolean = false): string | null {
    if (!this.iconData) {
      return null;
    }

    // Normalize path (remove leading slash, use forward slashes)
    const normalizedPath = this.normalizePath(path);

    // Try exact match first (without leading slash)
    if (this.iconData[normalizedPath]) {
      return this.iconData[normalizedPath];
    }

    // Try with leading slash
    const pathWithSlash = `/${normalizedPath}`;
    if (this.iconData[pathWithSlash]) {
      return this.iconData[pathWithSlash];
    }

    // For files, try without extension
    if (normalizedPath.endsWith(".md")) {
      const pathWithoutExt = normalizedPath.slice(0, -3);
      if (this.iconData[pathWithoutExt]) {
        return this.iconData[pathWithoutExt];
      }
      if (this.iconData[`/${pathWithoutExt}`]) {
        return this.iconData[`/${pathWithoutExt}`];
      }
    }

    // No inheritance - only return icon if explicitly set for this path
    return null;
  }

  /**
   * Normalizes path for Iconize format
   */
  private normalizePath(path: string): string {
    if (!path) return "";
    return path
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/$/, "");
  }


  /**
   * Renders icon in a container element
   * @param icon - Icon string (emoji or Lucide icon name)
   * @param container - Container element to render icon in
   */
  renderIcon(icon: string | null, container: HTMLElement): void {
    if (!icon) {
      return;
    }

    // Check if it's a Lucide icon (starts with "Li")
    if (icon.startsWith("Li")) {
      // For Lucide icons, Iconize typically uses format like "LiAtom"
      // We'll create a span that Iconize can style
      // Iconize may use CSS to render these, so we add a class and data attribute
      const iconSpan = container.createSpan({ 
        cls: "iconize-icon lucide-icon",
        attr: { 
          "data-icon": icon,
          "aria-label": icon
        }
      });
      // Add a small space after icon
      iconSpan.style.marginRight = "0.3em";
      iconSpan.style.display = "inline-block";
    } else {
      // Emoji - just add as text with space
      const emojiSpan = container.createSpan({ text: icon });
      emojiSpan.style.marginRight = "0.3em";
    }
  }

  /**
   * Invalidates cached data (useful if Iconize data changes)
   */
  invalidateCache(): void {
    this.dataLoaded = false;
    this.iconData = null;
  }
}

