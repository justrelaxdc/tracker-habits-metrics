import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { CSS_CLASSES, ANIMATION_DURATION_MS, PLACEHOLDERS, MODAL_LABELS } from "../../constants";
import type { TextControlProps } from "../types";

/**
 * Text input control with save button
 * Note: No onValueChange callback needed - writeLogLine already updates the store
 */
export function TextControl({ file, dateIso, plugin, entries }: TextControlProps) {
  const currentValue = entries.get(dateIso);
  const initialValue = currentValue != null && typeof currentValue === "string" ? currentValue : "";
  
  const [inputValue, setInputValue] = useState(initialValue);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update input when entries change externally
  useEffect(() => {
    const newValue = entries.get(dateIso);
    const newInputValue = newValue != null && typeof newValue === "string" ? newValue : "";
    setInputValue(newInputValue);
  }, [entries, dateIso]);

  // Handle input change
  const handleChange = useCallback((e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setInputValue(target.value);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      const val = inputValue.trim();
      await plugin.writeLogLine(file, dateIso, val);

      // Visual feedback
      if (buttonRef.current) {
        buttonRef.current.style.transform = "scale(0.95)";
        setTimeout(() => {
          if (buttonRef.current) {
            buttonRef.current.style.transform = "";
          }
        }, ANIMATION_DURATION_MS);
      }
    } catch (err) {
      console.error("TextControl: write error", err);
    }
  }, [plugin, file, dateIso, inputValue]);

  return (
    <div class={CSS_CLASSES.ROW}>
      <textarea
        class={CSS_CLASSES.TEXT_INPUT}
        placeholder={PLACEHOLDERS.TEXT_INPUT}
        value={inputValue}
        onInput={handleChange}
      />
      <button ref={buttonRef} type="button" onClick={handleSave}>
        {MODAL_LABELS.SAVE}
      </button>
    </div>
  );
}

