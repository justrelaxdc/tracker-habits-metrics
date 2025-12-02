import { useRef, useEffect, useMemo, useCallback } from "preact/hooks";
import { Chart, registerables } from "chart.js";
import { CSS_CLASSES, CHART_CONFIG, TrackerType } from "../../constants";
import { ChartService } from "../../services/chart-service";
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
  const chartService = useMemo(() => new ChartService(), []);

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
  } | null>(null);

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
      // Update existing chart data instead of recreating
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

      // Update chart data and options
      chartRef.current.data = config.data;
      if (config.options) {
        Object.assign(chartRef.current.options, config.options);
      }
      chartRef.current.dateStrings = chartData.dateStrings;
      chartRef.current.update('none'); // 'none' mode for faster updates
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

      // Destroy existing chart if any
      if (chartRef.current) {
        chartRef.current.destroy();
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

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
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
    chartService,
    handleChartClick,
  ]);

  return (
    <div class={CSS_CLASSES.CHART} style={{ height: `${CHART_CONFIG.DEFAULT_HEIGHT}px` }}>
      <canvas ref={canvasRef} height={CHART_CONFIG.CANVAS_HEIGHT} />
    </div>
  );
}

