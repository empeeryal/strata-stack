/**
 * Escapes the SQL `LIKE` wildcards in user input so it is matched literally. Use together
 * with `ESCAPE '\'` in the query.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
