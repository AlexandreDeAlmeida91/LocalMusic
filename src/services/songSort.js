export function sortSongs(songs, order = 'title') {
  const titleOrder = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr', {sensitivity:'base'});
  return [...songs].sort((a, b) => {
    if (order !== 'newest' && order !== 'oldest') return titleOrder(a, b);
    const left = Date.parse(a.addedAt), right = Date.parse(b.addedAt);
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : titleOrder(a,b);
    if (!Number.isFinite(right)) return -1;
    return (order === 'newest' ? right-left : left-right) || titleOrder(a,b);
  });
}
