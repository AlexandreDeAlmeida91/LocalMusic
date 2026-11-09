import {timedLines, validTiming} from './lyricsTiming';
const tokens = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

// Conservative sequence alignment. Never invent timing for an unmatched line.
export function alignLyrics(text, segments) {
  const lines = timedLines(text);
  const expected = lines.flatMap((line,index)=>tokens(line).map(word=>({word,line:index})));
  const heard = segments.flatMap(s=>tokens(s.text).map(word=>({word,start:s.start,end:s.end})))
    .filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=0&&w.end>=w.start);
  if (!expected.length || expected.length>1800 || heard.length>4000)
    throw new Error('Texte trop long ou sans mots exploitables pour ce mode expérimental.');
  if (!heard.length) throw new Error('Aucune voix reconnue. Les paroles existantes sont conservées.');
  if (heard.some((w,i)=>i&&w.start<heard[i-1].start)) throw new Error('Repères audio incohérents.');
  const width=heard.length+1;
  const dp=new Uint16Array((expected.length+1)*width);
  for(let i=expected.length-1;i>=0;i--)for(let j=heard.length-1;j>=0;j--)
    dp[i*width+j]=expected[i].word===heard[j].word?1+dp[(i+1)*width+j+1]:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);
  const matched=lines.map(()=>[]);
  let i=0,j=0,total=0;
  while(i<expected.length&&j<heard.length){
    if(expected[i].word===heard[j].word){matched[expected[i].line].push({expected:i,heard:j});i++;j++;total++;}
    else if(dp[(i+1)*width+j]>dp[i*width+j+1])i++;else j++;
  }
  const coverage=total/expected.length;
  const counts=lines.map(line=>tokens(line).length);
  const times=lines.map(()=>null), ends=lines.map(()=>null), kinds=lines.map(()=>'missing');
  let base=0, previous=-1;
  for(let n=0;n<lines.length;n++){
    const count=counts[n], matches=matched[n], first=matches[0], last=matches[matches.length-1];
    // Accept a strong phrase anywhere, even when the first word was not heard.
    const strong=count>0&&first&&matches.length>=Math.min(3,count)&&matches.length/count>=0.7;
    if(strong){
      const start=heard[first.heard].start, end=heard[last.heard].end;
      const compact=last.heard-first.heard+1<=Math.max(count*2,4)&&end-start<=Math.max(count*1.8,5);
      if(compact&&start>previous){
        times[n]=start;ends[n]=Math.max(start+0.1,end);
        kinds[n]=first.expected===base?'detected':'estimated';
        previous=start;
      }
    }
    base+=count;
  }
  const anchors=times.map((t,i)=>t===null?-1:i).filter(i=>i>=0);
  if(!anchors.length)throw new Error('Aucune ligne suffisamment reconnue dans le morceau. Vérifie les paroles et la langue.');
  // Fill only short internal gaps bounded by recognized audio on both sides.
  // Never extrapolate the intro or ending from a single anchor.
  for(let k=0;k<anchors.length-1;k++){
    const left=anchors[k],right=anchors[k+1],gap=right-left-1;
    const from=ends[left],to=times[right],span=to-from;
    if(gap<1||gap>3||span<gap*0.5||span>20)continue;
    const weight=counts.slice(left+1,right).reduce((a,b)=>a+Math.max(1,b),0);
    let at=from;
    for(let n=left+1;n<right;n++){
      times[n]=at;at+=span*Math.max(1,counts[n])/weight;
      ends[n]=at;kinds[n]='estimated';
    }
  }
  let next=null;
  for(let n=times.length-1;n>=0;n--){
    if(times[n]===null)continue;
    if(next!==null)ends[n]=Math.min(ends[n],next);
    next=times[n];
  }
  const timing={text,times,ends,kinds,partial:true,source:'Analyse locale iOS · repères partiels',coverage};
  if(!validTiming(timing,text))throw new Error('Repères incohérents. Aucun changement enregistré.');
  return timing;
}
