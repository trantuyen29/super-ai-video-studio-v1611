import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Volume2,Download,Copy,Play,Pause,Square,Sparkles,Globe,ExternalLink,Mic} from 'lucide-react';
import {Project} from './core';

type VoiceMode='gemini'|'browser';
type LangFilter='all'|'vi'|'en';

const GEMINI_VOICES=[
 {id:'Kore',label:'Kore — Rõ ràng, cân bằng (Khuyên dùng kể chuyện)'},
 {id:'Puck',label:'Puck — Tươi sáng, nhanh nhẹn, thân thiện'},
 {id:'Charon',label:'Charon — Trầm ấm, chững chạc, chiều sâu'},
 {id:'Fenrir',label:'Fenrir — Mạnh mẽ, kịch tính, dứt khoát'},
 {id:'Zephyr',label:'Zephyr — Nhẹ nhàng, tự nhiên, dịu mắt'}
];

const STYLE_PRESETS=[
 'Kể chuyện truyền cảm, nhịp vừa phải, ngắt nghỉ tự nhiên, phát âm rõ tiếng Việt',
 'Hài ấm áp kiểu Phố Lắc Lư, gần gũi, nhấn nhá duyên dáng',
 'Tin tức / phân tích mạch lạc, tốc độ ổn định, chuyên nghiệp',
 'Bí ẩn, trầm lắng, tăng nhẹ kịch tính ở câu chốt'
];

const FREE_TTS_TOOLS=[
 {name:'TTSMaker (Miễn phí, xuất MP3/WAV)',url:'https://ttsmaker.com/'},
 {name:'Microsoft Clipchamp (Giọng Hoài My / Nam Minh)',url:'https://app.clipchamp.com/'},
 {name:'CapCut Text-to-Speech (Xuất voiceover trực tiếp)',url:'https://www.capcut.com/tools/text-to-speech'}
];

function splitSpeechChunks(text:string,maxLen=240):string[]{
 const clean=text.replace(/\s+/g,' ').trim();
 if(!clean)return [];
 const sentences=clean.match(/[^.!?\n。！？]+(?:[.!?\n。！？]+|$)/g)?.map(s=>s.trim()).filter(Boolean)||[clean];
 const out:string[]=[];
 let current='';
 for(const sent of sentences){
  if(sent.length>maxLen){
   if(current){out.push(current);current='';}
   const words=sent.split(/\s+/);
   let part='';
   for(const w of words){
    if((part+' '+w).trim().length>maxLen){
     if(part)out.push(part);
     part=w;
    }else{
     part=(part+' '+w).trim();
    }
   }
   if(part)out.push(part);
   continue;
  }
  if((current+' '+sent).trim().length>maxLen){
   if(current)out.push(current);
   current=sent;
  }else{
   current=(current+' '+sent).trim();
  }
 }
 if(current)out.push(current);
 return out;
}

function base64ToWavUrl(base64:string):string{
 const bin=atob(base64);
 const bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const blob=new Blob([bytes],{type:'audio/wav'});
 return URL.createObjectURL(blob);
}

