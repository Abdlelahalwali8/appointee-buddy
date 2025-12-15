/**
 * Sanitizes user input for safe use in SQL LIKE/ILIKE patterns
 * Escapes special SQL wildcard characters to prevent injection attacks
 * 
 * @param input - The user input string to sanitize
 * @returns Sanitized string safe for use in LIKE patterns
 */
export const sanitizeSearchInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Escape SQL LIKE special characters: %, _, and backslash
  // The backslash must be escaped first to avoid double-escaping
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/%/g, '\\%')    // Escape percent signs
    .replace(/_/g, '\\_');   // Escape underscores
};

/**
 * Validates that the search term is within acceptable bounds
 * @param input - The search term to validate
 * @param minLength - Minimum required length (default: 2)
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns boolean indicating if the input is valid
 */
export const isValidSearchTerm = (
  input: string,
  minLength: number = 2,
  maxLength: number = 100
): boolean => {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  const trimmed = input.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
};
