import type { App } from "obsidian";
import { Modal, Notice, Setting } from "obsidian";
import type TrackerPlugin from "../../core/tracker-plugin";
import { DEFAULT_SETTINGS } from "../../domain/types";
import { FolderSuggest } from "../suggest/folder-suggest";

export class CreateTrackerModal extends Modal {
  private readonly plugin: TrackerPlugin;

  constructor(app: App, plugin: TrackerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Создать новый трекер" });

    const nameSetting = new Setting(contentEl).setName("Название").addText((text) => {
      text.setPlaceholder("Например: Утренняя зарядка");
      text.inputEl.style.width = "100%";
    });

    const folders = this.app.vault.getAllFolders();

    const folderSetting = new Setting(contentEl)
      .setName("Путь")
      .addText((text) => {
        const defaultPath = this.plugin.settings.trackersFolder || DEFAULT_SETTINGS.trackersFolder;
        text.setPlaceholder(defaultPath);
        text.setValue("");
        text.inputEl.style.width = "100%";
        new FolderSuggest(this.app, text.inputEl, folders);
      });

    const typeSetting = new Setting(contentEl)
      .setName("Тип")
      .addDropdown((dropdown) => {
        dropdown.addOption("good-habit", "Хорошая привычка");
        dropdown.addOption("bad-habit", "Плохая привычка");
        dropdown.addOption("number", "Число");
        dropdown.addOption("scale", "Шкала");
        dropdown.addOption("plusminus", "Счётчик (+/-)");
        dropdown.addOption("text", "Текст");
        dropdown.setValue("good-habit");
      });

    const typeDropdown = typeSetting.controlEl.querySelector("select") as HTMLSelectElement;
    if (typeDropdown) {
      typeDropdown.innerHTML = "";

      const habitsGroup = document.createElement("optgroup");
      habitsGroup.label = "Привычки";
      const goodHabitOption = document.createElement("option");
      goodHabitOption.value = "good-habit";
      goodHabitOption.textContent = "Хорошая привычка";
      habitsGroup.appendChild(goodHabitOption);
      const badHabitOption = document.createElement("option");
      badHabitOption.value = "bad-habit";
      badHabitOption.textContent = "Плохая привычка";
      habitsGroup.appendChild(badHabitOption);
      typeDropdown.appendChild(habitsGroup);

      const metricsGroup = document.createElement("optgroup");
      metricsGroup.label = "Метрики";
      const numberOption = document.createElement("option");
      numberOption.value = "number";
      numberOption.textContent = "Число";
      metricsGroup.appendChild(numberOption);
      const scaleOption = document.createElement("option");
      scaleOption.value = "scale";
      scaleOption.textContent = "Шкала";
      metricsGroup.appendChild(scaleOption);
      const plusminusOption = document.createElement("option");
      plusminusOption.value = "plusminus";
      plusminusOption.textContent = "Счётчик (+/-)";
      metricsGroup.appendChild(plusminusOption);
      const textOption = document.createElement("option");
      textOption.value = "text";
      textOption.textContent = "Текст";
      metricsGroup.appendChild(textOption);
      typeDropdown.appendChild(metricsGroup);

      typeDropdown.value = "good-habit";
    }

    const parametersHeader = contentEl.createEl("h3", { text: "Параметры" });
    const parametersDescription = contentEl.createEl("p", {
      text: "Единица измерения - не обязательное поле. Можно оставить пустым.",
      cls: "tracker-notes__limits-description",
    });
    parametersDescription.style.fontSize = "0.9em";
    parametersDescription.style.color = "var(--text-muted, #999999)";
    parametersDescription.style.marginTop = "0.5em";
    parametersDescription.style.marginBottom = "1em";

    const unitSetting = new Setting(contentEl)
      .setName("Единица измерения")
      .addText((text) => {
        text.setPlaceholder("Например: метры, минуты, кг");
        text.inputEl.style.width = "100%";
      });
    const unitInput = unitSetting.controlEl.querySelector("input") as HTMLInputElement;

    const plusminusStepSetting = new Setting(contentEl)
      .setName("Шаг")
      .addText((text) => {
        text
          .setPlaceholder("1")
          .setValue("1")
          .inputEl.type = "number";
        text.inputEl.step = "any";
        text.inputEl.style.width = "100%";
      });

    const minValueSetting = new Setting(contentEl)
      .setName("Значение \"от\"")
      .addText((text) => {
        text
          .setPlaceholder("0")
          .setValue("0")
          .inputEl.type = "number";
        text.inputEl.style.width = "100%";
      });

    const maxValueSetting = new Setting(contentEl)
      .setName("Значение \"до\"")
      .addText((text) => {
        text
          .setPlaceholder("10")
          .setValue("10")
          .inputEl.type = "number";
        text.inputEl.style.width = "100%";
      });

    const stepSetting = new Setting(contentEl)
      .setName("Шаг")
      .addText((text) => {
        text
          .setPlaceholder("1")
          .setValue("1")
          .inputEl.type = "number";
        text.inputEl.step = "any";
        text.inputEl.style.width = "100%";
      });

    parametersHeader.style.display = "none";
    parametersDescription.style.display = "none";
    unitSetting.settingEl.style.display = "none";
    plusminusStepSetting.settingEl.style.display = "none";
    minValueSetting.settingEl.style.display = "none";
    maxValueSetting.settingEl.style.display = "none";
    stepSetting.settingEl.style.display = "none";

    const limitsHeader = contentEl.createEl("h3", { text: "Лимиты успешности" });
    const limitsDescription = contentEl.createEl("p", {
      text: 'Опционально вы можете сделать метрику лимитирующей и задать желаемые пороговые значения. Прим. "Не меньше 5000 шагов в день", "Не больше 3х шоколадок"',
      cls: "tracker-notes__limits-description",
    });
    limitsDescription.style.fontSize = "0.9em";
    limitsDescription.style.color = "var(--text-muted, #999999)";
    limitsDescription.style.marginTop = "0.5em";
    limitsDescription.style.marginBottom = "1em";

    const minLimitSetting = new Setting(contentEl)
      .setName("Нижняя граница")
      .addText((text) => {
        text
          .setPlaceholder("По умолчанию - нет")
          .setValue("")
          .inputEl.type = "number";
        text.inputEl.style.width = "100%";
      });

    const maxLimitSetting = new Setting(contentEl)
      .setName("Верхняя граница")
      .addText((text) => {
        text
          .setPlaceholder("По умолчанию - нет")
          .setValue("")
          .inputEl.type = "number";
        text.inputEl.style.width = "100%";
      });

    limitsHeader.style.display = "none";
    limitsDescription.style.display = "none";
    minLimitSetting.settingEl.style.display = "none";
    maxLimitSetting.settingEl.style.display = "none";

    const typeDropdownSelect = typeSetting.controlEl.querySelector("select") as HTMLSelectElement;
    if (typeDropdownSelect) {
      typeDropdownSelect.onchange = () => {
        const isScale = typeDropdownSelect.value === "scale";
        const isMetric = ["number", "plusminus", "rating", "text", "scale"].includes(
          typeDropdownSelect.value,
        );
        const isPlusminus = typeDropdownSelect.value === "plusminus";
        const isText = typeDropdownSelect.value === "text";

        if (isMetric) {
          parametersHeader.style.display = "";
          parametersDescription.style.display = "";
          unitSetting.settingEl.style.display = "";
          if (isText) {
            if (unitInput) {
              unitInput.value = "слов";
              unitInput.disabled = true;
            }
          } else if (unitInput) {
            unitInput.disabled = false;
          }

          if (isScale) {
            minValueSetting.settingEl.style.display = "";
            maxValueSetting.settingEl.style.display = "";
            stepSetting.settingEl.style.display = "";
            plusminusStepSetting.settingEl.style.display = "none";
          } else {
            minValueSetting.settingEl.style.display = "none";
            maxValueSetting.settingEl.style.display = "none";
            stepSetting.settingEl.style.display = "none";
            plusminusStepSetting.settingEl.style.display = isPlusminus ? "" : "none";
          }
        } else {
          parametersHeader.style.display = "none";
          parametersDescription.style.display = "none";
          unitSetting.settingEl.style.display = "none";
          plusminusStepSetting.settingEl.style.display = "none";
          minValueSetting.settingEl.style.display = "none";
          maxValueSetting.settingEl.style.display = "none";
          stepSetting.settingEl.style.display = "none";
        }

        if (isMetric) {
          limitsHeader.style.display = "";
          limitsDescription.style.display = "";
          minLimitSetting.settingEl.style.display = "";
          maxLimitSetting.settingEl.style.display = "";
        } else {
          limitsHeader.style.display = "none";
          limitsDescription.style.display = "none";
          minLimitSetting.settingEl.style.display = "none";
          maxLimitSetting.settingEl.style.display = "none";
        }
      };
    }

    new Setting(contentEl).addButton((button) => {
      button.setButtonText("Создать").setCta().onClick(async () => {
        const nameInput = nameSetting.controlEl.querySelector("input") as HTMLInputElement;
        const name = nameInput.value.trim();
        if (!name) {
          new Notice("Введите название");
          return;
        }

        const typeDropdownSelect = typeSetting.controlEl.querySelector("select") as HTMLSelectElement;
        const type = typeDropdownSelect ? typeDropdownSelect.value : "good-habit";
        const minValue =
          type === "scale"
            ? (minValueSetting.controlEl.querySelector("input") as HTMLInputElement)?.value || "0"
            : "0";
        const maxValue =
          type === "scale"
            ? (maxValueSetting.controlEl.querySelector("input") as HTMLInputElement)?.value || "10"
            : "10";
        const step =
          type === "scale"
            ? (stepSetting.controlEl.querySelector("input") as HTMLInputElement)?.value || "1"
            : type === "plusminus"
            ? (plusminusStepSetting.controlEl.querySelector("input") as HTMLInputElement)?.value || "1"
            : "1";

        const minLimitInput = minLimitSetting.controlEl.querySelector("input") as HTMLInputElement;
        const maxLimitInput = maxLimitSetting.controlEl.querySelector("input") as HTMLInputElement;
        const minLimit = minLimitInput?.value.trim() || "";
        const maxLimit = maxLimitInput?.value.trim() || "";

        const unitInputValue = unitSetting.controlEl.querySelector("input") as HTMLInputElement;
        const unitRaw = unitInputValue?.value.trim() || "";
        const unit = type === "text" ? "слов" : unitRaw;
        const isMetric = ["number", "plusminus", "rating", "text", "scale"].includes(type);

        const fileName = name.replace(/[<>:"/\\|?*]/g, "_") + ".md";
        const folderInput = folderSetting.controlEl.querySelector("input") as HTMLInputElement;
        let inputFolder = folderInput?.value.trim() || "";
        if (inputFolder === "/ (корневая папка)") {
          inputFolder = "";
        }
        const targetFolder = inputFolder || this.plugin.settings.trackersFolder;
        const filePath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

        try {
          const file = await this.plugin.ensureFileWithHeading(filePath, type);

          const content = await this.app.vault.read(file);
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

          const escapedName = name.replace(/"/g, '\\"');
          let newFrontmatter = `name: "${escapedName}"\ntype: "${type}"\n`;
          if (type === "scale") {
            newFrontmatter += `minValue: ${parseFloat(minValue) || 0}\n`;
            newFrontmatter += `maxValue: ${parseFloat(maxValue) || 10}\n`;
            newFrontmatter += `step: ${parseFloat(step) || 1}\n`;
          } else if (type === "plusminus") {
            newFrontmatter += `step: ${parseFloat(step) || 1}\n`;
          }
          if (minLimit) {
            newFrontmatter += `minLimit: ${parseFloat(minLimit)}\n`;
          }
          if (maxLimit) {
            newFrontmatter += `maxLimit: ${parseFloat(maxLimit)}\n`;
          }
          if (unit && isMetric) {
            const escapedUnit = unit.replace(/"/g, '\\"');
            newFrontmatter += `unit: "${escapedUnit}"\n`;
          }
          newFrontmatter += `data: {}\n`;

          const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length).trim() : content.trim();
          const newContent = `---\n${newFrontmatter}---${body ? `\n\n${body}` : ""}`;

          await this.app.vault.modify(file, newContent);

          new Notice(`Создан трекер: ${name}`);

          const fileFolderPath = this.plugin.getFolderPathFromFile(file.path);
          await this.plugin.onTrackerCreated(fileFolderPath);

          this.close();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          new Notice(`Ошибка при создании трекера: ${errorMsg}`);
          console.error("Tracker: ошибка создания трекера", error);
        }
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

