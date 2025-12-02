import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { CSS_CLASSES, ANIMATION_DURATION_MS, DEFAULTS } from "../../constants";
import type { PlusMinusControlProps } from "../types";

/**
 * Plus/Minus counter control
 * Note: No onValueChange callback needed - writeLogLine already updates the store
 */
export function PlusMinusControl({ file, dateIso, plugin, fileOptions, entries }: PlusMinusControlProps) {
  const step = parseFloat(fileOptions.step || String(DEFAULTS.STEP)) || DEFAULTS.STEP;
  
  const currentValue = entries.get(dateIso);
  const initialValue = currentValue != null && !isNaN(Number(currentValue)) ? Number(currentValue) : 0;
  
  const [value, setValue] = useState(initialValue);
  const [isUpdated, setIsUpdated] = useState(false);
  const valueRef = useRef<HTMLSpanElement>(null);

  // Update value when entries change externally
  useEffect(() => {
    const newValue = entries.get(dateIso);
    const newNumValue = newValue != null && !isNaN(Number(newValue)) ? Number(newValue) : 0;
    setValue(newNumValue);
  }, [entries, dateIso]);

  // Write value to file
  const writeValue = useCallback(async (newValue: number) => {
    try {
      await plugin.writeLogLine(file, dateIso, String(newValue));
    } catch (err) {
      console.error("PlusMinusControl: write error", err);
    }
  }, [plugin, file, dateIso]);

  // Handle minus click
  const handleMinus = useCallback(async () => {
    const newValue = (Number.isFinite(value) ? value : 0) - step;
    setValue(newValue);
    setIsUpdated(true);
    await writeValue(newValue);
    setTimeout(() => setIsUpdated(false), ANIMATION_DURATION_MS);
  }, [value, step, writeValue]);

  // Handle plus click
  const handlePlus = useCallback(async () => {
    const newValue = (Number.isFinite(value) ? value : 0) + step;
    setValue(newValue);
    setIsUpdated(true);
    await writeValue(newValue);
    setTimeout(() => setIsUpdated(false), ANIMATION_DURATION_MS);
  }, [value, step, writeValue]);

  return (
    <div class={CSS_CLASSES.ROW}>
      <button type="button" onClick={handleMinus}>−</button>
      <span 
        ref={valueRef}
        class={`${CSS_CLASSES.VALUE}${isUpdated ? ` ${CSS_CLASSES.VALUE_UPDATED}` : ""}`}
      >
        {value}
      </span>
      <button type="button" onClick={handlePlus}>+</button>
    </div>
  );
}

