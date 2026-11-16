export type StyleId='classic'|'expressive'|'editorial'|'mystery'|'pholaclu';
export type Scene={id:string;start:number;end:number;narration:string;location:string;characters:string;reference:string;action:string;prompt:string;status:'draft'|'review'|'approved'};
export type Project={id:string;name:string;topic:string;script:string;srt:string;style:StyleId;ratio:'16:9'|'9:16';duration:number;scenes:Scene[];updatedAt:number};
export const STYLE:Record<StyleId,{name:string;palette:string;description:string;negative:string}>={
 classic:{name:'Classic Stickman',palette:'#F7F5EF #252525 #3D79C5 #F2BA49',description:'Clean line stick figures, whiteboard minimal, concise educational props, high readability',negative:'photorealism, 3D, clutter, inconsistent limb thickness'},
 expressive:{name:'Expressive Cartoon',palette:'#FFF8E9 #313741 #58A493 #E7A54B',description:'Expressive 2D stickman-cartoon hybrid, clear brows and mouths, readable body acting, light pastel environments',negative:'anime, chibi, photorealism, overacting in serious moments'},
 editorial:{name:'Adult Editorial Stickman 2D',palette:'#EEE8DF #343C42 #71889B #C68B61 #A65F5A',description:'Adult editorial webcomic-like stick figures, subtle natural facial expression, modern Vietnamese workplace, muted dusty pastel, soft diffuse light',negative:'anime, chibi, 3D, photorealism, childish proportions, oversaturated neon'},
 mystery:{name:'Cinematic Mystery Stickman',palette:'#182432 #E9E3D7 #486783 #D2A059 #A4474C',description:'Minimal adult 2D stick figures, cinematic noir composition, warm tungsten interiors, cool navy night exteriors, carefully staged clues',negative:'gore, excessive lens flare, 3D, character swaps, evidence teleportation'},
 pholaclu:{name:'Phố Lắc Lư Editorial 2D',palette:'#151820 #F5EBD3 #EE8645 #66B9AC #C8A45B',description:'Original adult-friendly rounded editorial 2D cartoon; charcoal #151820 background, warm cream spotlight #F5EBD3, restrained dusty pastel accents, clean expressive silhouettes',negative:'3D, photorealism, anime, chibi, face drift, redesigned wardrobe, extra limbs, watermark'}
};
export const fmt=(n:number)=>{const s=Math.max(0,Math.round(n*1000)/1000);const mm=Math.floor(s/60),ss=Math.floor(s%60),ms=Math.round((s-Math.floor(s))*1000);return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(ms).padStart(3,'0')}`};
export function parseSrt(srt:string):{start:number;end:number;text:string}[]{const time=(v:string)=>{const m=v.trim().match(/(?:(\d+):)?(\d\d):(\d\d)[,.](\d{1,3})/);if(!m)return NaN;return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3])+Number(m[4].padEnd(3,'0'))/1000};return srt.replace(/\r/g,'').split(/\n\s*\n/).flatMap(block=>{const lines=block.trim().split('\n');const i=lines.findIndex(l=>l.includes('-->'));if(i<0)return [];const [a,b]=lines[i].split('-->');const start=time(a),end=time(b);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];return [{start,end,text:lines.slice(i+1).join(' ').trim()}]})};
const splitSentences=(str:string)=>str.replace(/\s+/g,' ').trim().match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g)?.map(x=>x.trim()).filter(Boolean)||[];
export function createScenes(script:string,srt:string,duration:number):Scene[]{const cap=Math.min(15,Math.max(1,duration));const items=parseSrt(srt);const out:{start:number;end:number;narration:string}[]=[];
 if(items.length){let bucket:{start:number;end:number;narration:string}|null=null;for(const item of items){if(!bucket){bucket={...item,narration:item.text};continue;}if(item.end-bucket.start<=cap && item.start-bucket.end<=1.5){bucket.end=item.end;bucket.narration+=' '+item.text;}else{out.push(bucket);bucket={...item,narration:item.text};}}if(bucket)out.push(bucket);
 // A long subtitle may be longer than the model duration: subdivide into consecutive segments.
 const chunks=out.flatMap(x=>{if(x.end-x.start<=cap+0.001)return [x];const parts=Math.ceil((x.end-x.start)/cap);const words=x.narration.split(/\s+/);return Array.from({length:parts},(_,i)=>({start:x.start+(x.end-x.start)*i/parts,end:x.start+(x.end-x.start)*(i+1)/parts,narration:words.slice(Math.floor(i*words.length/parts),Math.floor((i+1)*words.length/parts)).join(' ')}));});out.splice(0,out.length,...chunks);
 }else{const words=splitSentences(script).flatMap(s=>s.split(/\s+/));const wps=2.25;let start=0;while(words.length){const seg=words.splice(0,Math.max(1,Math.round(cap*wps)));const narration=seg.join(' ');const length=Math.max(1,Math.min(cap,seg.length/wps));out.push({start,end:start+length,narration});start+=length;}}
 return out.map((x,i)=>({id:`F${String(i+1).padStart(3,'0')}`,start:Math.round(x.start*1000)/1000,end:Math.round(x.end*1000)/1000,narration:x.narration,location:'',characters:'CHAR_01',reference:'REF_STYLE; REF_CHAR_01',action:'',prompt:'',status:'draft'}));}
export function promptFor(s:Scene,p:Project,prior?:Scene,next?:Scene){const style=STYLE[p.style];return `${s.id} | GROK VIDEO | TARGET ${(s.end-s.start).toFixed(3)}s | ${p.ratio}\nVISUAL STYLE LOCK: ${style.description}. PALETTE LOCK: ${style.palette}. Keep character identity, face and wardrobe consistent across scenes.\nREFERENCES: ${s.reference||'REF_STYLE; REF_CHAR_01'}. CHARACTERS: ${s.characters||'CHAR_01'}. LOCATION: ${s.location||'use story context'}.\nNARRATION CONTEXT (do not render as on-screen text): ${s.narration}\nACTION: ${s.action||'One clear visual beat matching the narration. Subtle readable expression and deliberate body language.'}\nTIMING: first 25% establish prior state and action, middle 55% meaningful body movement or emotional reaction, final 20% settle into an end pose that connects to next shot.\nSTART CONTINUITY: ${prior?`Continue from ${prior.id} ending pose, camera direction, color and props.`:'Establish stable opening composition.'}\nEND CONTINUITY: ${next?`Lead naturally into ${next.id}; preserve position, props and visual direction.`:'End on a meaningful composed hold.'}\nCAMERA: stable purposeful 2D staging, smooth camera motion only if story needs it. No random cuts. No subtitles, watermark, distorted hands, extra limbs, identity drift or abrupt lighting change. NEGATIVE: ${style.negative}.`}
export function qa(p:Project){const errors:{id:string;severity:'error'|'warning';message:string}[]=[];p.scenes.forEach((s,i)=>{const dur=s.end-s.start;if(dur<=0||dur>15.001)errors.push({id:s.id,severity:'error',message:`Thời lượng ${dur.toFixed(2)}s ngoài khoảng hợp lệ 1–15s`});if(dur<1)errors.push({id:s.id,severity:'warning',message:'Cảnh ngắn dưới 1 giây'});if(!s.reference.trim())errors.push({id:s.id,severity:'warning',message:'Chưa gắn mã ảnh tham chiếu'});if(!s.prompt.trim())errors.push({id:s.id,severity:'warning',message:'Chưa tạo prompt'});if(i>0){const prev=p.scenes[i-1];const delta=s.start-prev.end;if(delta>0.05)errors.push({id:s.id,severity:'warning',message:`Hở timeline ${delta.toFixed(3)}s so với ${prev.id}`});if(delta<-.05)errors.push({id:s.id,severity:'error',message:`Chồng timeline ${(-delta).toFixed(3)}s với ${prev.id}`})}});if(!p.srt.trim())errors.unshift({id:'PROJECT',severity:'warning',message:'Chưa nhập SRT thực: thời gian hiện chỉ là ước tính từ số từ'});return errors}
export function download(name:string,content:string,type='text/plain;charset=utf-8'){const file=new Blob(['\ufeff',content],{type});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
export const csvEscape=(s:unknown)=>`"${String(s??'').replace(/"/g,'""')}"`;
const fmtMMSS=(sec:number)=>{const s=Math.max(0,Math.floor(sec));const hh=Math.floor(s/3600),mm=Math.floor((s%3600)/60),ss=s%60;return hh>0?`${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`};

