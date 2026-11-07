/** A compact title for thumbnail captions; the catalogue title stays unchanged. */
export function shortWorkTitle(title: string): string {
  const source = title.replace(/\s+/gu, ' ').trim();
  if (!source) return 'Untitled work';

  let visible = '';
  let depth = 0;
  let groupStart = 0;
  const groups: string[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') {
      if (depth === 0) groupStart = index;
      depth += 1;
    } else if (character === ')' && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        groups.push(source.slice(groupStart + 1, index));
        // Keep words separated when a qualifier occurs without surrounding spaces.
        visible += ' ';
      }
    } else if (depth === 0) {
      visible += character;
    }
  }

  // An unfinished group is not a complete qualifier: preserve its identification.
  if (depth > 0) visible += source.slice(groupStart);
  const compact = cleanTitle(visible);
  if (compact) return compact;

  // Some records put their whole title in parentheses. Keep the first meaningful
  // title, without its enclosing brackets, rather than render an empty caption.
  for (const group of groups) {
    if (cleanTitle(group.replace(/[()]/gu, ' '))) return shortWorkTitle(group);
  }
  return 'Untitled work';
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().replace(/[\s,:;|/\u2013\u2014-]+$/u, '').trim();
}
