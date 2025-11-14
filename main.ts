import { App, MarkdownRenderChild, MarkdownPostProcessorContext, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

type HabitSettings = {
  habitsFolder: string;        // папка с заметками привычек
  dateFormat: string;          // "YYYY-MM-DD"
  timeFormat: string;          // "HH:mm"
  logHeading: string;          // "## Log"
  overwriteSameDay: boolean;   // перезаписывать последнюю строку за дату
};

const DEFAULT_SETTINGS: HabitSettings = {
  habitsFolder: "3. Metrics/Habits",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "HH:mm",
  logHeading: "## Log",
  overwriteSameDay: true,
};

export default class HabitNotesPlugin extends Plugin {
  settings: HabitSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addSettingTab(new HabitSettingsTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor("habit", this.processHabitBlock.bind(this));

    this.addCommand({
      id: "habit-toggle-today",
      name: "Toggle habit today (bool)",
      callback: () => this.quickToggleToday()
    });

    this.addCommand({
      id: "habit-increment",
      name: "Increment habit (+1)",
      callback: () => this.quickAdjustCounter(+1)
    });

    this.addCommand({
      id: "habit-decrement",
      name: "Decrement habit (-1)",
      callback: () => this.quickAdjustCounter(-1)
    });
  }

  async onunload() {}

  // ---- Код-блоки ------------------------------------------------------------

  async processHabitBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const opts = parseOptions(source); // file, view, date, mode
    if (!opts.file) {
      el.createEl("div", { text: "habit: требуется параметр 'file'" });
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(opts.file);
    if (!(file instanceof TFile)) {
      el.createEl("div", { text: `habit: файл не найден: ${opts.file}` });
      return;
    }

    const view = (opts.view ?? "control").toLowerCase();
    const dateIso = resolveDateIso(opts.date, this.settings.dateFormat);

    const container = el.createDiv({ cls: "habit-notes" });
    if (view === "display") {
      const value = await this.readValueForDate(file, dateIso);
      container.createEl("div", { text: `${dateIso}: ${value ?? "—"}` });
      return;
    }

    // control view
    const mode = (opts.mode ?? "checkbox").toLowerCase();
    if (mode === "checkbox") {
      const wrap = container.createDiv({ cls: "habit-notes__row" });
      const input = wrap.createEl("input", { type: "checkbox" });
      const current = await this.readValueForDate(file, dateIso);
      input.checked = current === 1 || current === "1" || current === true;
      input.onchange = async () => {
        const val = input.checked ? 1 : 0;
        await this.writeLogLine(file, dateIso, String(val));
        new Notice(`Записано: ${dateIso}: ${val}`);
      };
    } else if (mode === "number") {
      const wrap = container.createDiv({ cls: "habit-notes__row" });
      const input = wrap.createEl("input", { type: "number", placeholder: "0" }) as HTMLInputElement;
      const current = await this.readValueForDate(file, dateIso);
      if (current != null && !isNaN(Number(current))) input.value = String(current);
      const btn = wrap.createEl("button", { text: "Set" });
      btn.onclick = async () => {
        const val = Number(input.value);
        if (isNaN(val)) { new Notice("Некорректное число"); return; }
        await this.writeLogLine(file, dateIso, String(val));
        new Notice(`Записано: ${dateIso}: ${val}`);
      };
    } else if (mode === "plusminus") {
      const wrap = container.createDiv({ cls: "habit-notes__row" });
      const valEl = wrap.createEl("span", { text: "0", cls: "habit-notes__value" });
      let current = Number(await this.readValueForDate(file, dateIso) ?? 0);
      if (!isNaN(current)) valEl.setText(String(current));
      const minus = wrap.createEl("button", { text: "−" });
      const plus  = wrap.createEl("button", { text: "+" });
      minus.onclick = async () => {
        current = (Number.isFinite(current) ? current : 0) - 1;
        valEl.setText(String(current));
        await this.writeLogLine(file, dateIso, String(current));
      };
      plus.onclick = async () => {
        current = (Number.isFinite(current) ? current : 0) + 1;
        valEl.setText(String(current));
        await this.writeLogLine(file, dateIso, String(current));
      };
    } else {
      container.createEl("div", { text: `Неизвестный mode: ${mode}` });
    }
  }

  // ---- Быстрые команды ------------------------------------------------------

  async quickToggleToday() {
    const file = await this.pickHabitFile();
    if (!file) return;
    const dateIso = resolveDateIso("today", this.settings.dateFormat);
    const cur = await this.readValueForDate(file, dateIso);
    const next = (cur === 1 || cur === "1" || cur === true) ? "0" : "1";
    await this.writeLogLine(file, dateIso, next);
    new Notice(`Тоггл: ${file.path} → ${dateIso}: ${next}`);
  }

  async quickAdjustCounter(delta: number) {
    const file = await this.pickHabitFile();
    if (!file) return;
    const dateIso = resolveDateIso("today", this.settings.dateFormat);
    const curRaw = await this.readValueForDate(file, dateIso);
    let cur = Number(curRaw ?? 0);
    if (!Number.isFinite(cur)) cur = 0;
    const next = String(cur + delta);
    await this.writeLogLine(file, dateIso, next);
    new Notice(`Счётчик: ${file.path} → ${dateIso}: ${next}`);
  }

  // ---- Чтение/запись --------------------------------------------------------

  async ensureFileWithHeading(filePath: string): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) return existing;
    const dir = filePath.split("/").slice(0, -1).join("/");
    if (dir && !(this.app.vault.getAbstractFileByPath(dir))) {
      await this.app.vault.createFolder(dir);
    }
    const content = `---\nhabit:\n  name: ${filePath.split("/").pop()?.replace(".md","")}\n  type: bool\n---\n\n${this.settings.logHeading}\n`;
    return await this.app.vault.create(filePath, content);
  }

  async readValueForDate(file: TFile, dateIso: string): Promise<string | number | null> {
    const raw = await this.app.vault.read(file);
    const logIdx = raw.indexOf(this.settings.logHeading);
    if (logIdx === -1) return null;
    const body = raw.slice(logIdx + this.settings.logHeading.length);
    // Ищем последнюю строку, начинающуюся с dateIso
    const lines = body.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const matches = lines.filter(l => l.startsWith(dateIso));
    if (matches.length === 0) {
      // также пробуем совпадения dateIso с временем (YYYY-MM-DDT..:)
      const matchesT = lines.filter(l => l.startsWith(dateIso + "T"));
      if (matchesT.length === 0) return null;
      const last = matchesT[matchesT.length - 1];
      const v = last.split(":").slice(1).join(":").trim();
      return parseMaybeNumber(v);
    }
    const last = matches[matches.length - 1];
    const v = last.split(":").slice(1).join(":").trim();
    return parseMaybeNumber(v);
  }

  async writeLogLine(file: TFile, dateIso: string, value: string) {
    let f = file;
    if (!f) throw new Error("file missing");
    const content = await this.app.vault.read(f);
    const logIdx = content.indexOf(this.settings.logHeading);
    const time = window.moment().format(this.settings.timeFormat);
    const line = `${dateIso}: ${value}`;
    const lineWithTime = `${dateIso}T${time}: ${value}`;
    let newContent: string;

    if (logIdx === -1) {
      newContent = `${content.trim()}\n\n${this.settings.logHeading}\n${line}\n`;
    } else {
      const head = content.slice(0, logIdx + this.settings.logHeading.length);
      const tail = content.slice(logIdx + this.settings.logHeading.length);
      const lines = tail.split(/\r?\n/);
      // ищем существующие за день
      const reDay = new RegExp(`^\\s*${escapeRegExp(dateIso)}(T\\d{2}:\\d{2})?:\\s*.*$`);
      const idxs = lines.map((l,i)=> reDay.test(l) ? i : -1).filter(i=>i>=0);

      if (this.settings.overwriteSameDay && idxs.length > 0) {
        // перезаписываем последнюю
        const i = idxs[idxs.length - 1];
        lines[i] = line; // фиксируем без времени, чтобы не рябило
        newContent = head + "\n" + lines.join("\n");
      } else {
        // добавляем новую запись с временем
        const appended = tail.endsWith("\n") ? tail + lineWithTime + "\n" : tail + "\n" + lineWithTime + "\n";
        newContent = head + appended;
      }
    }
    await this.app.vault.modify(f, newContent);
  }

  // Простейший «пикер» файла: предлагает последние открытые/подходящие
  async pickHabitFile(): Promise<TFile | null> {
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.settings.habitsFolder + "/"));
    if (files.length === 0) { new Notice("Нет заметок привычек"); return null; }
    if (files.length === 1) return files[0];

    return new Promise(resolve => {
      new FilePickerModal(this.app, files, resolve).open();
    });
  }

  async saveSettings() { await this.saveData(this.settings); }
}