export function buildYoutubeChapters(p:Project):{chaptersText:string;source:'srt'|'scenes'|'estimated'|'none';count:number;totalSec:number}{
 const srtItems=parseSrt(p.srt);
 if(srtItems.length){
  const totalSec=Math.max(...srtItems.map(x=>x.end),0);
  const minGap=totalSec>60?12:5;
  const picks:{sec:number;label:string}[]=[];
  for(const item of srtItems){
   const sec=picks.length===0?0:Math.floor(item.start);
   const label=item.text.replace(/\s+/g,' ').trim().slice(0,58);
   if(!label)continue;
   if(picks.length===0||(sec-picks[picks.length-1].sec>=minGap&&picks.length<12)){
    picks.push({sec,label});
   }
  }
  if(picks.length){
   return {chaptersText:picks.map(x=>`${fmtMMSS(x.sec)} ${x.label}`).join('\n'),source:'srt',count:picks.length,totalSec};
  }
 }
 if(p.scenes.length){
  const totalSec=Math.max(...p.scenes.map(x=>x.end),0);
  const picks:{sec:number;label:string}[]=[];
  for(const s of p.scenes){
   const sec=picks.length===0?0:Math.floor(s.start);
   const label=(s.action||s.narration||s.id).replace(/\s+/g,' ').trim().slice(0,58);
   if(picks.length===0||(sec-picks[picks.length-1].sec>=8&&picks.length<12)){
    picks.push({sec,label});
   }
  }
  return {chaptersText:picks.map(x=>`${fmtMMSS(x.sec)} ${x.label}`).join('\n'),source:'scenes',count:picks.length,totalSec};
 }
 const sents=splitSentences(p.script);
 if(sents.length>=3){
  const wordsTotal=sents.reduce((a,s)=>a+s.split(/\s+/).length,0);
  const estTotal=Math.max(15,Math.round(wordsTotal/2.25));
  const step=Math.max(1,Math.floor(sents.length/4));
  const picks:{sec:number;label:string}[]=[];
  let accWords=0;
  sents.forEach((s,idx)=>{
   const sec=idx===0?0:Math.round(accWords/2.25);
   if(idx===0||(idx%step===0&&picks.length<5&&sec-(picks[picks.length-1]?.sec??0)>=5)){
    picks.push({sec,label:s.slice(0,58)});
   }
   accWords+=s.split(/\s+/).length;
  });
  return {chaptersText:picks.map(x=>`${fmtMMSS(x.sec)} ${x.label}`).join('\n'),source:'estimated',count:picks.length,totalSec:estTotal};
 }
 return {chaptersText:'',source:'none',count:0,totalSec:0};
}

