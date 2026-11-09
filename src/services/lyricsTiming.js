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

// Accept only fully timestamped non-empty lines; never infer missing times.
export function parseLrc(input) {
  const rows=[]; let offset=0;
  for(const raw of String(input||'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    const adjustment=line.match(/^\[offset:([+-]?\d+)\]$/i);
    if(adjustment){offset=Number(adjustment[1])/1000;continue;}
    if(/^\[(?:ar|ti|al|by|re|ve|length):.*\]$/i.test(line))continue;
    const tags=[...line.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    if(!tags.length)return null;
    const text=line.replace(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g,'').trim();
    if(!text)continue;
    for(const t of tags)rows.push({text,time:Number(t[1])*60+Number(t[2])+(t[3]?Number('0.'+t[3]):0)});
  }
  rows.sort((a,b)=>a.time-b.time);
  const text=rows.map(r=>r.text).join('\n'),times=rows.map(r=>r.time+offset);
  const timing={text,times,source:'LRC'};
  return validTiming(timing,text)?timing:null;
}
