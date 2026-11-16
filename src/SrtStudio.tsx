import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Captions,Sliders,Scissors,Download,Copy,CheckCircle2,Plus,Trash2,Upload,Wand2} from 'lucide-react';
import {Project,fmt,parseSrt,download} from './core';

export interface SrtCue{
 id:string;
 start:number;
 end:number;
 text:string;
 pauseAfterMs:number;
}

function toSrtTimestamp(sec:number):string{
 const msTotal=Math.max(0,Math.round(sec*1000));
 const hh=Math.floor(msTotal/3600000);
 const mm=Math.floor((msTotal%3600000)/60000);
 const ss=Math.floor((msTotal%60000)/1000);
 const ms=msTotal%1000;
 return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

function formatSrt(cues:SrtCue[]):string{
 return cues
  .filter(c=>c.text.trim().length>0&&c.end>c.start)
  .map((c,i)=>`${i+1}\n${toSrtTimestamp(c.start)} --> ${toSrtTimestamp(c.end)}\n${c.text.trim()}`)
  .join('\n\n');
}

function segmentVadLike(rawText:string,opts:{wpm:number;pauseMs:number;maxWords:number;targetTotalSec?:number}):SrtCue[]{
 const clean=rawText.replace(/\r/g,'').trim();
 if(!clean)return [];
 const paragraphs=clean.split(/\n+/).map(p=>p.trim()).filter(Boolean);
 const rawSlices:{text:string;pauseMs:number}[]=[];

 for(let pIdx=0;pIdx<paragraphs.length;pIdx++){
  const para=paragraphs[pIdx];
  // First split on strong sentence endings (. ! ? ... …)
  const sentences=para.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map(x=>x.trim()).filter(Boolean)||[para];
  for(let sIdx=0;sIdx<sentences.length;sIdx++){
   const sent=sentences[sIdx];
   const words=sent.split(/\s+/).filter(Boolean);
   if(words.length<=opts.maxWords){
    const isParaEnd=sIdx===sentences.length-1&&pIdx<paragraphs.length-1;
    rawSlices.push({text:sent,pauseMs:isParaEnd?opts.pauseMs+280:opts.pauseMs});
    continue;
   }
   // VAD-like micro-pause split on commas / semicolons / dashes when sentence exceeds maxWords
   const clauses=sent.split(/(?<=[,;:\u2013\u2014])\s+/).map(x=>x.trim()).filter(Boolean);
   const buckets:string[]=[];
   let current='';
   for(const clause of clauses){
    const cWords=clause.split(/\s+/).filter(Boolean);
    if(cWords.length>opts.maxWords){
     if(current){buckets.push(current);current='';}
     for(let i=0;i<cWords.length;i+=opts.maxWords){
      buckets.push(cWords.slice(i,i+opts.maxWords).join(' '));
     }
     continue;
    }
    const candidate=current?`${current} ${clause}`:clause;
    if(candidate.split(/\s+/).filter(Boolean).length<=opts.maxWords){
     current=candidate;
    }else{
     if(current)buckets.push(current);
     current=clause;
    }
   }
   if(current)buckets.push(current);

   buckets.forEach((b,bIdx)=>{
    const isLastOfSent=bIdx===buckets.length-1;
    const isParaEnd=isLastOfSent&&sIdx===sentences.length-1&&pIdx<paragraphs.length-1;
    const microPause=Math.max(120,Math.round(opts.pauseMs*0.55));
    rawSlices.push({
     text:b,
     pauseMs:isParaEnd?opts.pauseMs+280:(isLastOfSent?opts.pauseMs:microPause)
    });
   });
  }
 }

 const wps=Math.max(1.2,opts.wpm/60);
 let cursor=0;
 const built:SrtCue[]=rawSlices.map((sl,idx)=>{
  const wordCount=sl.text.split(/\s+/).filter(Boolean).length;
  const charBonus=(sl.text.match(/[,;:\u2013\u2014]/g)?.length||0)*0.12;
  const speechDur=Math.max(0.8,Math.round(((wordCount/wps)+charBonus)*1000)/1000);
  const start=Math.round(cursor*1000)/1000;
  const end=Math.round((start+speechDur)*1000)/1000;
  cursor=end+(sl.pauseMs/1000);
  return {
   id:`CUE_${idx+1}_${Math.random().toString(36).slice(2,6)}`,
   start,
   end,
   text:sl.text,
   pauseAfterMs:sl.pauseMs
  };
 });

 if(opts.targetTotalSec&&opts.targetTotalSec>0&&built.length){
  const currentTotal=built[built.length-1].end;
  if(currentTotal>0){
   const scale=opts.targetTotalSec/currentTotal;
   return built.map(c=>({
    ...c,
    start:Math.round(c.start*scale*1000)/1000,
    end:Math.max(Math.round(c.start*scale*1000)/1000+0.25,Math.round(c.end*scale*1000)/1000)
   }));
  }
 }
 return built;
}

type DragState={
 index:number;
 mode:'move'|'start'|'end';
 originX:number;
 origStart:number;
 origEnd:number;
 barWidth:number;
 totalSpan:number;
};

export function SrtStudio({
 project,
 cleanNarrationText,
 onApplyProjectSrt,
 onNotice
}:{
 project:Project;
 cleanNarrationText:string;
 onApplyProjectSrt:(srt:string)=>void;
 onNotice:(msg:string)=>void;
}){
 const [rawText,setRawText]=useState<string>(()=>(cleanNarrationText||project.script||'').trim());
 const [wpm,setWpm]=useState<number>(135);
 const [pauseMs,setPauseMs]=useState<number>(320);
 const [maxWords,setMaxWords]=useState<number>(12);
 const [targetAudioSec,setTargetAudioSec]=useState<string>('');
 const [quickEdit,setQuickEdit]=useState<boolean>(true);
 const [cues,setCues]=useState<SrtCue[]>(()=>{
  const existing=parseSrt(project.srt);
  return existing.map((x,i)=>({id:`INIT_${i}`,start:x.start,end:x.end,text:x.text,pauseAfterMs:300}));
 });
 const [srtText,setSrtText]=useState<string>(project.srt||'');

 const dragRef=useRef<DragState|null>(null);
 const cuesRef=useRef<SrtCue[]>(cues);
 cuesRef.current=cues;
 const prevProjectIdRef=useRef<string>(project.id);

 useEffect(()=>{
  if(prevProjectIdRef.current!==project.id){
   prevProjectIdRef.current=project.id;
   setRawText((cleanNarrationText||project.script||'').trim());
   const parsed=parseSrt(project.srt);
   setCues(parsed.map((x,i)=>({id:`INIT_${i}`,start:x.start,end:x.end,text:x.text,pauseAfterMs:300})));
   setSrtText(project.srt||'');
   setTargetAudioSec('');
  }
 },[project.id,project.script,project.srt,cleanNarrationText]);

 const commitCues=(next:SrtCue[])=>{
  cuesRef.current=next;
  setCues(next);
  setSrtText(formatSrt(next));
 };

 const runVadSegmentation=()=>{
  if(!rawText.trim()){
   return onNotice('Hãy nhập văn bản thô hoặc nạp từ Lời đọc sạch trước khi chia đoạn SRT.');
  }
  const targetN=Number(targetAudioSec);
  const generated=segmentVadLike(rawText,{
   wpm,
   pauseMs,
   maxWords,
   targetTotalSec:Number.isFinite(targetN)&&targetN>0?targetN:undefined
  });
  commitCues(generated);
  onNotice(`SRT Studio đã chia ${generated.length} dòng phụ đề theo khoảng nghỉ lời thoại (VAD-like).`);
 };

 const detectAudioDuration=(file:File)=>{
  const url=URL.createObjectURL(file);
  const audio=new Audio();
  audio.preload='metadata';
  audio.onloadedmetadata=()=>{
   const d=Math.round((audio.duration||0)*1000)/1000;
   if(d>0){
    setTargetAudioSec(String(d));
    onNotice(`Đã đọc độ dài thực của "${file.name}": ${d.toFixed(3)}s. Bấm "Tạo phụ đề SRT" để co giãn timestamp khớp độ dài này.`);
   }
   URL.revokeObjectURL(url);
  };
  audio.onerror=()=>{
   URL.revokeObjectURL(url);
   onNotice('Không đọc được metadata độ dài file audio.');
  };
  audio.src=url;
 };

 const timelineSpan=useMemo(()=>{
  const maxEnd=cues.reduce((m,c)=>Math.max(m,c.end),0);
  return Math.max(10,Math.ceil(maxEnd+1));
 },[cues]);

 const resolveOverlaps=()=>{
  const sorted=[...cues].sort((a,b)=>a.start-b.start);
  const fixed:SrtCue[]=[];
  for(const c of sorted){
   const prev=fixed[fixed.length-1];
   let start=Math.max(0,c.start);
   let end=Math.max(start+0.25,c.end);
   if(prev&&start<prev.end+0.05){
    const dur=Math.max(0.25,end-start);
    start=Math.round((prev.end+0.06)*1000)/1000;
    end=Math.round((start+dur)*1000)/1000;
   }
   fixed.push({...c,start,end});
  }
  commitCues(fixed);
  onNotice('Đã sắp xếp và khử chồng lấn mốc thời gian giữa các dòng phụ đề.');
 };

 const startDrag=(e:React.PointerEvent<HTMLElement>,index:number,mode:'move'|'start'|'end')=>{
  e.stopPropagation();
  const track=e.currentTarget.closest('[data-track="true"]') as HTMLElement|null;
  if(!track)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  dragRef.current={
   index,
   mode,
   originX:e.clientX,
   origStart:cues[index].start,
   origEnd:cues[index].end,
   barWidth:Math.max(120,track.getBoundingClientRect().width),
   totalSpan:timelineSpan
  };
 };

 const moveDrag=(e:React.PointerEvent<HTMLElement>)=>{
  const st=dragRef.current;
  if(!st)return;
  const deltaPx=e.clientX-st.originX;
  const deltaSec=(deltaPx/st.barWidth)*st.totalSpan;
  const round3=(v:number)=>Math.round(Math.max(0,v)*1000)/1000;
  const next=cuesRef.current.map((c,i)=>{
   if(i!==st.index)return c;
   if(st.mode==='move'){
    const dur=Math.max(0.25,st.origEnd-st.origStart);
    const nextStart=round3(st.origStart+deltaSec);
    return {...c,start:nextStart,end:round3(nextStart+dur)};
   }
   if(st.mode==='start'){
    const nextStart=round3(Math.min(st.origEnd-0.25,st.origStart+deltaSec));
    return {...c,start:nextStart};
   }
   const nextEnd=round3(Math.max(st.origStart+0.25,st.origEnd+deltaSec));
   return {...c,end:nextEnd};
  });
  commitCues(next);
 };

 const endDrag=(e:React.PointerEvent<HTMLElement>)=>{
  if(dragRef.current){
   try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
   dragRef.current=null;
  }
 };

 const overlapCount=useMemo(()=>{
  const sorted=[...cues].sort((a,b)=>a.start-b.start);
  let count=0;
  for(let i=1;i<sorted.length;i++){
   if(sorted[i].start<sorted[i-1].end-0.01)count++;
  }
  return count;
 },[cues]);

 const parsedSrtCount=parseSrt(srtText).length;
 const totalEnd=cues.length?Math.max(...cues.map(c=>c.end)):0;

 return <section className="panel">
  <div className="topbar" style={{marginBottom:14}}>
   <div>
    <div className="eyebrow">SRT STUDIO · VAD-LIKE SEGMENTATION &amp; DRAG TIMELINE</div>
    <h2 style={{margin:'4px 0 4px'}}><Captions size={16} style={{verticalAlign:'middle',marginRight:6}}/>SRT Studio — Chia đoạn theo khoảng nghỉ &amp; Kéo thả mốc thời gian</h2>
    <div className="muted">Nhập văn bản thô để tự động ngắt đoạn theo khoảng nghỉ của lời thoại (dấu ngắt câu, ngắt nhịp phẩy/chấm phẩy và ngắt đoạn), xuất file <code>.SRT</code> chuẩn và kéo thả chỉnh từng mốc thời gian.</div>
   </div>
   <div className="actions">
    <button className={quickEdit?'':'secondary'} onClick={()=>setQuickEdit(v=>!v)}>
     <Sliders size={14}/> {quickEdit?'Đang mở Chỉnh sửa nhanh':'Chỉnh sửa nhanh'}
    </button>
   </div>
  </div>

  <div className="panel subpanel">
   <div className="topbar" style={{marginBottom:10}}>
    <div>
     <b>1. Nhập văn bản thô &amp; Thông số khoảng nghỉ (VAD-like)</b>
     <div className="mini">Tự động nhận diện điểm nghỉ câu, dấu phẩy/ngắt nhịp và chuyển đoạn để chia cụm phụ đề dễ đọc.</div>
    </div>
    <div className="actions">
     <button className="secondary" disabled={!cleanNarrationText.trim()} onClick={()=>{setRawText(cleanNarrationText.trim());onNotice('Đã nạp văn bản từ ô Lời đọc sạch.');}}>Nạp Lời đọc sạch</button>
     <button className="ghost" disabled={!project.script.trim()} onClick={()=>{setRawText(project.script.trim());onNotice('Đã nạp văn bản từ Kịch bản gốc.');}}>Nạp Kịch bản gốc</button>
     <label className="fileLabel" style={{padding:'7px 10px',fontSize:12}} title="Đọc tổng độ dài file audio thực để co giãn timestamp khớp 100%">
      <Upload size={13}/> Khớp độ dài Audio thực
      <input type="file" accept="audio/*" onChange={e=>{const f=e.target.files?.[0];if(f)detectAudioDuration(f);}}/>
     </label>
    </div>
   </div>

   <div className="field">
    <textarea rows={5} value={rawText} onChange={e=>setRawText(e.target.value)} placeholder="Dán lời thoại thô tại đây (tự động nhận diện xuống đoạn, dấu chấm, phẩy, chấm phẩy để tạo khoảng nghỉ)..."/>
   </div>

   <div className="grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
    <div className="field">
     <label>Tốc độ đọc (từ/phút)</label>
     <input type="number" min="80" max="220" value={wpm} onChange={e=>setWpm(Math.max(80,Math.min(220,Number(e.target.value)||135)))}/>
    </div>
    <div className="field">
     <label>Khoảng nghỉ câu (ms)</label>
     <input type="number" min="100" max="1500" step="20" value={pauseMs} onChange={e=>setPauseMs(Math.max(100,Math.min(1500,Number(e.target.value)||320)))}/>
    </div>
    <div className="field">
     <label>Tối đa từ / phụ đề</label>
     <input type="number" min="6" max="24" value={maxWords} onChange={e=>setMaxWords(Math.max(6,Math.min(24,Number(e.target.value)||12)))}/>
    </div>
    <div className="field">
     <label>Tổng thời lượng đích (giây, tùy chọn)</label>
     <input type="number" min="0" step="0.1" value={targetAudioSec} onChange={e=>setTargetAudioSec(e.target.value)} placeholder="Để trống = theo WPM"/>
    </div>
   </div>

   <div className="actions">
    <button onClick={runVadSegmentation} disabled={!rawText.trim()}>
     <Wand2 size={14}/> Tạo phụ đề SRT (VAD-like)
    </button>
    {cues.length>0&&<span className="chip">{cues.length} dòng phụ đề · Tổng {fmt(totalEnd)}</span>}
    {overlapCount>0&&<button className="warn" onClick={resolveOverlaps}><Scissors size={14}/> Khử {overlapCount} đoạn chồng lấn</button>}
   </div>
  </div>

  {quickEdit&&<div className="panel subpanel">
   <div className="topbar" style={{marginBottom:10}}>
    <div>
     <b>2. Chỉnh sửa nhanh — Kéo thả điều chỉnh mốc thời gian từng dòng phụ đề</b>
     <div className="mini">Kéo phần thân thanh màu xanh để dời cả dòng phụ đề, hoặc kéo 2 mép trái/phải để nới chỉnh chính xác mốc Bắt đầu / Kết thúc.</div>
    </div>
    <div className="actions">
     <button className="secondary" onClick={()=>{
      const lastEnd=cues.length?cues[cues.length-1].end:0;
      commitCues([...cues,{id:`CUE_${Date.now()}`,start:Math.round((lastEnd+0.3)*1000)/1000,end:Math.round((lastEnd+2.5)*1000)/1000,text:'Dòng phụ đề mới',pauseAfterMs:pauseMs}]);
     }}><Plus size={13}/> Thêm dòng</button>
    </div>
   </div>

   {!cues.length?<p className="muted">Chưa có dòng phụ đề. Hãy dán văn bản thô ở bước 1 và bấm “Tạo phụ đề SRT (VAD-like)”.</p>:
   <div style={{display:'grid',gap:10,maxHeight:430,overflow:'auto',paddingRight:4}}>
    {cues.map((cue,idx)=>{
     const leftPct=Math.max(0,Math.min(98,(cue.start/timelineSpan)*100));
     const widthPct=Math.max(3,Math.min(100-leftPct,((cue.end-cue.start)/timelineSpan)*100));
     return <div key={cue.id} className="qaItem" style={{marginBottom:0,background:'#142033'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:8}}>
       <b>#{idx+1} · {fmt(cue.start)} → {fmt(cue.end)} <span className="mini">({(cue.end-cue.start).toFixed(2)}s)</span></b>
       <div className="actions">
        <label className="mini" style={{display:'inline-flex',alignItems:'center',gap:4}}>
         Start(s)
         <input type="number" step="0.05" min="0" style={{width:78,padding:'4px 7px'}} value={cue.start} onChange={e=>{
          const val=Math.max(0,Number(e.target.value)||0);
          commitCues(cues.map((x,i)=>i===idx?{...x,start:val,end:Math.max(val+0.25,x.end)}:x));
         }}/>
        </label>
        <label className="mini" style={{display:'inline-flex',alignItems:'center',gap:4}}>
         End(s)
         <input type="number" step="0.05" min="0.25" style={{width:78,padding:'4px 7px'}} value={cue.end} onChange={e=>{
          const val=Math.max(cue.start+0.25,Number(e.target.value)||0.25);
          commitCues(cues.map((x,i)=>i===idx?{...x,end:val}:x));
         }}/>
        </label>
        <button className="warn" style={{padding:'5px 8px'}} onClick={()=>commitCues(cues.filter((_,i)=>i!==idx))} title="Xóa dòng phụ đề"><Trash2 size={12}/></button>
       </div>
      </div>

      {/* Interactive Timeline Drag Track */}
      <div
       data-track="true"
       style={{position:'relative',height:28,background:'#0c1524',border:'1px solid #2b3c53',borderRadius:7,marginBottom:8,overflow:'hidden',userSelect:'none',touchAction:'none'}}
      >
       <div
        onPointerDown={e=>startDrag(e,idx,'move')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Kéo để di chuyển toàn bộ mốc thời gian của dòng phụ đề"
        style={{
         position:'absolute',
         top:3,
         bottom:3,
         left:`${leftPct}%`,
         width:`${widthPct}%`,
         background:'#396dd9',
         borderRadius:5,
         cursor:'grab',
         display:'flex',
         alignItems:'center',
         justifyContent:'space-between',
         border:'1px solid #74a9ff'
        }}
       >
        <span
         onPointerDown={e=>startDrag(e,idx,'start')}
         onPointerMove={moveDrag}
         onPointerUp={endDrag}
         onPointerCancel={endDrag}
         title="Kéo mép trái để chỉnh thời điểm Bắt đầu"
         style={{width:9,height:'100%',background:'#9bc4ff',borderRadius:'4px 0 0 4px',cursor:'ew-resize',flexShrink:0}}
        />
        <span style={{fontSize:10,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'0 4px',pointerEvents:'none'}}>
         {cue.start.toFixed(2)}s – {cue.end.toFixed(2)}s
        </span>
        <span
         onPointerDown={e=>startDrag(e,idx,'end')}
         onPointerMove={moveDrag}
         onPointerUp={endDrag}
         onPointerCancel={endDrag}
         title="Kéo mép phải để chỉnh thời điểm Kết thúc"
         style={{width:9,height:'100%',background:'#9bc4ff',borderRadius:'0 4px 4px 0',cursor:'ew-resize',flexShrink:0}}
        />
       </div>
      </div>

      <input
       value={cue.text}
       onChange={e=>commitCues(cues.map((x,i)=>i===idx?{...x,text:e.target.value}:x))}
       placeholder="Nội dung dòng phụ đề..."
      />
     </div>;
    })}
   </div>}
  </div>}

  <div className="field">
   <label>Xem trước &amp; Xuất file .SRT chuẩn ({parsedSrtCount} đoạn hợp lệ)</label>
   <textarea rows={6} value={srtText} onChange={e=>{
    setSrtText(e.target.value);
    const reparsed=parseSrt(e.target.value);
    if(reparsed.length){
     setCues(reparsed.map((x,i)=>({id:`EDIT_${i}`,start:x.start,end:x.end,text:x.text,pauseAfterMs:pauseMs})));
    }
   }} placeholder={'1\n00:00:00,000 --> 00:00:02,800\nĐoạn phụ đề thứ nhất...'}/>
  </div>

  <div className="actions">
   <button disabled={!parsedSrtCount} onClick={()=>{download('VOICE_STUDIO_SUBTITLES.srt',srtText);onNotice('Đã xuất file VOICE_STUDIO_SUBTITLES.srt');}}>
    <Download size={14}/> Xuất file .SRT
   </button>
   <button className="secondary" disabled={!parsedSrtCount} onClick={()=>{onApplyProjectSrt(srtText);onNotice(`Đã đồng bộ ${parsedSrtCount} đoạn SRT vào dự án (dùng cho Storyboard & Chapters YouTube).`);}}>
    <CheckCircle2 size={14}/> Áp dụng vào SRT dự án ({parsedSrtCount})
   </button>
   <button className="ghost" disabled={!srtText.trim()} onClick={()=>{navigator.clipboard.writeText(srtText).then(()=>onNotice('Đã sao chép nội dung .SRT vào clipboard.')).catch(()=>onNotice('Không thể sao chép tự động, hãy copy từ ô SRT.'));}}>
    <Copy size={14}/> Copy SRT
   </button>
  </div>
 </section>;
}