const STOPWORDS=new Set(['và','của','là','có','trong','một','những','các','được','cho','với','khi','đã','đang','sẽ','không','như','về','tại','này','đó','từ','lên','xuống','ra','vào','anh','cô','ông','bà','người','nhưng','mà','thì','lại','rồi','vẫn','cũng','nên','vì','để','hay','hoặc','nếu','tuy','nhất','rất','quá','hơn','bị','do','theo','trên','dưới','sau','trước','giữa','cùng','mình','bạn','tôi','họ','ta','nó','đây','kia','nào','sao','ai','gì','cái','chiếc','tấm','bức','lúc','nơi','mọi','đều','thấy','biết','làm','nói','hỏi','nhìn','bước','đặt','mở','chỉ','còn','đến','tới','qua','lấy','đi','về','the','and','for','with','that','this','from','into','was','were','are','has','have','had','but','not','you','your','his','her','they','their','about','story']);

const CLIMAX_CUES=['nhưng','bất ngờ','phát hiện','sự thật','quyết định','bí mật','không ngờ','cuối cùng','khựng','giật mình','im lặng','chọn','nhận ra','hóa ra','đột nhiên','biến mất','tiết lộ','thay đổi','trả giá','hối hận','but','suddenly','truth','secret','discovered','decided','realized','finally','shocked'];

