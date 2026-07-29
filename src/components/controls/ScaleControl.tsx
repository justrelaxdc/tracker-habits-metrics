import { useState, useCallback, useRef, useEffect, useMemo } from "preact/hooks";
import { useComputed } from "@preact/signals";
import { CSS_CLASSES, DEFAULTS } from "../../constants";
import type { ScaleControlProps } from "../types";
import type { TrackerEntries } from "../../domain/types";
import { logError } from "../../utils/notifications";
import { trackerStore } from "../../store";
import { setCssProps } from "../../utils/theme";

/**
 * Scale/Progress bar control with drag support
 * Accesses entries via computed signal internally for proper reactivity
 */
export function ScaleControl({ file, dateIso, plugin, fileOptions }: ScaleControlProps) {
  const minValue = parseFloat(fileOptions.minValue || String(DEFAULTS.MIN_VALUE)) || DEFAULTS.MIN_VALUE;
  const maxValue = parseFloat(fileOptions.maxValue || String(DEFAULTS.MAX_VALUE)) || DEFAULTS.MAX_VALUE;
  const step = parseFloat(fileOptions.step || String(DEFAULTS.STEP)) || DEFAULTS.STEP;

  // Access entries via computed signal - only re-renders when this tracker's entries change
  const entries = useComputed<TrackerEntries>((): TrackerEntries => {
    const state = trackerStore.getTrackerState(file.path);
    return (state?.entries ?? new Map()) as TrackerEntries;
  });

  // Get current value - use useMemo to track dateIso prop changes
  const currentValue = useMemo(() => {
    const value = entries.value.get(dateIso);
    if (value != null && !isNaN(Number(value))) {
      return Math.max(minValue, Math.min(maxValue, Number(value)));
    }
    return minValue;
  }, [entries.value, dateIso, minValue, maxValue]);

  const [value, setValue] = useState(currentValue);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  // Touch tracking for mobile
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isScrolling = useRef<boolean>(false);
  const isTouching = useRef<boolean>(false);

  // Update value when entries or dateIso change
  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  // Calculate value from position
  const calculateValue = useCallback((clientX: number): number => {
    if (!progressBarRef.current || typeof clientX !== "number" || isNaN(clientX)) return minValue;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return minValue;
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const rawValue = minValue + (maxValue - minValue) * percentage;
    const steppedValue = Math.round((rawValue - minValue) / step) * step + minValue;
    return Math.max(minValue, Math.min(maxValue, steppedValue));
  }, [minValue, maxValue, step]);

  // Write value to file
  const writeValue = useCallback(async (newValue: number) => {
    try {
      await plugin.writeLogLine(file, dateIso, String(newValue));
    } catch (err) {
      logError("ScaleControl: write error", err);
    }
  }, [plugin, file, dateIso]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || isTouching.current) return;
    setIsDragging(true);
    hasMoved.current = false;
    const newValue = calculateValue(e.clientX);
    setValue(newValue);
    e.preventDefault();
  }, [calculateValue]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    hasMoved.current = true;
    const newValue = calculateValue(e.clientX);
    setValue(newValue);
  }, [isDragging, calculateValue]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (hasMoved.current) {
        void writeValue(value);
      }
    }
  }, [isDragging, value, writeValue]);

  // Handle click (save immediately if no drag)
  const handleClick = useCallback((e: MouseEvent) => {
    if (isTouching.current) return;
    if (hasMoved.current) {
      hasMoved.current = false;
      return;
    }
    const newValue = calculateValue(e.clientX);
    setValue(newValue);
    void writeValue(newValue);
  }, [calculateValue, writeValue]);

  // Mobile Touch Handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isTouching.current = true;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isScrolling.current = false;
    hasMoved.current = false;
    // DO NOT change value on touchStart to prevent twitching when user scrolls
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch || startX.current === null || startY.current === null) return;

    if (isScrolling.current) return;
    
    const deltaX = Math.abs(touch.clientX - startX.current);
    const deltaY = Math.abs(touch.clientY - startY.current);

    // If vertical movement is greater than horizontal threshold, user is scrolling page
    if (deltaY > 8 && deltaY > deltaX) {
      isScrolling.current = true;
      setValue(currentValue); // Keep initial saved value unchanged while scrolling
      return;
    }

    // User is dragging horizontally across the progress bar
    if (deltaX > 8) {
      hasMoved.current = true;
      const newValue = calculateValue(touch.clientX);
      setValue(newValue);
    }
  }, [calculateValue, currentValue]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    
    if (isScrolling.current) {
      setValue(currentValue);
      isScrolling.current = false;
      window.setTimeout(() => { isTouching.current = false; }, 300);
      return;
    }

    if (!touch) {
      window.setTimeout(() => { isTouching.current = false; }, 300);
      return;
    }

    const finalValue = calculateValue(touch.clientX);
    setValue(finalValue);
    void writeValue(finalValue);

    window.setTimeout(() => { isTouching.current = false; }, 300);
  }, [currentValue, calculateValue, writeValue]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    let newValue = value;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      newValue = Math.max(minValue, value - step);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      newValue = Math.min(maxValue, value + step);
    } else if (e.key === "Home") {
      e.preventDefault();
      newValue = minValue;
    } else if (e.key === "End") {
      e.preventDefault();
      newValue = maxValue;
    } else {
      return;
    }
    setValue(newValue);
  }, [value, minValue, maxValue, step]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(e.key)) {
      void writeValue(value);
    }
  }, [value, writeValue]);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const percentage = ((value - minValue) / (maxValue - minValue)) * 100;

  // Set cursor style for progress bar
  useEffect(() => {
    if (progressBarRef.current) {
      setCssProps(progressBarRef.current, {
        cursor: isDragging ? "col-resize" : null,
      });
    }
  }, [isDragging]);

  return (
    <div class={CSS_CLASSES.PROGRESS_BAR_WRAPPER} data-internal-value={value}>
      <div
        ref={progressBarRef}
        class={CSS_CLASSES.PROGRESS_BAR_INPUT}
        tabIndex={0}
        role="button"
        aria-label={String(value)}
        aria-valuemin={minValue}
        aria-valuemax={maxValue}
        aria-valuenow={value}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <div
          class={CSS_CLASSES.PROGRESS_BAR_PROGRESS}
          style={{ width: `${percentage}%` }}
          role="slider"
          tabIndex={0}
          aria-valuemin={minValue}
          aria-valuemax={maxValue}
          aria-valuenow={value}
        />
        <span class={CSS_CLASSES.PROGRESS_BAR_VALUE}>{value}</span>
        <span class={CSS_CLASSES.PROGRESS_BAR_LABEL_LEFT}>{minValue}</span>
        <span class={CSS_CLASSES.PROGRESS_BAR_LABEL_RIGHT}>{maxValue}</span>
      </div>
    </div>
  );
}


