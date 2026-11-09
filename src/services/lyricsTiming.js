export function timedLines(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
}
export function validTiming(timing, text) {
  const lines=timedLines(text);
  if(!timing||timing.text!==text||!lines.length||!Array.isArray(timing.times)||timing.times.length!==lines.length)return false;
  if(timing.partial!==true)return timing.times.every((t,i)=>Number.isFinite(t)&&t>=0&&(!i||t>timing.times[i-1]));
  if(!Array.isArray(timing.ends)||timing.ends.length!==lines.length)return false;
  let previous=-1,previousEnd=-1,count=0;
  for(let i=0;i<timing.times.length;i++){
    const t=timing.times[i],end=timing.ends[i];
    if(t===null){if(end!==null)return false;continue;}
    if(!Number.isFinite(t)||t<0||t<=previous||!Number.isFinite(end)||end<=t||previousEnd>t)return false;
    previous=t;previousEnd=end;count++;
  }
  return count>0;
}
export function activeLyric(times, position, ends) {
  let index=-1;
  for(let i=0;i<times.length;i++){
    if(times[i]===null)continue;
    if(times[i]>position)break;
    index=i;
  }
  return index>=0&&ends&&position>=ends[index]?-1:index;
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
