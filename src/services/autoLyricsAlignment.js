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
  let base=0;
  const times=lines.map((line,n)=>{
    const count=tokens(line).length, matches=matched[n], first=matches[0];
    // Require the first word and most of each line, not just a generic word in a chorus.
    const reliable=count>0&&first&&first.expected===base&&matches.length/count>=0.7;
    base+=count;
    if(!reliable)throw new Error('Correspondance insuffisante sur la ligne '+(n+1)+'. Aucun repère enregistré. Vérifie le texte et la langue.');
    return heard[first.heard].start;
  });
  const timing={text,times,source:'Analyse locale iOS · expérimentale',coverage};
  if(coverage<0.8 || !validTiming(timing,text))throw new Error('Alignement trop incertain. Aucun repère enregistré.');
  return timing;
}
