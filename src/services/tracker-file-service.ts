import { App, TFile, parseYaml } from "obsidian";
import type { TrackerSettings, TrackerFileOptions } from "../domain/types";
import type { DateWrapper } from "../domain/date-types";
import { parseMaybeNumber } from "../utils/misc";
import { ERROR_MESSAGES, TrackerType, TrackerTypeValue } from "../constants";
import { DateService } from "./date-service";
import { statisticsService } from "./statistics-service";
import { logError } from "../utils/notifications";

export class TrackerFileService {
  constructor(private readonly app: App) {}

  /**
   * No-op retained for backward compatibility with external calls.
   * File content is read directly and fresh via app.vault.read.
   */
  invalidateFileCache(_filePath: string): void {
    void _filePath;
    // Direct vault reads do not require cache invalidation
  }

  async ensureFileWithHeading(filePath: string, type: string = "good-habit"): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) return existing;
    const dir = filePath.split("/").slice(0, -1).join("/");
    if (dir) {
      const parts = dir.split("/").filter(Boolean);
      let currentPath = "";
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!this.app.vault.getAbstractFileByPath(currentPath)) {
          await this.app.vault.createFolder(currentPath);
        }
      }
    }
    const content = `---\ntype: "${type}"\ndata: {}\n---\n`;
    return this.app.vault.create(filePath, content);
  }

  /**
   * Type guard to check if a string is a valid TrackerTypeValue
   */
  isValidTrackerType(value: string): value is TrackerTypeValue {
    return Object.values(TrackerType).includes(value as TrackerTypeValue);
  }

  /**
   * Normalize any raw type string into a standard TrackerTypeValue
   * Case-insensitive, trims whitespace, supports common aliases
   */
  normalizeTrackerType(rawType: unknown): TrackerTypeValue {
    if (!rawType || typeof rawType !== "string") {
      return TrackerType.GOOD_HABIT;
    }
    const cleaned = rawType.trim().toLowerCase();
    switch (cleaned) {
      case "scale":
        return TrackerType.SCALE;
      case "number":
        return TrackerType.NUMBER;
      case "plusminus":
      case "plus-minus":
      case "counter":
      case "count":
        return TrackerType.PLUSMINUS;
      case "text":
      case "string":
        return TrackerType.TEXT;
      case "bad-habit":
      case "bad_habit":
      case "badhabit":
        return TrackerType.BAD_HABIT;
      case "good-habit":
      case "good_habit":
      case "goodhabit":
      case "habit":
      default:
        return TrackerType.GOOD_HABIT;
    }
  }

  /**
   * Safely finds the start and end indices of the `data:` section in frontmatter.
   * Supports both inline flow JSON (`data: {...}`) and multiline YAML block mappings (`data:\n  2026-01-01: 5`).
   */
  private findDataSectionBounds(frontmatter: string): { start: number; end: number } | null {
    const dataMatch = frontmatter.match(/(?:^|\r?\n)([ \t]*data:[ \t]*)/);
    if (!dataMatch || dataMatch.index === undefined) {
      return null;
    }

    const fullMatch = dataMatch[0];
    const prefixLen = fullMatch.startsWith("\r\n") ? 2 : fullMatch.startsWith("\n") ? 1 : 0;
    const sectionStart = dataMatch.index + prefixLen;
    const afterColon = sectionStart + (fullMatch.length - prefixLen);

    // Look at what's immediately after "data:" on the same line
    const nextNewlineIndex = frontmatter.indexOf("\n", afterColon);
    const lineEnd = nextNewlineIndex !== -1 ? nextNewlineIndex : frontmatter.length;
    const restOfLine = frontmatter.substring(afterColon, lineEnd).trim();

    // Case 1: Inline JSON / flow mapping (starts with '{')
    if (restOfLine.startsWith("{")) {
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let jsonEnd = -1;

      const braceStart = frontmatter.indexOf("{", afterColon);
      for (let i = braceStart; i < frontmatter.length; i++) {
        const char = frontmatter[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === "{") braceCount++;
          else if (char === "}") {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
      }

      if (jsonEnd !== -1) {
        let sectionEnd = jsonEnd;
        if (frontmatter.substring(sectionEnd).startsWith("\r\n")) {
          sectionEnd += 2;
        } else if (frontmatter.substring(sectionEnd).startsWith("\n")) {
          sectionEnd += 1;
        }
        return { start: sectionStart, end: sectionEnd };
      }
    }

    // Case 2: Multiline YAML mapping (e.g., Obsidian Properties column format)
    const lines = frontmatter.substring(sectionStart).split(/\r?\n/);
    let lineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0) {
        lineCount++;
        continue;
      }

      const isIndented = /^[ \t]+/.test(line);
      const isBlank = line.trim().length === 0;

      if (isIndented || isBlank) {
        lineCount++;
      } else {
        // Next unindented key encountered - end of data block
        break;
      }
    }

    let sectionEnd = sectionStart;
    let currentLine = 0;
    let pos = sectionStart;

    while (pos < frontmatter.length && currentLine < lineCount) {
      const nextNl = frontmatter.indexOf("\n", pos);
      if (nextNl === -1) {
        sectionEnd = frontmatter.length;
        break;
      }
      sectionEnd = nextNl + 1;
      pos = nextNl + 1;
      currentLine++;
    }

    return { start: sectionStart, end: sectionEnd };
  }

  /**
   * Normalize date keys from YAML.
   * If YAML parser converted an unquoted date like `2026-01-01:` into a Date object or stringified Date,
   * this safely normalizes it back to 'YYYY-MM-DD'.
   */
  private normalizeDateKey(key: unknown): string {
    const str = String(key);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      const d = new Date(timestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return str;
  }

  /**
   * Parse tracker entries from frontmatter string.
   * Leverages Obsidian's native parseYaml to effortlessly read both
   * compact inline JSON (`data: {...}`) and multiline YAML column mapping (`data:\n  2026-01-01: 5`).
   */
  parseFrontmatterData(frontmatter: string): Record<string, string | number> {
    try {
      const parsed = parseYaml(frontmatter);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }
      const data = (parsed as Record<string, unknown>).data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {};
      }
      const result: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (value !== undefined && value !== null) {
          result[this.normalizeDateKey(key)] = parseMaybeNumber(String(value));
        }
      }
      return result;
    } catch (error) {
      logError("Tracker: error parsing YAML data", error);
      return {};
    }
  }

  formatDataToJson(data: Record<string, string | number>): string {
    if (Object.keys(data).length === 0) {
      return "data: {}\n";
    }

    // Sort keys chronologically/alphabetically for readability
    const sortedKeys = Object.keys(data).sort();
    const sortedData: Record<string, string | number> = {};
    for (const key of sortedKeys) {
      sortedData[key] = data[key];
    }

    const jsonString = JSON.stringify(sortedData);
    return `data: ${jsonString}\n`;
  }

  /**
   * Replace data section in frontmatter with new JSON data.
   * Cleanly replaces either an inline JSON or a multiline YAML block,
   * completely preventing duplicate `data:` keys or YAML corruption.
   */
  replaceDataInFrontmatter(frontmatter: string, newDataJson: string): string {
    let newFrontmatter = frontmatter;
    const bounds = this.findDataSectionBounds(newFrontmatter);
    const formattedData = newDataJson.trim() + "\n";

    if (bounds) {
      newFrontmatter = newFrontmatter.substring(0, bounds.start) + formattedData + newFrontmatter.substring(bounds.end);
    } else {
      newFrontmatter = newFrontmatter.trimEnd() + "\n" + formattedData;
    }

    if (!newFrontmatter.endsWith("\n")) {
      newFrontmatter += "\n";
    }

    return newFrontmatter;
  }

  /**
   * Parse file options from frontmatter string using native YAML parsing
   */
  parseFileOptions(frontmatter: string): TrackerFileOptions {
    const fileOpts: TrackerFileOptions = {};
    try {
      const parsed = parseYaml(frontmatter);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        fileOpts.mode = TrackerType.GOOD_HABIT;
        return fileOpts;
      }
      const record = parsed as Record<string, unknown>;
      fileOpts.mode = this.normalizeTrackerType(record.type);
      if (record.minValue !== undefined) fileOpts.minValue = String(record.minValue);
      if (record.maxValue !== undefined) fileOpts.maxValue = String(record.maxValue);
      if (record.step !== undefined) fileOpts.step = String(record.step);
      if (record.minLimit !== undefined) fileOpts.minLimit = String(record.minLimit);
      if (record.maxLimit !== undefined) fileOpts.maxLimit = String(record.maxLimit);
      if (record.unit !== undefined) fileOpts.unit = String(record.unit).trim();
      if (record.trackingStartDate !== undefined) fileOpts.trackingStartDate = String(record.trackingStartDate).trim();
    } catch (error) {
      logError("Tracker: error parsing frontmatter options", error);
      fileOpts.mode = TrackerType.GOOD_HABIT;
    }
    return fileOpts;
  }

  /**
   * Read both entries and file options from tracker file in a single, safe vault read.
   * Automatically strips UTF-8 BOM, handles both YAML & JSON data formats,
   * and falls back to Obsidian metadataCache if raw regex extraction fails.
   */
  async readTrackerFile(file: TFile): Promise<{
    entries: Map<string, string | number>;
    fileOpts: TrackerFileOptions;
  }> {
    try {
      const content = await this.app.vault.read(file);
      const cleanContent = content.replace(/^\uFEFF/, "").trimStart();
      const frontmatterMatch = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      let frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";

      // Safe fallback to Obsidian's metadataCache if frontmatter regex failed
      if (!frontmatter) {
        const fileCache = this.app.metadataCache.getFileCache(file);
        if (fileCache?.frontmatter) {
          const fm = fileCache.frontmatter as Record<string, unknown>;
          const fileOpts: TrackerFileOptions = {
            mode: this.normalizeTrackerType(fm.type),
            minValue: fm.minValue !== undefined ? String(fm.minValue) : undefined,
            maxValue: fm.maxValue !== undefined ? String(fm.maxValue) : undefined,
            step: fm.step !== undefined ? String(fm.step) : undefined,
            minLimit: fm.minLimit !== undefined ? String(fm.minLimit) : undefined,
            maxLimit: fm.maxLimit !== undefined ? String(fm.maxLimit) : undefined,
            unit: fm.unit !== undefined ? String(fm.unit).trim() : undefined,
            trackingStartDate: fm.trackingStartDate !== undefined ? String(fm.trackingStartDate).trim() : undefined,
          };
          const entries = new Map<string, string | number>();
          if (fm.data && typeof fm.data === "object" && !Array.isArray(fm.data)) {
            for (const [k, v] of Object.entries(fm.data as Record<string, unknown>)) {
              if (v !== undefined && v !== null) {
                entries.set(this.normalizeDateKey(k), parseMaybeNumber(String(v)));
              }
            }
          }
          return { entries, fileOpts };
        }

        return {
          entries: new Map(),
          fileOpts: { mode: TrackerType.GOOD_HABIT },
        };
      }

      const entriesData = this.parseFrontmatterData(frontmatter);
      const fileOpts = this.parseFileOptions(frontmatter);

      const entries = new Map<string, string | number>();
      for (const [date, value] of Object.entries(entriesData)) {
        entries.set(date, value);
      }

      return { entries, fileOpts };
    } catch (error) {
      logError("Tracker: error reading tracker file", error);
      // Double check metadataCache before falling back
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache?.frontmatter) {
        const fm = fileCache.frontmatter as Record<string, unknown>;
        return {
          entries: new Map(),
          fileOpts: { mode: this.normalizeTrackerType(fm.type) },
        };
      }
      return {
        entries: new Map(),
        fileOpts: { mode: TrackerType.GOOD_HABIT },
      };
    }
  }

  async readAllEntries(file: TFile): Promise<Map<string, string | number>> {
    const { entries } = await this.readTrackerFile(file);
    return entries;
  }

  /**
   * Write entry using state data without stale caching layers
   */
  async writeLogLineFromState(
    file: TFile,
    state: { entries: Map<string, string | number> }
  ): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const cleanContent = content.replace(/^\uFEFF/, "");
      const frontmatterMatch = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      if (!frontmatterMatch) {
        throw new Error(ERROR_MESSAGES.NO_FRONTMATTER);
      }

      const frontmatter = frontmatterMatch[1];
      const body = cleanContent.slice(frontmatterMatch[0].length);

      const dataJson = this.formatDataToJson(Object.fromEntries(state.entries));
      const newFrontmatter = this.replaceDataInFrontmatter(frontmatter, dataJson);

      const newContent = `---\n${newFrontmatter}---${body}`;
      await this.app.vault.modify(file, newContent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError("Tracker: write error", error);
      throw new Error(errorMsg);
    }
  }

  async writeLogLine(file: TFile, dateIso: string, value: string): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const cleanContent = content.replace(/^\uFEFF/, "");
      const frontmatterMatch = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      if (!frontmatterMatch) {
        throw new Error(ERROR_MESSAGES.NO_FRONTMATTER);
      }

      const frontmatter = frontmatterMatch[1];
      const body = cleanContent.slice(frontmatterMatch[0].length);

      const data = this.parseFrontmatterData(frontmatter);
      data[dateIso] = parseMaybeNumber(value);

      const dataJson = this.formatDataToJson(data);
      const newFrontmatter = this.replaceDataInFrontmatter(frontmatter, dataJson);

      const newContent = `---\n${newFrontmatter}---${body}`;
      await this.app.vault.modify(file, newContent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError("Tracker: write error", error);
      throw new Error(errorMsg);
    }
  }

  async deleteEntryFromState(
    file: TFile,
    state: { entries: Map<string, string | number> }
  ): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const cleanContent = content.replace(/^\uFEFF/, "");
      const frontmatterMatch = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      if (!frontmatterMatch) {
        throw new Error(ERROR_MESSAGES.NO_FRONTMATTER);
      }

      const frontmatter = frontmatterMatch[1];
      const body = cleanContent.slice(frontmatterMatch[0].length);

      const dataJson = this.formatDataToJson(Object.fromEntries(state.entries));
      const newFrontmatter = this.replaceDataInFrontmatter(frontmatter, dataJson);

      const newContent = `---\n${newFrontmatter}---${body}`;
      await this.app.vault.modify(file, newContent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError("Tracker: delete entry error", error);
      throw new Error(errorMsg);
    }
  }

  async deleteEntry(file: TFile, dateIso: string): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const cleanContent = content.replace(/^\uFEFF/, "");
      const frontmatterMatch = cleanContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      if (!frontmatterMatch) {
        throw new Error(ERROR_MESSAGES.NO_FRONTMATTER);
      }

      const frontmatter = frontmatterMatch[1];
      const body = cleanContent.slice(frontmatterMatch[0].length);

      const data = this.parseFrontmatterData(frontmatter);
      delete data[dateIso];

      const dataJson = this.formatDataToJson(data);
      const newFrontmatter = this.replaceDataInFrontmatter(frontmatter, dataJson);

      const newContent = `---\n${newFrontmatter}---${body}`;
      await this.app.vault.modify(file, newContent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError("Tracker: delete entry error", error);
      throw new Error(errorMsg);
    }
  }

  async getFileTypeFromFrontmatter(file: TFile): Promise<TrackerFileOptions> {
    const { fileOpts } = await this.readTrackerFile(file);
    return fileOpts;
  }

  getStartTrackingDate(
    _entries: Map<string, string | number>,
    settings: TrackerSettings,
    fileOpts?: TrackerFileOptions
  ): string | null {
    if (fileOpts?.trackingStartDate) {
      return fileOpts.trackingStartDate;
    }
    return DateService.format(DateService.now(), settings.dateFormat);
  }

  calculateStreak(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    endDate: Date | DateWrapper,
    trackerType?: string,
    file?: TFile,
    startTrackingDateStr?: string | null
  ): number {
    return statisticsService.calculateStreaks(
      entries,
      settings,
      endDate,
      trackerType || "good-habit",
      file,
      startTrackingDateStr
    ).current;
  }

  calculateBestStreak(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    trackerType?: string,
    file?: TFile,
    startTrackingDateStr?: string | null
  ): number {
    return statisticsService.calculateStreaks(
      entries,
      settings,
      DateService.now(),
      trackerType || "good-habit",
      file,
      startTrackingDateStr
    ).best;
  }
}
