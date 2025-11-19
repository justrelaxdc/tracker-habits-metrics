import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";
import type TrackerPlugin from "../core/tracker-plugin";

export class TrackerSettingsTab extends PluginSettingTab {
  private readonly plugin: TrackerPlugin;

  constructor(app: App, plugin: TrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Папка трекеров по умолчанию")
      .setDesc("Можно переопределить параметром folder: `path`")
      .addText((t) =>
        t
          .setPlaceholder("0. Files/Trackers")
          .setValue(this.plugin.settings.trackersFolder)
          .onChange(async (v) => {
            this.plugin.settings.trackersFolder = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Показывать график по умолчанию")
      .setDesc("Можно переопределить параметром showChart: `true/false`")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showChartByDefault)
          .onChange(async (v) => {
            this.plugin.settings.showChartByDefault = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Показывать статистику по умолчанию")
      .setDesc("Можно переопределить параметром showStats: `true/false`")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showStatsByDefault)
          .onChange(async (v) => {
            this.plugin.settings.showStatsByDefault = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Скрывать график на смартфоне")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.hideChartOnMobile)
          .onChange(async (v) => {
            this.plugin.settings.hideChartOnMobile = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Скрывать статистику на смартфоне")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.hideStatsOnMobile)
          .onChange(async (v) => {
            this.plugin.settings.hideStatsOnMobile = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Количество дней")
      .setDesc("Количество прошедших дней, которое отображается для графиков и привычек")
      .addText((t) =>
        t
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.daysToShow))
          .onChange(async (v) => {
            const num = parseInt(v.trim());
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.daysToShow = num;
              await this.plugin.saveSettings();
            }
          }),
      );
  }
}

