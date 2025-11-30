import { App, TFile } from "obsidian";
import type { TrackerSettings, TrackerFileOptions } from "../domain/types";
import { parseMaybeNumber } from "../utils/misc";
import { ERROR_MESSAGES, MAX_DAYS_BACK, TrackerType } from "../constants";
import { isTrackerValueTrue } from "../utils/validation";
import { DateService } from "./date-service";

export class TrackerFileService {
  constructor(private readonly app: App) {}

  /**
   * Находит значение в entries по дате, пробуя разные форматы
   */
  private getEntryValueByDate(
    entries: Map<string, string | number>,
    date: any,
    settings: TrackerSettings
  ): string | number | undefined {
    // Пробуем разные форматы
    const formats = [
      settings.dateFormat,
      'YYYY-MM-DD',
      'DD.MM.YYYY',
      'MM/DD/YYYY'
    ];
    
    for (const format of formats) {
      const dateStr = DateService.format(date, format);
      const val = entries.get(dateStr);
      if (val !== undefined) {
        return val;
      }
    }
    
    return undefined;
  }

  /**
   * Определяет дату начала отслеживания с приоритетами:
   * 1. trackingStartDate из frontmatter
   * 2. Дата создания файла
   * 3. Первая дата из entries
   * 4. Fallback: 365 дней назад от текущей даты
   */
  private determineStartTrackingDate(
    startTrackingDateStr: string | null | undefined,
    file: TFile | undefined,
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    currentDate: any
  ): any {
    let startTrackingDate = null;
    
    // Приоритет 1: Дата из frontmatter (trackingStartDate)
    if (startTrackingDateStr) {
      startTrackingDate = DateService.parseMultiple(startTrackingDateStr, [
        'YYYY-MM-DD',
        settings.dateFormat,
        'DD.MM.YYYY',
        'MM/DD/YYYY'
      ]);
      if (startTrackingDate.isValid()) {
        startTrackingDate = DateService.startOfDay(startTrackingDate);
      } else {
        startTrackingDate = null;
      }
    }
    
    // Приоритет 2: Дата создания файла
    if (!startTrackingDate && file?.stat?.ctime) {
      startTrackingDate = DateService.startOfDay(DateService.fromDate(new Date(file.stat.ctime)));
    }

    // Приоритет 3: Первая дата из entries
    if (entries.size > 0) {
      const sortedDates = Array.from(entries.keys()).sort();
      const firstDateStr = sortedDates[0];
      const firstDate = DateService.parseMultiple(firstDateStr, [
        settings.dateFormat,
        'YYYY-MM-DD',
        'DD.MM.YYYY',
        'MM/DD/YYYY'
      ]);
      if (firstDate.isValid()) {
        const firstDateNormalized = DateService.startOfDay(firstDate);
        if (!startTrackingDate || DateService.isBefore(firstDateNormalized, startTrackingDate)) {
          startTrackingDate = firstDateNormalized;
        }
      }
    }

    // Fallback: 365 дней назад
    if (!startTrackingDate) {
      startTrackingDate = DateService.startOfDay(DateService.subtractDays(currentDate, 365));
    }

    return startTrackingDate;
  }

