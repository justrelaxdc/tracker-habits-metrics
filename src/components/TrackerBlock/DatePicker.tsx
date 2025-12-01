import { useCallback } from "preact/hooks";
import { CSS_CLASSES, MODAL_LABELS } from "../../constants";
import type { DatePickerProps } from "../types";

/**
 * Date picker component with navigation buttons
 */
export function DatePicker({ dateIso, onDateChange, onNavigate, isUpdating }: DatePickerProps) {
  const handleInputChange = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement;
    onDateChange(target.value);
  }, [onDateChange]);

  const handlePrevDay = useCallback(() => {
    onNavigate(-1);
  }, [onNavigate]);

  const handleNextDay = useCallback(() => {
    onNavigate(1);
  }, [onNavigate]);

  return (
    <div class={CSS_CLASSES.DATE_PICKER_CONTAINER}>
      <div class={CSS_CLASSES.DATE_PICKER}>
        <button
          type="button"
          class={`${CSS_CLASSES.DATE_NAV_BTN} ${CSS_CLASSES.DATE_NAV_BTN_LEFT}`}
          onClick={handlePrevDay}
          disabled={isUpdating}
          title={MODAL_LABELS.YESTERDAY}
        >
          ◀
        </button>
        <input
          type="date"
          class={`${CSS_CLASSES.DATE_INPUT}${isUpdating ? ` ${CSS_CLASSES.DATE_INPUT_UPDATING}` : ""}`}
          value={dateIso}
          onChange={handleInputChange}
          disabled={isUpdating}
        />
        <button
          type="button"
          class={`${CSS_CLASSES.DATE_NAV_BTN} ${CSS_CLASSES.DATE_NAV_BTN_RIGHT}`}
          onClick={handleNextDay}
          disabled={isUpdating}
          title={MODAL_LABELS.TOMORROW}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