export function VoiceoverStudio({project,cleanNarrationText,onNotice}:{project:Project;cleanNarrationText?:string;onNotice:(msg:string)=>void}){
 const [mode,setMode]=useState<VoiceMode>('gemini');
 const [selectedSceneId,setSelectedSceneId]=useState<string>(()=>(cleanNarrationText?.trim()?'CLEAN':'ALL'));
 const [text,setText]=useState<string>(()=>(cleanNarrationText?.trim()||project.scenes.map(s=>s.narration).filter(Boolean).join(' ')||project.script||'').trim());

 // Gemini AI TTS state
 const [voiceName,setVoiceName]=useState<string>('Kore');
 const [stylePrompt,setStylePrompt]=useState<string>(STYLE_PRESETS[0]);
 const [busy,setBusy]=useState<boolean>(false);
 const [ttsError,setTtsError]=useState<string>('');
 const [wavUrl,setWavUrl]=useState<string>('');
 const [wavInfo,setWavInfo]=useState<{voice:string;sampleRate:number;fallbackUsed:boolean}|null>(null);

 // Browser Web Speech API state
 const [speechSupported]=useState<boolean>(()=>typeof window!=='undefined'&&'speechSynthesis' in window);
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
 const [langFilter,setLangFilter]=useState<LangFilter>('vi');
 const [selectedVoiceUri,setSelectedVoiceUri]=useState<string>('');
 const [rate,setRate]=useState<number>(1.0);
 const [pitch,setPitch]=useState<number>(1.0);
 const [speakingState,setSpeakingState]=useState<'idle'|'playing'|'paused'>('idle');
 const [chunkProgress,setChunkProgress]=useState<{current:number;total:number}>({current:0,total:0});
 const stopFlagRef=useRef<boolean>(false);
 const prevProjectIdRef=useRef<string>(project.id);

 // Reset editor text cleanly when switching project
 useEffect(()=>{
  if(prevProjectIdRef.current!==project.id){
   prevProjectIdRef.current=project.id;
   setText((cleanNarrationText?.trim()||project.scenes.map(s=>s.narration).filter(Boolean).join(' ')||project.script||'').trim());
   setSelectedSceneId(cleanNarrationText?.trim()?'CLEAN':'ALL');
   setTtsError('');
   setWavInfo(null);
   setWavUrl(old=>{if(old)URL.revokeObjectURL(old);return '';});
  }
 },[project.id,project.scenes,project.script,cleanNarrationText]);

 // Clean up WAV objectURL & Web Speech on unmount
 useEffect(()=>{
  return()=>{
   if(typeof window!=='undefined'&&'speechSynthesis' in window){
    window.speechSynthesis.cancel();
   }
  };
 },[]);

 useEffect(()=>{
  return()=>{
   if(wavUrl)URL.revokeObjectURL(wavUrl);
  };
 },[wavUrl]);

 // Load browser speech voices
 useEffect(()=>{
  if(!speechSupported)return;
  const loadVoices=()=>{
   const list=window.speechSynthesis.getVoices()||[];
   setVoices(list);
   if(list.length){
    setSelectedVoiceUri(prev=>{
     if(prev&&list.some(v=>v.voiceURI===prev))return prev;
     const edgeVi=list.find(v=>v.lang.toLowerCase().startsWith('vi')&&/hoaimy|namminh|natural/i.test(v.name));
     const anyVi=list.find(v=>v.lang.toLowerCase().startsWith('vi'));
     return (edgeVi||anyVi||list[0]).voiceURI;
    });
   }
  };
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged',loadVoices);
  return()=>{
   window.speechSynthesis.removeEventListener?.('voiceschanged',loadVoices);
  };
 },[speechSupported]);

 const filteredVoices=useMemo(()=>{
  if(langFilter==='vi')return voices.filter(v=>v.lang.toLowerCase().startsWith('vi'));
  if(langFilter==='en')return voices.filter(v=>v.lang.toLowerCase().startsWith('en'));
  return voices;
 },[voices,langFilter]);

 useEffect(()=>{
  if(filteredVoices.length&&!filteredVoices.some(v=>v.voiceURI===selectedVoiceUri)){
   setSelectedVoiceUri(filteredVoices[0].voiceURI);
  }
 },[filteredVoices,selectedVoiceUri]);

 const loadFromStoryboard=(sceneId:string)=>{
  setSelectedSceneId(sceneId);
  if(sceneId==='CLEAN'){
   const cleanVal=(cleanNarrationText||'').trim();
   if(!cleanVal)return onNotice('Ô "Lời đọc sạch" đang trống.');
   setText(cleanVal);
   onNotice(`Đã nạp Lời đọc sạch (${cleanVal.length.toLocaleString('vi-VN')} ký tự).`);
   return;
  }
  if(sceneId==='ALL'){
   const all=project.scenes.map(s=>s.narration).filter(Boolean).join(' ').trim();
   if(!all)return onNotice('Storyboard chưa có lời đọc để nạp.');
   setText(all);
   onNotice(`Đã nạp lời đọc từ ${project.scenes.length} cảnh Storyboard.`);
   return;
  }
  if(sceneId==='SCRIPT'){
   if(!project.script.trim())return onNotice('Kịch bản gốc đang trống.');
   setText(project.script.trim());
   onNotice('Đã nạp toàn bộ lời từ Kịch bản gốc.');
   return;
  }
  const sc=project.scenes.find(s=>s.id===sceneId);
  if(sc){
   setText(sc.narration.trim());
   onNotice(`Đã nạp lời đọc của cảnh ${sc.id}.`);
  }
 };

 const copyNarration=()=>{
  if(!text.trim())return onNotice('Chưa có lời bình để sao chép.');
  navigator.clipboard.writeText(text.trim())
   .then(()=>onNotice(`Đã sao chép ${text.trim().length.toLocaleString('vi-VN')} ký tự lời bình vào clipboard.`))
   .catch(()=>onNotice('Trình duyệt chặn sao chép tự động, hãy chọn và copy trực tiếp trong ô văn bản.'));
 };

 const generateGeminiWav=async()=>{
  const clean=text.trim();
  if(!clean)return onNotice('Hãy nhập hoặc nạp lời bình trước khi tạo giọng đọc AI.');
  if(clean.length>5000){
   return setTtsError('Văn bản vượt quá 5.000 ký tự/lượt của Gemini AI TTS. Hãy chọn từng cảnh ở mục "Nguồn lời bình" hoặc chuyển sang chế độ "Đọc Trình duyệt (Miễn phí)" hỗ trợ tới 12.000 ký tự.');
  }
  setBusy(true);
  setTtsError('');
  try{
   const res=await fetch('/api/tts',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:clean,voiceName,stylePrompt})
   });
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'Không tạo được âm thanh từ Gemini TTS.');
   const nextUrl=base64ToWavUrl(String(data.audioBase64));
   setWavUrl(old=>{if(old)URL.revokeObjectURL(old);return nextUrl;});
   setWavInfo({
    voice:String(data.voice||voiceName),
    sampleRate:Number(data.sampleRate||24000),
    fallbackUsed:Boolean(data.fallbackUsed)
   });
   onNotice(`Đã tạo xong file giọng đọc .WAV (24kHz · ${data.voice||voiceName})${data.fallbackUsed?' qua cơ chế fallback sắc thái':''}.`);
  }catch(err){
   const msg=String(err instanceof Error?err.message:err);
   setTtsError(msg);
   onNotice(msg);
  }finally{
   setBusy(false);
  }
 };

 const downloadWav=()=>{
  if(!wavUrl)return;
  const safeName=(project.name||'storyboard').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,40);
  const a=document.createElement('a');
  a.href=wavUrl;
  a.download=`VOICEOVER_${safeName}_${selectedSceneId}.wav`;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();
 };

 const stopBrowserSpeech=()=>{
  stopFlagRef.current=true;
  if(speechSupported){
   window.speechSynthesis.cancel();
  }
  setSpeakingState('idle');
  setChunkProgress({current:0,total:0});
 };

 const playBrowserSpeech=()=>{
  if(!speechSupported)return onNotice('Trình duyệt hiện tại không hỗ trợ Web Speech API.');
  const clean=text.trim();
  if(!clean)return onNotice('Hãy nhập lời bình trước khi phát đọc.');
  if(clean.length>12000){
   return onNotice('Chế độ Đọc Trình duyệt hỗ trợ tối đa 12.000 ký tự/lần. Hãy cắt bớt hoặc nạp từng phần.');
  }
  if(speakingState==='paused'){
   window.speechSynthesis.resume();
   setSpeakingState('playing');
   return;
  }
  window.speechSynthesis.cancel();
  stopFlagRef.current=false;
  const chunks=splitSpeechChunks(clean,240);
  if(!chunks.length)return;
  const chosenVoice=voices.find(v=>v.voiceURI===selectedVoiceUri);
  setSpeakingState('playing');
  setChunkProgress({current:1,total:chunks.length});

  const speakAt=(idx:number)=>{
   if(stopFlagRef.current||idx>=chunks.length){
    setSpeakingState('idle');
    setChunkProgress({current:0,total:0});
    return;
   }
   setChunkProgress({current:idx+1,total:chunks.length});
   const utter=new SpeechSynthesisUtterance(chunks[idx]);
   if(chosenVoice){
    utter.voice=chosenVoice;
    utter.lang=chosenVoice.lang;
   }else{
    utter.lang=langFilter==='en'?'en-US':'vi-VN';
   }
   utter.rate=rate;
   utter.pitch=pitch;
   utter.onend=()=>{
    if(!stopFlagRef.current)speakAt(idx+1);
   };
   utter.onerror=()=>{
    if(!stopFlagRef.current){
     setSpeakingState('idle');
     setChunkProgress({current:0,total:0});
     onNotice('Phát giọng đọc trình duyệt bị gián đoạn. Hãy thử chọn giọng khác (khuyên dùng Microsoft Edge với Hoài My / Nam Minh).');
    }
   };
   window.speechSynthesis.speak(utter);
  };
  speakAt(0);
 };

 const pauseBrowserSpeech=()=>{
  if(!speechSupported||speakingState!=='playing')return;
  window.speechSynthesis.pause();
  setSpeakingState('paused');
 };

 const charCount=text.trim().length;
 const limitMax=mode==='gemini'?5000:12000;

 return <section className="panel">
  <div className="topbar" style={{marginBottom:14}}>
   <div>
    <div className="eyebrow">DIRECTORAI VOICEOVER · V1BETA &amp; WEB SPEECH</div>
    <h2 style={{margin:'4px 0 4px'}}><Mic size={16} style={{verticalAlign:'middle',marginRight:6}}/>Phòng Thu Giọng Đọc AI (DirectorAI Voiceover)</h2>
    <div className="muted">Đã chuyển TTS sang <b>v1beta</b> (<code>gemini-3.8-flash-lite-tts</code>, trả file <b>.WAV 24kHz</b> + fallback tự động giữ sắc thái) và tích hợp đọc miễn phí không giới hạn quota ngay trên trình duyệt.</div>
   </div>
   <div className="actions">
    <button className={mode==='gemini'?'':'secondary'} onClick={()=>{stopBrowserSpeech();setMode('gemini');}}>
     <Sparkles size={14}/> Gemini AI TTS (.WAV 24kHz)
    </button>
    <button className={mode==='browser'?'':'secondary'} onClick={()=>setMode('browser')}>
     <Globe size={14}/> Đọc Trình duyệt (Miễn phí)
    </button>
   </div>
  </div>

  <div className="panel subpanel">
   <div className="topbar" style={{marginBottom:10}}>
    <div>
     <b>Nguồn lời bình từ Storyboard / Kịch bản</b>
     <div className="mini">Nạp nhanh lời đọc từng cảnh hoặc toàn bộ Storyboard để thu âm và khớp nhịp đọc.</div>
    </div>
    <div className="actions">
     <select style={{maxWidth:220}} value={selectedSceneId} onChange={e=>loadFromStoryboard(e.target.value)}>
      {cleanNarrationText!==undefined&&<option value="CLEAN">Lời đọc sạch (Clean Narration)</option>}
      <option value="ALL">Toàn bộ Storyboard ({project.scenes.length} cảnh)</option>
      <option value="SCRIPT">Toàn bộ Kịch bản gốc</option>
      {project.scenes.map(s=><option key={s.id} value={s.id}>{s.id} ({(s.end-s.start).toFixed(1)}s)</option>)}
     </select>
     {cleanNarrationText!==undefined&&<button className="secondary" onClick={()=>loadFromStoryboard('CLEAN')} disabled={!cleanNarrationText.trim()}>Nạp Lời đọc sạch</button>}
     <button className="secondary" onClick={()=>loadFromStoryboard('ALL')} disabled={!project.scenes.length}>Nạp Storyboard</button>
     <button className="ghost" onClick={copyNarration} disabled={!charCount}><Copy size={14}/> Sao chép lời bình nhanh</button>
    </div>
   </div>

   <div className="field" style={{marginBottom:6}}>
    <textarea rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder="Lời bình sẽ tự lấy từ Storyboard hoặc bạn có thể dán / chỉnh sửa trực tiếp tại đây..."/>
   </div>
   <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
    <span className={charCount>limitMax?'mini danger':'mini'}>
     {charCount.toLocaleString('vi-VN')} / {limitMax.toLocaleString('vi-VN')} ký tự ({mode==='gemini'?'giới hạn mỗi lượt Gemini AI TTS':'giới hạn Đọc Trình duyệt miễn phí'})
    </span>
    <span className="mini">Ước tính đọc (~135 từ/phút): {text.trim()?Math.max(1,Math.round((text.trim().split(/\s+/).length/135)*60)):0} giây</span>
   </div>
  </div>

  {mode==='gemini'&&<div className="panel subpanel">
   <div className="grid">
    <div className="field">
     <label>Giọng đọc AI (Prebuilt Voice · v1beta)</label>
     <select value={voiceName} onChange={e=>setVoiceName(e.target.value)}>
      {GEMINI_VOICES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
     </select>
    </div>
    <div className="field">
     <label>Chỉ đạo sắc thái (speechMetadata.style + fallback tự động)</label>
     <input value={stylePrompt} onChange={e=>setStylePrompt(e.target.value)} placeholder="VD: Trầm ấm, kể chuyện chậm rãi, ngắt nghỉ rõ ràng..."/>
    </div>
   </div>
   <div className="actions" style={{marginBottom:12}}>
    {STYLE_PRESETS.map((preset,idx)=><button key={idx} className="ghost" style={{fontSize:11,padding:'6px 10px'}} onClick={()=>setStylePrompt(preset)}>{preset.split(',')[0]}</button>)}
   </div>
   <div className="actions">
    <button onClick={generateGeminiWav} disabled={busy||!charCount}>
     <Volume2 size={15}/> {busy?'Đang tổng hợp giọng đọc .WAV (v1beta)...':'Tạo giọng đọc AI (.WAV 24kHz)'}
    </button>
    {wavUrl&&<button className="secondary" onClick={downloadWav}>
     <Download size={15}/> Tải xuống .WAV (24kHz)
    </button>}
   </div>
   {ttsError&&<div className="qaItem" style={{marginTop:12,borderColor:'#a8484d'}}>
    <b className="danger">Thông báo Gemini TTS:</b> {ttsError}
    <div className="actions" style={{marginTop:8}}>
     <button className="secondary" onClick={()=>setMode('browser')}>Chuyển ngay sang Đọc Trình duyệt (Miễn phí)</button>
    </div>
   </div>}
   {wavUrl&&<div className="qaItem" style={{marginTop:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:8}}>
     <b className="success">File âm thanh .WAV ({wavInfo?.sampleRate||24000}Hz · Giọng {wavInfo?.voice})</b>
     <span className="mini">{wavInfo?.fallbackUsed?'Đã dùng fallback giữ nguyên sắc thái vào chỉ dẫn văn bản':'Đã áp dụng speechMetadata + speechConfig qua v1beta'}</span>
    </div>
    <audio controls src={wavUrl} style={{width:'100%'}}/>
   </div>}
  </div>}

  {mode==='browser'&&<div className="panel subpanel">
   <div className="qaItem" style={{marginBottom:12}}>
    <b>Miễn phí 100% · Không tốn API quota (Web Speech API):</b> Hỗ trợ tối đa <b>12.000 ký tự/lần</b>. Khuyên dùng trình duyệt <b>Microsoft Edge</b> để có sẵn giọng Tiếng Việt <b>Hoài My</b> / <b>Nam Minh</b> đọc rất tự nhiên.
   </div>
   {!speechSupported?<p className="danger">Trình duyệt này không hỗ trợ Web Speech API (`window.speechSynthesis`).</p>:<>
    <div className="grid3">
     <div className="field">
      <label>Ngôn ngữ giọng đọc</label>
      <select value={langFilter} onChange={e=>setLangFilter(e.target.value as LangFilter)}>
       <option value="vi">Tiếng Việt (vi-VN)</option>
       <option value="en">Tiếng Anh (en-US / en-GB)</option>
       <option value="all">Tất cả giọng hệ thống ({voices.length})</option>
      </select>
     </div>
     <div className="field" style={{gridColumn:'span 2'}}>
      <label>Chọn giọng trình duyệt ({filteredVoices.length} giọng khả dụng)</label>
      <select value={selectedVoiceUri} onChange={e=>setSelectedVoiceUri(e.target.value)}>
       {!filteredVoices.length&&<option value="">Đang dùng giọng mặc định của hệ thống</option>}
       {filteredVoices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
      </select>
     </div>
    </div>
    <div className="grid">
     <div className="field">
      <label>Tốc độ đọc: {rate.toFixed(2)}x (0.65x – 1.40x)</label>
      <input type="range" min="0.65" max="1.40" step="0.05" value={rate} onChange={e=>setRate(Number(e.target.value))}/>
     </div>
     <div className="field">
      <label>Cao độ (Pitch): {pitch.toFixed(2)}</label>
      <input type="range" min="0.70" max="1.30" step="0.05" value={pitch} onChange={e=>setPitch(Number(e.target.value))}/>
     </div>
    </div>
    <div className="actions">
     <button onClick={playBrowserSpeech} disabled={!charCount||speakingState==='playing'}>
      <Play size={14}/> {speakingState==='paused'?'Tiếp tục đọc':'Phát đọc miễn phí'}
     </button>
     <button className="secondary" onClick={pauseBrowserSpeech} disabled={speakingState!=='playing'}>
      <Pause size={14}/> Tạm dừng
     </button>
     <button className="warn" onClick={stopBrowserSpeech} disabled={speakingState==='idle'}>
      <Square size={14}/> Dừng
     </button>
     {chunkProgress.total>0&&<span className="chip">Đang đọc đoạn {chunkProgress.current}/{chunkProgress.total}</span>}
    </div>
   </>}
  </div>}

  <div className="divider"/>
  <div>
   <b>Cần render MP3 / WAV cho kịch bản dài không giới hạn quota?</b>
   <p className="mini" style={{margin:'4px 0 10px'}}>Sao chép nhanh lời bình bên trên và mở một trong các công cụ TTS miễn phí bên dưới để xuất file âm thanh dài đưa vào CapCut:</p>
   <div className="actions">
    <button className="secondary" onClick={copyNarration} disabled={!charCount}><Copy size={13}/> Copy lời bình ({charCount.toLocaleString('vi-VN')} ký tự)</button>
    {FREE_TTS_TOOLS.map(tool=><a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer" className="fileLabel" style={{textDecoration:'none'}}>
     <ExternalLink size={13}/> {tool.name}
    </a>)}
   </div>
  </div>
 </section>;
}
