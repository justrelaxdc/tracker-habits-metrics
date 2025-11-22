/**
 * Complete documentation for all block parameters
 * This is the single source of truth for parameter documentation
 */

export interface ParameterDocumentation {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default: string | null;
  applicableTo?: string; // For which tracker type this parameter applies (e.g., 'scale')
  allowedValues?: string[]; // For parameters with limited allowed values
  example: string;
  block: 'tracker' | 'habit' | 'both'; // Which block(s) this parameter applies to
}

export interface BlockParametersDocumentation {
  [key: string]: ParameterDocumentation;
}

/**
 * Documentation for habit block parameters
 */
export const HABIT_BLOCK_PARAMETERS: BlockParametersDocumentation = {
  folder: {
    name: 'folder',
    description: 'Path to folder with trackers (default from settings)',
    type: 'string',
    required: false,
    default: 'from settings',
    example: '0. Files/Trackers/01-Habits',
    block: 'habit',
  },
  date: {
    name: 'date',
    description: 'Date to display (default: "today" or parsed from note filename)',
    type: 'string',
    required: false,
    default: 'today',
    example: '2025-01-15',
    block: 'habit',
  },
  days: {
    name: 'days',
    description: 'Number of days to display in chart and statistics (default from settings)',
    type: 'number',
    required: false,
    default: 'from settings',
    example: '30',
    block: 'habit',
  },
  showChart: {
    name: 'showChart',
    description: 'Show chart for all trackers (default from settings)',
    type: 'boolean',
    required: false,
    default: 'from settings',
    example: 'true',
    block: 'habit',
  },
  showStats: {
    name: 'showStats',
    description: 'Show statistics for all trackers (default from settings)',
    type: 'boolean',
    required: false,
    default: 'from settings',
    example: 'true',
    block: 'habit',
  },
};

/**
 * Documentation for tracker block parameters
 */
export const TRACKER_BLOCK_PARAMETERS: BlockParametersDocumentation = {
  file: {
    name: 'file',
    description: 'Path to tracker file',
    type: 'string',
    required: true,
    default: null,
    example: '0. Files/Trackers/01-Habits/Morning workout.md',
    block: 'tracker',
  },
  mode: {
    name: 'mode',
    description: 'Display type (ignored - type is determined from file frontmatter)',
    type: 'string',
    required: false,
    default: null,
    allowedValues: ['good-habit', 'bad-habit', 'number', 'plusminus', 'text', 'scale'],
    example: 'good-habit',
    block: 'tracker',
  },
  date: {
    name: 'date',
    description: 'Date to display (default: "today" or parsed from note filename)',
    type: 'string',
    required: false,
    default: 'today',
    example: '2025-01-15',
    block: 'tracker',
  },
  view: {
    name: 'view',
    description: 'View mode: control (default) or display (view only)',
    type: 'string',
    required: false,
    default: 'control',
    allowedValues: ['control', 'display'],
    example: 'control',
    block: 'tracker',
  },
  days: {
    name: 'days',
    description: 'Number of days to display in chart and statistics (default from settings)',
    type: 'number',
    required: false,
    default: 'from settings',
    example: '30',
    block: 'tracker',
  },
  showChart: {
    name: 'showChart',
    description: 'Show chart (default from settings)',
    type: 'boolean',
    required: false,
    default: 'from settings',
    example: 'true',
    block: 'tracker',
  },
  showStats: {
    name: 'showStats',
    description: 'Show statistics (default from settings)',
    type: 'boolean',
    required: false,
    default: 'from settings',
    example: 'true',
    block: 'tracker',
  },
  minValue: {
    name: 'minValue',
    description: 'Minimum value (for scale type, overrides frontmatter)',
    type: 'number',
    required: false,
    default: null,
    applicableTo: 'scale',
    example: '0',
    block: 'tracker',
  },
  maxValue: {
    name: 'maxValue',
    description: 'Maximum value (for scale type, overrides frontmatter)',
    type: 'number',
    required: false,
    default: null,
    applicableTo: 'scale',
    example: '10',
    block: 'tracker',
  },
  step: {
    name: 'step',
    description: 'Step value (for scale type, overrides frontmatter)',
    type: 'number',
    required: false,
    default: null,
    applicableTo: 'scale',
    example: '1',
    block: 'tracker',
  },
};

/**
 * Combined documentation for all block parameters
 */
export const BLOCK_PARAMETERS = {
  habit: HABIT_BLOCK_PARAMETERS,
  tracker: TRACKER_BLOCK_PARAMETERS,
} as const;