// ---- UI: Settings -----------------------------------------------------------

class HabitSettingsTab extends PluginSettingTab {
  plugin: HabitNotesPlugin;
  constructor(app: App, plugin: HabitNotesPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Папка привычек")
      .addText(t => t.setPlaceholder("3. Metrics/Habits")
        .setValue(this.plugin.settings.habitsFolder)
        .onChange(async (v)=>{ this.plugin.settings.habitsFolder = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("Формат даты")
      .addText(t => t.setPlaceholder("YYYY-MM-DD")
        .setValue(this.plugin.settings.dateFormat)
        .onChange(async (v)=>{ this.plugin.settings.dateFormat = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("Формат времени")
      .addText(t => t.setPlaceholder("HH:mm")
        .setValue(this.plugin.settings.timeFormat)
        .onChange(async (v)=>{ this.plugin.settings.timeFormat = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("Заголовок журнала")
      .addText(t => t.setPlaceholder("## Log")
        .setValue(this.plugin.settings.logHeading)
        .onChange(async (v)=>{ this.plugin.settings.logHeading = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("Перезаписывать запись за день")
      .addToggle(t => t.setValue(this.plugin.settings.overwriteSameDay)
        .onChange(async (v)=>{ this.plugin.settings.overwriteSameDay = v; await this.plugin.saveSettings(); }));
  }
}

// ---- Helpers ----------------------------------------------------------------

function parseOptions(src: string): Record<string,string> {
  const o: Record<string,string> = {};
  src.split(/\r?\n/).forEach(l=>{
    const m = l.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+)\s*$/);
    if (m) o[m[1].trim()] = m[2].trim();
  });
  return o;
}

function resolveDateIso(input: string | undefined, fmt: string): string {
  const m = (window as any).moment;
  if (!input || input.toLowerCase() === "today") return m().format(fmt);
  const tryParse = m(input, ["YYYY-MM-DD","YYYY/MM/DD","DD.MM.YYYY"], true);
  return tryParse.isValid() ? tryParse.format(fmt) : m().format(fmt);
}

function parseMaybeNumber(v: string): string | number {
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// --- Simple modal to pick a file
class FilePickerModal extends Modal {
  files: TFile[];
  onPick: (f: TFile | null)=>void;
  constructor(app: App, files: TFile[], onPick:(f:TFile|null)=>void) {
    super(app); this.files = files; this.onPick = onPick;
  }
  onOpen() {
    const {contentEl} = this;
    contentEl.createEl("h3", {text: "Выберите заметку привычки"});
    this.files.slice(0,200).forEach(f=>{
      const btn = contentEl.createEl("button", {text: f.path});
      btn.onclick = ()=>{ this.close(); this.onPick(f); };
    });
  }
  onClose() { this.onPick(null); this.contentEl.empty(); }
}
