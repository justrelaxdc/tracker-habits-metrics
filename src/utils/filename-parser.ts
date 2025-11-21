/**
 * Utility for parsing and formatting filenames with numeric prefixes
 * Supports formats: "01-Name", "01. Name", "01 Name"
 */

export interface ParsedFilename {
  prefix: number | null;
  name: string;
  original: string;
}

/**
 * Parses a filename to extract prefix and name
 * Supports formats: "01-Name", "01. Name", "01 Name"
 */
export function parseFilename(basename: string): ParsedFilename {
  // Pattern: "01-Name", "01. Name", or "01 Name"
  const match = basename.match(/^(\d+)[-.\s]+(.+)$/);
  
  if (match) {
    return {
      prefix: parseInt(match[1], 10),
      name: match[2],
      original: basename
    };
  }
  
  return {
    prefix: null,
    name: basename,
    original: basename
  };
}

/**
 * Removes prefix from filename for display purposes
 * Returns only the name part if prefix exists, otherwise returns original
 */
export function removePrefix(basename: string): string {
  const parsed = parseFilename(basename);
  return parsed.name;
}

/**
 * Formats a filename with a prefix
 * Format: "01-Name" (with separator "-")
 * Automatically determines prefix width (01, 001, 0001)
 */
export function formatFilename(name: string, prefix?: number): string {
  if (prefix === undefined || prefix === null) {
    return name;
  }
  
  // Determine prefix width based on prefix value
  const prefixWidth = prefix >= 100 ? 3 : prefix >= 10 ? 2 : 2;
  const prefixStr = String(prefix).padStart(prefixWidth, '0');
  
  return `${prefixStr}-${name}`;
}

