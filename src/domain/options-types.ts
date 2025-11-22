import type { TrackerTypeValue, ViewModeValue } from "../constants";

/**
 * Options for tracker code block
 * 
 * @see BLOCK_PARAMETERS in constants/block-parameters.ts for complete parameter documentation
 * 
 * Note: For habit block, only the following parameters are used:
 * - folder (optional, default from settings)
 * - date
 * - days
 * - showChart
 * - showStats
 * 
 * Parameters not used for habit block: view, mode, file, minValue, maxValue, step, minLimit, maxLimit, unit
 */
export interface TrackerBlockOptions {
  /** Path to tracker file (for tracker block only) */
  file?: string;
  
  /** Path to folder with trackers (for habit block, optional, default from settings) */
  folder?: string;
  
  /** Display mode: control (default) or display (view only) (for tracker block only) */
  view?: ViewModeValue;
  
  /** Tracker type (ignored - type is determined from file frontmatter) */
  mode?: TrackerTypeValue;
  
  /** Date to display (default: "today" or parsed from note filename) */
  date?: string;
  
  /** Number of days to show in charts/heatmaps (default from settings) */
  days?: string;
  
  /** Minimum value (for scale type, overrides frontmatter) (for tracker block only) */
  minValue?: string;
  
  /** Maximum value (for scale type, overrides frontmatter) (for tracker block only) */
  maxValue?: string;
  
  /** Step value (for scale type, overrides frontmatter) (for tracker block only) */
  step?: string;
  
  /** Show chart visualization (default from settings) */
  showChart?: string;
  
  /** Show statistics (default from settings) */
  showStats?: string;
  
  /** Minimum limit for success (not used from block, only from frontmatter) */
  minLimit?: string;
  
  /** Maximum limit for success (not used from block, only from frontmatter) */
  maxLimit?: string;
  
  /** Unit of measurement (not used from block, only from frontmatter) */
  unit?: string;
}

/**
 * Parsed and validated tracker options
 */
export interface ParsedTrackerOptions {
  view: ViewModeValue;
  dateIso: string;
  daysToShow: number;
  shouldShowChart: boolean;
  shouldShowStats: boolean;
}

