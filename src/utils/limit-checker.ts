/**
 * Result of limit checking
 */
export interface LimitCheckResult {
  isInRange: boolean;
  isBelowMin: boolean;
  isAboveMax: boolean;
  status: 'success' | 'error';
}

/**
 * Checks if a value is within the specified limits
 * 
 * @param value - The value to check
 * @param minLimit - Minimum limit (null if not set)
 * @param maxLimit - Maximum limit (null if not set)
 * @returns LimitCheckResult with status information
 */
export function checkLimits(
  value: number,
  minLimit: number | null,
  maxLimit: number | null
): LimitCheckResult {
  // If no limits are set, always return success
  if (minLimit === null && maxLimit === null) {
    return { isInRange: true, isBelowMin: false, isAboveMax: false, status: 'success' };
  }
  
  const isBelowMin = minLimit !== null && value < minLimit;
  const isAboveMax = maxLimit !== null && value > maxLimit;
  const isInRange = !isBelowMin && !isAboveMax;
  
  const status: 'success' | 'error' = isInRange ? 'success' : 'error';
  
  return { isInRange, isBelowMin, isAboveMax, status };
}