export function extractScriptInsights(p:Project,voiceTextFallback=''){
 const srtText=parseSrt(p.srt).map(x=>x.text).join(' ');
 const scriptSource=(p.script.trim()||voiceTextFallback.trim()||srtText||p.scenes.map(s=>s.narration).join(' ')).trim();
 const sentences=splitSentences(scriptSource);
 const hookSentence=(sentences[0]||p.topic||p.name||'').replace(/\s+/g,' ').trim();

 // Pick highest-tension / turning-point sentence from script for Title & Thumbnail
 let climaxSentence=sentences[1]||hookSentence;
 let bestScore=-1;
 sentences.forEach((s,idx)=>{
  const low=s.toLowerCase();
  let sc=0;
  for(const cue of CLIMAX_CUES)if(low.includes(cue))sc+=3;
  if(s.includes('?')||s.includes('!'))sc+=2;
  if(idx>0&&idx<sentences.length)sc+=1;
  if(s.length>=25&&s.length<=130)sc+=1;
  if(sc>bestScore){bestScore=sc;climaxSentence=s.replace(/\s+/g,' ').trim();}
 });

 // Extract meaningful 2-word and 3-word phrases + proper names from script
 const cleanSentences=splitSentences([p.script,srtText,voiceTextFallback].filter(Boolean).join('. '));
 const phraseFreq=new Map<string,number>();
 const properFreq=new Map<string,number>();
 for(const sent of cleanSentences){
  const rawWords=sent.replace(/[.,!?;:"'()\[\]{}…–—/\\]/g,' ').split(/\s+/).filter(Boolean);
  rawWords.forEach((w,idx)=>{
   if(idx>0&&/^[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-Ỹ][a-zàáâãèéêìíòóôõùúăđĩũơưạ-ỹ]{1,}$/.test(w)){
    properFreq.set(w,(properFreq.get(w)||0)+1);
   }
  });
  const words=rawWords.map(w=>w.toLowerCase());
  for(let n=2;n<=3;n++){
   for(let i=0;i<=words.length-n;i++){
    const slice=words.slice(i,i+n);
    if(STOPWORDS.has(slice[0])||STOPWORDS.has(slice[slice.length-1]))continue;
    if(slice.some(w=>w.length<2||/^\d+$/.test(w)))continue;
    const phrase=slice.join(' ');
    phraseFreq.set(phrase,(phraseFreq.get(phrase)||0)+(n===3?1.4:1));
   }
  }
 }
 const scriptPhrases=[...phraseFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k])=>k);
 const properNames=[...properFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k);
 return {scriptSource,sentences,hookSentence,climaxSentence,scriptPhrases,properNames};
}

export function extractSeoKeywords(p:Project,channel:string,genre:string,isEn:boolean,voiceTextFallback=''){
 const {scriptPhrases,properNames}=extractScriptInsights(p,voiceTextFallback);
 const baseTopic=(p.topic||p.name||'').trim();
 const styleName=STYLE[p.style].name;
 const isShorts=p.ratio==='9:16';
 const raw=[
  baseTopic,
  ...scriptPhrases.slice(0,7),
  ...properNames.map(n=>baseTopic?`${n} ${baseTopic.split(' ').slice(0,2).join(' ')}`:n),
  p.name&&p.name!==baseTopic?p.name:'',
  channel,
  genre,
  styleName,
  isShorts?'youtube shorts':'stickman animation',
  isEn?'stickman storytelling':'kể chuyện stickman',
  isEn?'2d animation':'hoạt hình 2d'
 ].map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const unique:string[]=[];
 const seen=new Set<string>();
 for(const item of raw){
  const k=item.toLowerCase();
  if(!seen.has(k)){seen.add(k);unique.push(item);}
 }
 return unique;
}

const toHashtag=(phrase:string)=>'#'+phrase.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^a-zA-Z0-9]+/g,'').slice(0,26);

