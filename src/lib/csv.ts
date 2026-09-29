/**
 * One CSV cell. Quotes when the value contains a separator, a quote or a line break, and
 * neutralises values a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, CR) by
 * prefixing an apostrophe, the convention spreadsheet applications use for literal text.
 */
export function csvField(value: string): string {
  const literal = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(literal) ? `"${literal.replaceAll('"', '""')}"` : literal;
}

/** One CSV row from its cells. */
export function csvRow(cells: string[]): string {
  return cells.map(csvField).join(',');
}
