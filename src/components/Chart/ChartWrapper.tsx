import { useRef, useEffect, useCallback, useMemo } from "preact/hooks";
import { Chart, registerables } from "chart.js";
import { CSS_CLASSES, CHART_CONFIG, TrackerType } from "../../constants";
import { chartService } from "../../services/chart-service";
import { DateService } from "../../services/date-service";
import { getThemeColors } from "../../utils/theme";
import type { ChartWrapperProps } from "../types";
import type { TrackerChartInstance } from "../../domain/chart-types";

// Register Chart.js components
Chart.register(...registerables);

/**
 * Chart wrapper component for Chart.js integration
 */
export function ChartWrapper({
  file,
  plugin,
  dateIso,
  daysToShow,
  entries,
  fileOptions,
  onDateClick,
}: ChartWrapperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<TrackerChartInstance | null>(null);

  // Get tracker type and options
  const trackerType = (fileOptions?.mode ?? TrackerType.GOOD_HABIT).toLowerCase();
  const unit = fileOptions?.unit || "";
  const minLimit = fileOptions?.minLimit ? parseFloat(fileOptions.minLimit) : null;
  const maxLimit = fileOptions?.maxLimit ? parseFloat(fileOptions.maxLimit) : null;
  const scaleMinValue = fileOptions?.minValue ? parseFloat(fileOptions.minValue) : null;
  const scaleMaxValue = fileOptions?.maxValue ? parseFloat(fileOptions.maxValue) : null;

  // Get start tracking date
  const startTrackingDateStr = useMemo(() => {
    return plugin.getStartTrackingDate(entries, fileOptions);
  }, [plugin, entries, fileOptions]);

  // Handle chart click
  const handleChartClick = useCallback((dateStr: string) => {
    if (onDateClick) {
      onDateClick(dateStr);
    }
  }, [onDateClick]);

  // Track previous values to determine if we can update vs recreate
  const prevConfigRef = useRef<{
    trackerType: string;
    unit: string;
    minLimit: number | null;
    maxLimit: number | null;
    scaleMinValue: number | null;
    scaleMaxValue: number | null;
    dateIso: string;
    daysToShow: number;
  } | null>(null);

  // Cleanup chart on unmount only - separate from create/update
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  // Create/update chart
  useEffect(() => {
    if (!canvasRef.current) return;

    const colors = getThemeColors();
    const todayStr = DateService.format(DateService.now(), plugin.settings.dateFormat);

    // Prepare chart data
    const chartData = chartService.prepareChartData(
      entries,
      file,
      plugin.settings,
      {
        dateIso,
        daysToShow,
        metricType: trackerType,
        unit,
        minLimit,
        maxLimit,
        scaleMinValue,
        scaleMaxValue,
      },
      startTrackingDateStr,
      todayStr
    );

    const currentConfig = {
      trackerType,
      unit,
      minLimit,
      maxLimit,
      scaleMinValue,
      scaleMaxValue,
      dateIso,
      daysToShow,
    };

    // Check if we can update existing chart or need to recreate
    const canUpdate = chartRef.current && prevConfigRef.current &&
      prevConfigRef.current.trackerType === currentConfig.trackerType &&
      prevConfigRef.current.unit === currentConfig.unit &&
      prevConfigRef.current.minLimit === currentConfig.minLimit &&
      prevConfigRef.current.maxLimit === currentConfig.maxLimit &&
      prevConfigRef.current.scaleMinValue === currentConfig.scaleMinValue &&
      prevConfigRef.current.scaleMaxValue === currentConfig.scaleMaxValue;

    if (canUpdate && chartRef.current) {
      // Only data changed (entries, dateIso, or daysToShow) - update data directly
      // This is much faster than recreating the entire chart config
      const dataset = chartRef.current.data.datasets[0];
      if (dataset) {
        dataset.data = chartData.values;
        dataset.pointBackgroundColor = chartData.pointBackgroundColors;
        dataset.pointBorderColor = chartData.pointBorderColors;
        dataset.pointRadius = chartData.pointRadii;
        dataset.pointBorderWidth = chartData.pointBorderWidths;
      }
      chartRef.current.data.labels = chartData.labels;
      chartRef.current.dateStrings = chartData.dateStrings;
      
      // Update chart with minimal animation
      chartRef.current.update('none');
    } else {
      // Create chart config
      const config = chartService.createChartConfig(
        chartData,
        colors,
        {
          dateIso,
          daysToShow,
          metricType: trackerType,
          unit,
          minLimit,
          maxLimit,
          scaleMinValue,
          scaleMaxValue,
        },
        handleChartClick
      );

      // Destroy existing chart if config changed (recreate needed)
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      // Create new chart
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        chartRef.current = new Chart(ctx, config) as TrackerChartInstance;
        // Store date strings for click handling
        chartRef.current.dateStrings = chartData.dateStrings;
      }

      // Store current config for next update comparison
      prevConfigRef.current = currentConfig;
    }
  }, [
    file,
    plugin,
    dateIso,
    daysToShow,
    entries,
    trackerType,
    unit,
    minLimit,
    maxLimit,
    scaleMinValue,
    scaleMaxValue,
    startTrackingDateStr,
    handleChartClick,
  ]);

  return (
    <div class={CSS_CLASSES.CHART} style={{ height: `${CHART_CONFIG.DEFAULT_HEIGHT}px` }}>
      <canvas ref={canvasRef} height={CHART_CONFIG.CANVAS_HEIGHT} />
    </div>
  );
}

