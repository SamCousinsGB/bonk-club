// A horizontal broad phase for narrow liquid columns. Rebuilt from surviving
// geometry each tick: cuts, moving platforms and thawing cannot leave stale walls.
const SIZE = 96;
const EMPTY = Object.freeze([]);
export function liquidColumns(items, bounds = q => q, padding = 0) {
  const columns = new Map();
  for (const item of items) {
    const b = bounds(item), end = Math.floor((b.x + b.w + padding) / SIZE);
    for (let i = Math.floor((b.x - padding) / SIZE); i <= end; i++) {
      let column = columns.get(i);
      if (!column) columns.set(i, column = []);
      column.push(item);
    }
  }
  return {
    at(x) { return columns.get(Math.floor(x / SIZE)) || EMPTY; },
    between(left, right) {
      const first = Math.floor(left / SIZE), last = Math.floor(right / SIZE);
      if (first === last) return columns.get(first) || EMPTY;
      const found = new Set();
      for (let i = first; i <= last; i++) for (const item of columns.get(i) || EMPTY) found.add(item);
      return found;
    }
  };
}
