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
      .setName("Default trackers folder")
      .setDesc("Can be overridden with folder: `path` parameter")
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
      .setName("Show chart by default")
      .setDesc("Can be overridden with showChart: `true/false` parameter")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showChartByDefault)
          .onChange(async (v) => {
            this.plugin.settings.showChartByDefault = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show statistics by default")
      .setDesc("Can be overridden with showStats: `true/false` parameter")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.showStatsByDefault)
          .onChange(async (v) => {
            this.plugin.settings.showStatsByDefault = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Hide chart on mobile")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.hideChartOnMobile)
          .onChange(async (v) => {
            this.plugin.settings.hideChartOnMobile = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Hide statistics on mobile")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.hideStatsOnMobile)
          .onChange(async (v) => {
            this.plugin.settings.hideStatsOnMobile = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Disable color reaction to range compliance")
      .setDesc("Disables color feedback when metric values are within or outside the defined limit range")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.disableLimitReaction)
          .onChange(async (v) => {
            this.plugin.settings.disableLimitReaction = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Number of days")
      .setDesc("Number of past days displayed for charts and habits")
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

