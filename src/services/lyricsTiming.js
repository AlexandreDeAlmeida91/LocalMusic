export function timedLines(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
}
export function validTiming(timing, text) {
  const lines = timedLines(text);
  return !!timing && timing.text === text && lines.length > 0 &&
    Array.isArray(timing.times) && timing.times.length === lines.length &&
    timing.times.every((t,i) => Number.isFinite(t) && t >= 0 && (!i || t > timing.times[i-1]));
}
export function activeLyric(times, position) {
  let index = -1;
  for (let i=0;i<times.length;i++) { if (times[i] > position) break; index=i; }
  return index;
}
