/**
 * Strip ANSI escape codes from text
 * @param text - Text containing ANSI codes
 * @returns Clean text without ANSI codes
 */
export function stripAnsiCodes(text: string): string {
  // Remove ANSI escape sequences
  // Matches patterns like:
  // - \x1b[0m (reset)
  // - \x1b[38;2;255;255;255m (24-bit color)
  // - \x1b[48;2;20;20;20m (24-bit background)
  // - \x1b[8;6H (cursor position)
  // - etc.
  return text
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // Standard ANSI codes
    .replace(/\x1b\[[0-9;]*m/g, '')        // Color codes
    .replace(/\x1b\[[\d;]*[HfABCDsuJKmhl]/g, '') // Extended codes
    .replace(/\x1b\][^\x07]*\x07/g, '')    // OSC sequences
    .replace(/\x1b\][^\x1b]*\x1b\\/g, '')  // OSC with ST terminator
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ''); // Control characters
}

/**
 * Clean and format terminal output for display
 * @param text - Raw terminal output
 * @returns Cleaned and formatted text
 */
export function cleanTerminalOutput(text: string): string {
  const cleaned = stripAnsiCodes(text);
  
  // Remove excessive whitespace but preserve single spaces
  return cleaned
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\r/g, '\n')    // Convert \r to \n
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}