export function buildSeoTemplate(p:Project,extra:{channel:string;genre:string;audience:string;language:string;voiceText?:string;characters:{name:string;look:string;wardrobe:string}[];locations:{name:string;palette:string;props:string}[]}){
 const style=STYLE[p.style];
 const isEn=extra.language==='en-US';
 const isShorts=p.ratio==='9:16';
 const {sentences,hookSentence,climaxSentence,scriptPhrases,properNames}=extractScriptInsights(p,extra.voiceText||'');
 const baseTopic=(p.topic||p.name||'Câu chuyện Stickman').trim();

 // 1. YouTube Title: combine Tổng quan topic + conflict/climax extracted from Kịch bản (50-70 chars optimal, <=100 max)
 const cleanClimax=climaxSentence.replace(/[.!?。！？]+$/,'').replace(/^(nhưng|và|khi|rồi)\s+/i,'').trim();
 const cleanHook=hookSentence.replace(/[.!?。！？]+$/,'').trim();
 const scriptAngle=(cleanClimax&&cleanClimax.length<=52?cleanClimax:cleanHook.slice(0,52)).trim();
 const suffix=isShorts?'#Shorts':(extra.channel?`| ${extra.channel}`:'');
 let titleCandidate=baseTopic;
 if(scriptAngle&&!baseTopic.toLowerCase().includes(scriptAngle.toLowerCase().slice(0,16))){
  const combined=`${baseTopic}: ${scriptAngle}`;
  titleCandidate=combined.length<=92?combined:`${scriptAngle} — ${baseTopic}`;
 }
 if(suffix&&titleCandidate.length+suffix.length+1<=100){
  titleCandidate=`${titleCandidate} ${suffix}`;
 }
 const seoTitle=(titleCandidate.length>100?titleCandidate.slice(0,97)+'...':titleCandidate).trim();

 // 2. YouTube Description: first 150-200 chars contain primary keyword + hook/climax from script, then summary, 00:00 chapters, CTA & hashtags from script
 const summary=sentences.slice(0,4).join(' ').slice(0,360);
 const {chaptersText,source}=buildYoutubeChapters(p);
 const chapterHeading=isEn?'⏱️ Chapters:':(source==='srt'?'⏱️ Mốc thời gian (từ SRT thực):':'⏱️ Mốc nội dung:');
 const keywords=extractSeoKeywords(p,extra.channel,extra.genre,isEn,extra.voiceText||'');
 const hashtagPool=[...(isShorts?['#Shorts']:[]),baseTopic,...scriptPhrases.slice(0,4),extra.channel];
 const hashtags=[...new Set(hashtagPool.map(x=>x.startsWith('#')?x:toHashtag(x)).filter(x=>x.length>2))].slice(0,5).join(' ');
 const seoDescription=isEn
  ?`${baseTopic} — ${hookSentence}\n\n${summary}${summary.length>=360?'...':''}\n${chaptersText?`\n${chapterHeading}\n${chaptersText}\n`:''}\n📌 Channel: ${extra.channel} | Genre: ${extra.genre}\n💬 What would you do in this situation? Share your thoughts in the comments and subscribe for more ${style.name} stories.\n\n${hashtags}`
  :`${baseTopic} — ${hookSentence}\n\n${summary}${summary.length>=360?'...':''}\n${chaptersText?`\n${chapterHeading}\n${chaptersText}\n`:''}\n📌 Kênh: ${extra.channel} | Chủ đề: ${extra.genre} | Phong cách: ${style.name}\n💬 Bạn nghĩ sao về tình huống trong câu chuyện này? Hãy để lại bình luận và nhấn Đăng ký để đón xem các tập tiếp theo.\n\n${hashtags}`;

 // 3. YouTube Tags (<500 chars total, prioritizing script phrases) + Hashtags
 let tagStr='';
 for(const kw of keywords){
  const next=tagStr?`${tagStr}, ${kw}`:kw;
  if(next.length<=450)tagStr=next;
 }
 const seoTags=`${tagStr}\n${hashtags}`;

 // 4. YouTube Thumbnail Concept (16:9 1280x720 or 9:16 Shorts) grounded in script climax + props
 const scriptLead=properNames[0]?`${properNames[0]} (CHAR_01)`:'CHAR_01';
 const mainChar=extra.characters[0]?`${extra.characters[0].name} (${extra.characters[0].look}, ${extra.characters[0].wardrobe})`:`${scriptLead} expressive 2D stickman protagonist`;
 const scriptProps=scriptPhrases.slice(0,3).join(', ')||baseTopic;
 const mainLoc=extra.locations[0]?`${extra.locations[0].name}, key prop: ${extra.locations[0].props}`:(p.scenes[0]?.location||`story scene featuring ${scriptProps}`);
 const overlaySource=(scriptPhrases[0]||cleanClimax||baseTopic).split(/\s+/).slice(0,4).join(' ').toUpperCase();
 const thumbnailPrompt=isShorts
  ?`9:16 YouTube Shorts Cover Frame (1080x1920), ${style.description}. Palette lock: ${style.palette}. Center-vertical composition depicting script turning point "${climaxSentence.slice(0,95)}": ${mainChar} with tense emotional expression reacting to focal elements (${scriptProps}) inside ${mainLoc}. Keep top 15% and bottom 25% clear of vital details (YouTube Shorts UI safe zones). Bold 2–4 word hook text at upper-center: "${overlaySource}". High contrast, max 3 visual elements. Negative: ${style.negative}.`
  :`16:9 YouTube Thumbnail (1280x720), ${style.description}. Palette lock: ${style.palette}. Rule-of-thirds composition (max 3 focal elements) illustrating script climax "${climaxSentence.slice(0,110)}": ${mainChar} on left-third with clear emotional silhouette and expressive eyes, facing focal story clue/objects (${scriptProps}) in ${mainLoc} on right-center. Leave clean negative space at upper-left/upper-right for bold 2–4 word overlay text ("${overlaySource}") that complements without repeating the full video title. Keep bottom-right corner dark and uncluttered (YouTube duration badge safe zone). Negative: ${style.negative}.`;

 return {seoTitle,seoDescription,seoTags,thumbnailPrompt};
}

