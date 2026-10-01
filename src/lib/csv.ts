export interface CsvFieldOptions {
  /**
   * Whether to neutralise a value a spreadsheet would run as a formula. On by default; turn it
   * off for a column whose values are validated to be harmless and would be corrupted by the
   * prefix, such as email addresses (`-deals@example.com` is a valid address, and a spreadsheet
   * formula needs characters an address cannot contain).
   */
  neutralise?: boolean;
}

/**
 * One CSV cell. Quotes when the value contains a separator, a quote or a line break, and
 * neutralises values a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, CR) by
 * prefixing an apostrophe, the convention spreadsheet applications use for literal text.
 */
export function csvField(value: string, { neutralise = true }: CsvFieldOptions = {}): string {
  const literal = neutralise && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(literal) ? `"${literal.replaceAll('"', '""')}"` : literal;
}

/** One CSV row from its cells; a cell may carry its own options. */
export function csvRow(cells: Array<string | [value: string, options: CsvFieldOptions]>): string {
  return cells
    .map((cell) => (typeof cell === 'string' ? csvField(cell) : csvField(cell[0], cell[1])))
    .join(',');
}