  async ensureFileWithHeading(filePath: string, type: string = "good-habit"): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) return existing;
    const dir = filePath.split("/").slice(0, -1).join("/");
    if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
      await this.app.vault.createFolder(dir);
    }
    const content = `---\ntype: "${type}"\ndata: {}\n---\n`;
    return this.app.vault.create(filePath, content);
  }

  parseFrontmatterData(frontmatter: string): Record<string, string | number> {
    const data: Record<string, string | number> = {};
    const dataMatch = frontmatter.match(/data:\s*(?:\{\}|(?:\n((?:\s+[^\n]+\n?)*)))/);
    if (dataMatch) {
      if (frontmatter.match(/data:\s*\{\}/)) {
        return data;
      }
      const dataContent = dataMatch[1];
      if (dataContent) {
        const dataLines = dataContent.split(/\n/);
        dataLines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#") || trimmed === "{}") return;
          const match = trimmed.match(/^["']([^"']+)["']\s*:\s*(.+)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
              value = value.replace(/\\"/g, '"').replace(/\\'/g, "'");
            }
            data[key] = parseMaybeNumber(value);
          } else {
            const matchNoQuotes = trimmed.match(/^([^:]+?)\s*:\s*(.+)$/);
            if (matchNoQuotes) {
              const key = matchNoQuotes[1].trim();
              let value = matchNoQuotes[2].trim();
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1);
                value = value.replace(/\\"/g, '"').replace(/\\'/g, "'");
              }
              data[key] = parseMaybeNumber(value);
            }
          }
        });
      }
    }
    return data;
  }

  formatDataToYaml(data: Record<string, string | number>): string {
    if (Object.keys(data).length === 0) {
      return "data: {}\n";
    }
    let yaml = "data:\n";
    const sortedDates = Object.keys(data).sort();
    sortedDates.forEach((date) => {
      const value = data[date];
      if (typeof value === "string") {
        const escapedValue = value
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r");
        yaml += `  "${date}": "${escapedValue}"\n`;
      } else {
        yaml += `  "${date}": ${value}\n`;
      }
    });
    return yaml;
  }

  async readAllEntries(file: TFile): Promise<Map<string, string | number>> {
    const entries = new Map<string, string | number>();
    try {
      const raw = await this.app.vault.read(file);
      const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return entries;

      const frontmatter = frontmatterMatch[1];
      const data = this.parseFrontmatterData(frontmatter);

      Object.entries(data).forEach(([date, value]) => {
        entries.set(date, value);
      });
    } catch (error) {
      console.error("Tracker: error reading all entries", error);
    }

    return entries;
  }

  async readValueForDate(file: TFile, dateIso: string): Promise<string | number | null> {
    const entries = await this.readAllEntries(file);
    return entries.get(dateIso) ?? null;
  }

  async writeLogLine(file: TFile, dateIso: string, value: string) {
    try {
      const content = await this.app.vault.read(file);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        throw new Error(ERROR_MESSAGES.NO_FRONTMATTER);
      }

      const frontmatter = frontmatterMatch[1];
      const body = content.slice(frontmatterMatch[0].length);

      const data = this.parseFrontmatterData(frontmatter);
      data[dateIso] = parseMaybeNumber(value);

      const dataYaml = this.formatDataToYaml(data);

      let newFrontmatter = frontmatter.trim();
      const dataMatch = newFrontmatter.match(/data:\s*(?:\{\}|(?:\n((?:\s+[^\n]+\n?)*)))/);
      if (dataMatch) {
        const dataYamlTrimmed = dataYaml.endsWith("\n") ? dataYaml.slice(0, -1) : dataYaml;
        newFrontmatter = newFrontmatter.replace(
          /data:\s*(?:\{\}|(?:\n((?:\s+[^\n]+\n?)*)))/,
          dataYamlTrimmed
        );
      } else {
        newFrontmatter = newFrontmatter + "\n" + dataYaml.trimEnd();
      }

      if (!newFrontmatter.endsWith("\n")) {
        newFrontmatter += "\n";
      }

      const newContent = `---\n${newFrontmatter}---${body}`;
      await this.app.vault.modify(file, newContent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Tracker: write error", error);
      throw new Error(errorMsg);
    }
  }

  async getFileTypeFromFrontmatter(file: TFile): Promise<TrackerFileOptions> {
    const fileOpts: TrackerFileOptions = {};
    try {
      const fileContent = await this.app.vault.read(file);
      const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const typeMatch = frontmatter.match(/^type:\s*["']?([^"'\s\n]+)["']?/m);
        fileOpts.mode = (typeMatch && typeMatch[1] ? typeMatch[1].trim() : TrackerType.GOOD_HABIT) as any;
        const minValueMatch = frontmatter.match(/^minValue:\s*([\d.]+)/m);
        if (minValueMatch) fileOpts.minValue = minValueMatch[1];
        const maxValueMatch = frontmatter.match(/^maxValue:\s*([\d.]+)/m);
        if (maxValueMatch) fileOpts.maxValue = maxValueMatch[1];
        const stepMatch = frontmatter.match(/^step:\s*([\d.]+)/m);
        if (stepMatch) fileOpts.step = stepMatch[1];
        const minLimitMatch = frontmatter.match(/^minLimit:\s*([\d.]+)/m);
        if (minLimitMatch) fileOpts.minLimit = minLimitMatch[1];
        const maxLimitMatch = frontmatter.match(/^maxLimit:\s*([\d.]+)/m);
        if (maxLimitMatch) fileOpts.maxLimit = maxLimitMatch[1];
        const unitMatch = frontmatter.match(/^unit:\s*["']?([^"'\n]+)["']?/m);
        if (unitMatch && unitMatch[1]) {
          fileOpts.unit = unitMatch[1].trim();
        }
        const trackingStartDateMatch = frontmatter.match(/^trackingStartDate:\s*["']?([^"'\s\n]+)["']?/m);
        if (trackingStartDateMatch && trackingStartDateMatch[1]) {
          fileOpts.trackingStartDate = trackingStartDateMatch[1].trim();
        }
      } else {
        fileOpts.mode = TrackerType.GOOD_HABIT;
      }
    } catch (error) {
      console.error("Tracker: error reading frontmatter", error);
      fileOpts.mode = TrackerType.GOOD_HABIT;
    }
    return fileOpts;
  }

  getStartTrackingDate(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    fileOpts?: TrackerFileOptions
  ): string | null {
    // Приоритет 1: Дата из frontmatter
    if (fileOpts?.trackingStartDate) {
      return fileOpts.trackingStartDate;
    }
    
    // Fallback: текущая дата
    return DateService.format(DateService.now(), settings.dateFormat);
  }

  calculateStreak(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    endDate: Date | any,
    trackerType?: string,
    file?: TFile,
    startTrackingDateStr?: string | null
  ): number {
    let streak = 0;
    let currentDate = endDate instanceof Date ? DateService.fromDate(endDate) : DateService.fromDate(new Date(endDate));
    currentDate = DateService.startOfDay(currentDate); // Нормализуем к началу дня
    const metricType = (trackerType || "good-habit").toLowerCase();
    const isBadHabit = metricType === "bad-habit";

    // Определяем дату начала отслеживания
    const startTrackingDate = this.determineStartTrackingDate(
      startTrackingDateStr,
      file,
      entries,
      settings,
      currentDate
    );

    // Убеждаемся, что startTrackingDate валидная
    if (!startTrackingDate || !startTrackingDate.isValid()) {
      return 0;
    }

    let daysChecked = 0;

    while (daysChecked < MAX_DAYS_BACK) {
      // Проверяем, не вышли ли мы за пределы даты начала отслеживания
      if (DateService.isBefore(currentDate, startTrackingDate)) {
        break;
      }

      // Ищем значение в entries, пробуя разные форматы
      const val = this.getEntryValueByDate(entries, currentDate, settings);
      let isSuccess = false;

      if (isBadHabit) {
        // Для bad-habit: успех = отсутствие записи ИЛИ значение 0/false
        if (val == null || val === undefined) {
          isSuccess = true;
        } else {
          const hasValue = isTrackerValueTrue(val);
          isSuccess = !hasValue;
        }
      } else {
        // Для good-habit и метрик: успех = наличие записи с истинным значением
        if (val != null && val !== undefined) {
          isSuccess = isTrackerValueTrue(val);
        }
      }

      if (isSuccess) {
        streak++;
      } else {
        break;
      }

      currentDate = currentDate.subtract(1, "days");
      daysChecked++;
    }

    return streak;
  }

  calculateBestStreak(
    entries: Map<string, string | number>,
    settings: TrackerSettings,
    trackerType?: string,
    file?: TFile,
    startTrackingDateStr?: string | null
  ): number {
    const metricType = (trackerType || "good-habit").toLowerCase();
    const isBadHabit = metricType === "bad-habit";
    
    if (entries.size === 0) return 0;
    
    const today = DateService.now();
    let currentDate = DateService.startOfDay(today);
    
    // Определяем дату начала отслеживания
    const startTrackingDate = this.determineStartTrackingDate(
      startTrackingDateStr,
      file,
      entries,
      settings,
      currentDate
    );

    // Убеждаемся, что startTrackingDate валидная
    if (!startTrackingDate || !startTrackingDate.isValid()) {
      return 0;
    }
    
    let bestStreak = 0;
    let currentStreak = 0;
    let daysChecked = 0;
    
    // Проходим по всем дням от начала отслеживания до сегодня
    while (!DateService.isBefore(currentDate, startTrackingDate) && daysChecked < MAX_DAYS_BACK) {
      // Ищем значение в entries, пробуя разные форматы
      const val = this.getEntryValueByDate(entries, currentDate, settings);
      let isSuccess = false;
      
      if (isBadHabit) {
        // Для bad-habit: успех = отсутствие записи ИЛИ значение 0/false
        if (val == null || val === undefined) {
          isSuccess = true;
        } else {
          const hasValue = isTrackerValueTrue(val);
          isSuccess = !hasValue;
        }
      } else {
        // Для good-habit и метрик: успех = наличие записи с истинным значением
        if (val != null && val !== undefined) {
          isSuccess = isTrackerValueTrue(val);
        }
      }
      
      if (isSuccess) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      currentDate = currentDate.subtract(1, "days");
      daysChecked++;
    }
    
    return bestStreak;
  }

}