export function auditYoutubeSeo(p:Project,seo:{seoTitle:string;seoDescription:string;seoTags:string;thumbnailPrompt:string},voiceTextFallback=''){
 const title=seo.seoTitle.trim();
 const desc=seo.seoDescription.trim();
 const tags=seo.seoTags.trim();
 const thumb=seo.thumbnailPrompt.trim();
 const {scriptPhrases}=extractScriptInsights(p,voiceTextFallback);
 const topicWords=(p.topic||p.name||'').toLowerCase().split(/\s+/).filter(w=>w.length>=3);
 const matchTerms=[...topicWords,...scriptPhrases.slice(0,5)];
 const titleHasKeyword=matchTerms.length===0||matchTerms.some(w=>title.toLowerCase().includes(w));
 const first180=desc.slice(0,180).toLowerCase();
 const descTopHasKeyword=matchTerms.length===0||matchTerms.some(w=>first180.includes(w));
 const hasZeroChapter=/(^|\n)0{1,2}:00\b/.test(desc);
 const chapterMatches=desc.match(/(^|\n)\d{1,2}:\d{2}\b/g)||[];
 const tagBody=tags.split('\n')[0]||'';
 const hashtagMatches=tags.match(/#[A-Za-z0-9_]+/g)||[];
 const checks=[
  {label:'Tiêu đề chuẩn độ dài (30–70 ký tự tối ưu, ≤100)',ok:title.length>=25&&title.length<=100,hint:title?`Hiện tại ${title.length} ký tự${title.length>70?' (có thể bị cắt trên mobile)':''}`:'Chưa có tiêu đề'},
  {label:'Tiêu đề chứa từ khóa chủ đề / kịch bản',ok:Boolean(title)&&titleHasKeyword,hint:titleHasKeyword?'Đã khớp từ khóa chủ đề hoặc kịch bản':'Nên đưa từ khóa từ chủ đề/kịch bản lên đầu tiêu đề'},
  {label:'180 ký tự đầu mô tả có hook & từ khóa chính',ok:desc.length>=80&&descTopHasKeyword,hint:descTopHasKeyword?'2 dòng đầu đạt chuẩn hiển thị tìm kiếm':'Cần đưa từ khóa chính vào 2 dòng đầu mô tả'},
  {label:'Có Chapters YouTube bắt đầu từ 00:00 (≥3 mốc)',ok:hasZeroChapter&&chapterMatches.length>=3,hint:hasZeroChapter?`Đã có ${chapterMatches.length} mốc thời gian`:'YouTube yêu cầu mốc đầu 00:00 và tối thiểu 3 mốc'},
  {label:'Tags ≤500 ký tự & có 3–5 #hashtags',ok:tagBody.length>10&&tagBody.length<=500&&hashtagMatches.length>=3,hint:`Tags: ${tagBody.length}/500 ký tự · ${hashtagMatches.length} hashtags`},
  {label:`Concept thumbnail khớp tỷ lệ ${p.ratio==='9:16'?'9:16':'16:9 (1280×720)'} & vùng an toàn`,ok:thumb.length>=40&&(thumb.includes(p.ratio)||thumb.includes('1280')||thumb.toLowerCase().includes('thumbnail')||thumb.toLowerCase().includes('cover')),hint:thumb?`Đã khớp khung ${p.ratio==='9:16'?'9:16':'16:9 (1280×720)'}`:`Chưa có mô tả thumbnail ${p.ratio}`}
 ];
 const score=Math.round((checks.filter(c=>c.ok).length/checks.length)*100);
 return {score,checks};
}



