import express from 'express';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import dotenv from 'dotenv';
import {GoogleGenAI,Type} from '@google/genai';
dotenv.config();
const app=express();app.use(express.json({limit:'2mb'}));
const DEFAULT_MODEL=process.env.GEMINI_MODEL||'gemini-4-hydrogen';
function createAiClient(){
 const key=process.env.GEMINI_API_KEY;
 if(!key)return null;
 return new GoogleGenAI({apiKey:key,httpOptions:{headers:{'User-Agent':'aistudio-build'}}});
}
function createTtsClient(){
 const key=process.env.GEMINI_API_KEY;
 if(!key)return null;
 return new GoogleGenAI({apiKey:key,apiVersion:'v1beta',httpOptions:{headers:{'User-Agent':'aistudio-build'}}});
}
function ensureWavBuffer(rawBytes:Buffer,mimeType:string):Buffer{
 if(rawBytes.length>=4&&rawBytes.subarray(0,4).toString('ascii')==='RIFF'){
  return rawBytes;
 }
 // Wrap raw PCM (24kHz, mono, 16-bit LE) in a 44-byte RIFF WAV header when needed
 const sampleRate=24000;
 const numChannels=1;
 const bitsPerSample=16;
 const byteRate=sampleRate*numChannels*(bitsPerSample/8);
 const blockAlign=numChannels*(bitsPerSample/8);
 const dataSize=rawBytes.length;
 const header=Buffer.alloc(44);
 header.write('RIFF',0);
 header.writeUInt32LE(36+dataSize,4);
 header.write('WAVE',8);
 header.write('fmt ',12);
 header.writeUInt32LE(16,16);
 header.writeUInt16LE(1,20);
 header.writeUInt16LE(numChannels,22);
 header.writeUInt32LE(sampleRate,24);
 header.writeUInt32LE(byteRate,28);
 header.writeUInt16LE(blockAlign,32);
 header.writeUInt16LE(bitsPerSample,34);
 header.write('data',36);
 header.writeUInt32LE(dataSize,40);
 void mimeType;
 return Buffer.concat([header,rawBytes]);
}
app.get('/api/health',(_req,res)=>res.json({ok:true,aiConfigured:Boolean(process.env.GEMINI_API_KEY)}));
app.post('/api/director',async(req,res)=>{
 try{
  const ai=createAiClient();
  if(!ai)return res.status(503).json({error:'Chưa cấu hình GEMINI_API_KEY ở server. Bạn vẫn có thể tạo prompt bằng mẫu nội bộ.'});
  const {narration,style,characters,location,reference,previous,next,duration,ratio}=req.body??{};
  if(typeof narration!=='string'||!narration.trim()||narration.length>6000)return res.status(400).json({error:'Lời đọc cần từ 1 đến 6000 ký tự.'});
  const durationN=Number(duration);
  if(!(durationN>=1&&durationN<=15))return res.status(400).json({error:'Độ dài clip phải từ 1 đến 15 giây.'});
  const response=await ai.models.generateContent({model:DEFAULT_MODEL,contents:`You are a professional stickman animation director. Return ONLY a complete detailed GROK VIDEO prompt in ENGLISH, no markdown, no JSON. Do not claim you generated video. Describe one visually coherent action within ${durationN}s for ${ratio||'16:9'}. Make the action match narration. Preserve reference-image identities, linework, wardrobe, color, clues, camera axis and scene continuity. Avoid text rendering, scene cuts and identity drift.\nArt style: ${String(style||'minimal 2D editorial stickman').slice(0,1200)}\nCharacters: ${String(characters||'CHAR_01').slice(0,500)}\nLocation: ${String(location||'not specified').slice(0,500)}\nReference IDs: ${String(reference||'REF_STYLE; REF_CHAR_01').slice(0,500)}\nPrior scene continuity: ${String(previous||'first shot').slice(0,800)}\nNext scene continuity: ${String(next||'final hold').slice(0,800)}\nNarration: ${narration}`});
  res.json({prompt:response.text?.trim()||''});
 }catch(err:any){res.status(502).json({error:'Gemini không trả kết quả hợp lệ: '+String(err?.message||err).slice(0,250)})}
});
app.post('/api/seo',async(req,res)=>{
 try{
  const ai=createAiClient();
  if(!ai)return res.status(503).json({error:'Chưa cấu hình GEMINI_API_KEY ở server. Bạn vẫn có thể dùng nút "Tạo SEO bằng mẫu".'});
  const {projectName,topic,ratio,clipDuration,script,srtText,chapters,scriptInsights,scenes,styleName,styleDescription,palette,channel,genre,audience,language,characters,locations}=req.body??{};
  const hasContext=[projectName,topic,script,srtText].some(v=>typeof v==='string'&&v.trim().length>0)||(Array.isArray(scenes)&&scenes.length>0);
  if(!hasContext)return res.status(400).json({error:'Hãy nhập chủ đề, kịch bản hoặc SRT trước khi tạo SEO.'});
  const sceneLines=Array.isArray(scenes)?scenes.slice(0,30).map((s:any)=>`${String(s?.timecode||'00:00')} - ${String(s?.narration||'').slice(0,160)}`).join('\n'):'';
  const charText=Array.isArray(characters)&&characters.length?characters.map((c:any)=>`${c.name||''} (${c.look||''}, ${c.wardrobe||''})`).join('; '):'CHAR_01 main stickman character';
  const locText=Array.isArray(locations)&&locations.length?locations.map((l:any)=>`${l.name||''} [${l.palette||''}]`).join('; '):'Story setting';
  const langLabel=language==='en-US'?'English (US)':'Vietnamese';
  const isShorts=ratio==='9:16';
  const formatGuide=isShorts
   ?'FORMAT: 9:16 YouTube Shorts (1080x1920). Keep title punchy under 60 chars (include #Shorts if helpful), write concise vertical-viewer hook in description, include #Shorts in tags/hashtags, and design a 9:16 cover frame avoiding top 15% and bottom 25% UI safe zones.'
   :'FORMAT: 16:9 Long-form YouTube Video (1280x720 Thumbnail). Optimize title at 50–70 chars (max 100), front-load the primary keyword from the script & topic in the first 40 chars, put primary keyword + story hook in the first 160 chars of description (above the fold), include YouTube Chapters starting at 00:00, keep tags under 450 chars + 3–5 hashtags, and design a 16:9 (1280x720) thumbnail avoiding the bottom-right duration badge zone.';
  const insightsBlock=scriptInsights?`[EXTRACTED SCRIPT INSIGHTS]
- Opening Hook: ${String(scriptInsights.hookSentence||'').slice(0,300)}
- Climax / Turning Point: ${String(scriptInsights.climaxSentence||'').slice(0,300)}
- Key Phrases from Script: ${Array.isArray(scriptInsights.scriptPhrases)?scriptInsights.scriptPhrases.join(', ').slice(0,500):''}
- Character / Entity Names in Script: ${Array.isArray(scriptInsights.properNames)?scriptInsights.properNames.join(', ').slice(0,200):''}\n\n`:'';
  const response=await ai.models.generateContent({
   model:DEFAULT_MODEL,
   contents:`You are a senior YouTube SEO Strategist and 2D Stickman Animation Art Director.
Generate a complete, truthful (zero clickbait/misleading claims) YouTube SEO & Thumbnail Pack by deeply mining the FULL SCRIPT (Kịch bản), SRT, and Overview (Tổng quan) data below.
CRITICAL: Do NOT rely only on the short Topic label — actively extract the concrete plot conflict, characters, props, emotions, and search terms from the SCRIPT below to craft the Title, Tags & Hashtags, and 16:9 (1280x720) Thumbnail Concept.
Write title, description, and tags in ${langLabel}. Write thumbnailConcept in clear visual direction (English composition + short 2–4 word overlay text suggestion in ${langLabel} that complements rather than repeats the title).

${formatGuide}

[OVERVIEW / TỔNG QUAN]
- Project Name: ${String(projectName||'').slice(0,200)}
- Topic / Primary Keyword Focus: ${String(topic||'').slice(0,400)}
- Aspect Ratio: ${String(ratio||'16:9')} | Target Clip Duration: ${String(clipDuration||12)}s
- Channel: ${String(channel||'').slice(0,200)} | Genre: ${String(genre||'').slice(0,200)} | Audience: ${String(audience||'').slice(0,200)}
- Visual Style: ${String(styleName||'').slice(0,150)} — ${String(styleDescription||'').slice(0,600)}
- Palette: ${String(palette||'').slice(0,200)}
- Characters: ${charText.slice(0,800)}
- Locations: ${locText.slice(0,600)}

${insightsBlock}[FULL SCRIPT / KỊCH BẢN]
${String(script||'').slice(0,15000)}

${srtText?`[SRT SPOKEN TRANSCRIPT]\n${String(srtText).slice(0,4000)}\n`:''}${chapters?`[TIMELINE CHAPTERS STARTING AT 00:00]\n${String(chapters).slice(0,1500)}\n`:sceneLines?`[STORYBOARD SCENES]\n${sceneLines}\n`:''}`,
   config:{
    systemInstruction:'Follow strict YouTube SEO best practices and extract concrete details from the Script: (1) Title: front-load primary keyword + compelling conflict/plot hook directly from the Script, aim 50–70 chars (never >100). (2) Description: first 160 chars must hook viewers with the core story conflict and primary keyword; include multiline 00:00-based chapters (one timestamp per line, never inline with |). (3) Tags & Hashtags: Line 1 = comma-separated broad + specific long-tail search tags mined directly from the Script plot, characters, props, and topic (<=450 chars); Line 2 = 3–5 specific #hashtags derived from the Script and channel. (4) Thumbnail Concept: design a 16:9 (1280x720) or 9:16 cover depicting the Script climax/turning point with <=3 focal elements, exact character expression, key prop from the Script, complementary 2–4 word text, and YouTube safe-zone awareness.',
    responseMimeType:'application/json',
    responseSchema:{
     type:Type.OBJECT,
     properties:{
      title:{type:Type.STRING,description:'YouTube SEO title combining Overview topic and concrete Script conflict/hook, optimal 50-70 chars, strictly <=100 chars.'},
      description:{type:Type.STRING,description:'YouTube SEO description with above-the-fold keyword hook in first 160 chars, story summary from Script, multiline 00:00-based chapters (one timestamp per line using \\n), engagement CTA, and 3-5 hashtags.'},
      tags:{type:Type.STRING,description:'Line 1: comma-separated SEO tags mined from Script + Topic (broad + long-tail, <=450 chars). Line 2: 3-5 relevant #hashtags.'},
      thumbnailConcept:{type:Type.STRING,description:'Detailed 16:9 (1280x720) or 9:16 thumbnail composition prompt depicting the Script climax/turning point, stickman style, palette, max 3 focal elements, safe zones, and 2-4 word complementary text.'}
     },
     required:['title','description','tags','thumbnailConcept']
    }
   }
  });
  const raw=(response.text||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const parsed=JSON.parse(raw||'{}');
  res.json({
   title:String(parsed.title||'').slice(0,100),
   description:String(parsed.description||''),
   tags:String(parsed.tags||''),
   thumbnailConcept:String(parsed.thumbnailConcept||'')
  });
 }catch(err:any){res.status(502).json({error:'Gemini không tạo được gói SEO: '+String(err?.message||err).slice(0,250)})}
});
app.post('/api/pholaclu-story',async(req,res)=>{
 try{
  const ai=createAiClient();
  if(!ai)return res.status(503).json({error:'Chưa cấu hình GEMINI_API_KEY ở server. Bạn vẫn có thể dựng nhịp 12s theo mẫu nội bộ.'});
  const {characters,relationships,topic,tone,duration,ratio}=req.body??{};
  if(!Array.isArray(characters)||characters.length<2||characters.length>4)return res.status(400).json({error:'Cần chọn từ 2 đến 4 nhân vật Phố Lắc Lư hợp lệ.'});
  const dur=Number(duration)||60;
  const sceneCount=Math.max(2,Math.min(5,Math.round(dur/12)));
  const charLines=characters.map((c:any,i:number)=>`${String.fromCharCode(65+i)}: [${c.id}] ${c.name} | Family: ${c.family} | Role: ${c.role} | Silhouette: ${c.silhouette} | Face: ${c.face} | Outfit: ${c.outfit} | HEX: ${c.color_hex} | Signature: ${c.signature_motion} (Trigger: ${c.trigger}) | Canon note: ${c.canon_note||'none'}`).join('\n');
  const relLines=Array.isArray(relationships)&&relationships.length?relationships.map((r:any)=>`${r.a} <-> ${r.b}: A->B="${r.aToB}", B->A="${r.bToA}", Status=${r.status}${r.note?` (${r.note})`:''}`).join('\n'):'No verified pairs provided; treat as CHƯA_XAC_NHAN.';
  const response=await ai.models.generateContent({
   model:DEFAULT_MODEL,
   contents:`You are the showrunner and 2D animation director for "Phố Lắc Lư" (original adult-friendly rounded editorial 2D series).
Create a cohesive ${sceneCount * 12}-second Vietnamese short story (${sceneCount} scenes × 12s each, aspect ratio ${ratio||'9:16'}) featuring ONLY the locked canonical characters below.

[CANONICAL CHARACTERS - READ ONLY]
${charLines}

[VERIFIED DIRECTED RELATIONSHIPS]
${relLines}

[STORY BRIEF]
- Topic / Conflict: ${String(topic||'Một tình huống đời thường ở Phố Lắc Lư').slice(0,600)}
- Tone: ${String(tone||'Hài ấm áp').slice(0,120)}
- Scene Count: ${sceneCount} scenes (each strictly 12 seconds)

[HARD CANON RULES]
1. NEVER invent unconfirmed family relations (father/mother/siblings/marriage/romance). If a pair is CHƯA_XAC_NHAN or "bạn thân" (like PL001 Bơ & PL007 Mây), keep them strictly as neighbors/friends/acquaintances as specified.
2. NEVER invent an absent father or unverified home address (e.g., PL043 & PL048).
3. Strictly enforce visual continuity: for every i from 1 to ${sceneCount - 1}, Scene[i+1].start_state MUST match Scene[i].end_state smoothly in Vietnamese, preserving left/right screen placement, prop ownership, and lighting.
4. Return pure JSON matching the schema. All story fields in natural Vietnamese.`,
   config:{
    systemInstruction:'Write natural, witty, warm Vietnamese storytelling for Phố Lắc Lư. Respect every canonical character silhouette, signature motion trigger, and relationship constraint. Never fabricate romance or kinship.',
    responseMimeType:'application/json',
    responseSchema:{
     type:Type.OBJECT,
     properties:{
      title:{type:Type.STRING},
      logline:{type:Type.STRING},
      narration:{type:Type.STRING,description:'Clean cohesive Vietnamese narration matching the total video duration.'},
      scenes:{
       type:Type.ARRAY,
       items:{
        type:Type.OBJECT,
        properties:{
         beat:{type:Type.STRING},
         action:{type:Type.STRING},
         narration:{type:Type.STRING},
         location:{type:Type.STRING},
         props:{type:Type.STRING},
         lighting:{type:Type.STRING},
         start_state:{type:Type.STRING},
         end_state:{type:Type.STRING}
        },
        required:['beat','action','narration','location','props','lighting','start_state','end_state']
       }
      }
     },
     required:['title','logline','narration','scenes']
    }
   }
  });
  const raw=(response.text||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const parsed=JSON.parse(raw||'{}');
  res.json({
   title:String(parsed.title||''),
   logline:String(parsed.logline||''),
   narration:String(parsed.narration||''),
   scenes:Array.isArray(parsed.scenes)?parsed.scenes.slice(0,sceneCount):[]
  });
 }catch(err:any){res.status(502).json({error:'Gemini không sinh được truyện Phố Lắc Lư: '+String(err?.message||err).slice(0,250)})}
});
app.post('/api/tts',async(req,res)=>{
 try{
  const ai=createTtsClient();
  if(!ai)return res.status(503).json({error:'Chưa cấu hình GEMINI_API_KEY ở server. Bạn có thể chuyển sang chế độ "Đọc Trình duyệt (Miễn phí)" ngay trên Phòng Thu.'});
  const {text,voiceName,stylePrompt}=req.body??{};
  const cleanText=typeof text==='string'?text.trim():'';
  if(!cleanText||cleanText.length>5000){
   return res.status(400).json({error:'Lời đọc Gemini AI TTS cần từ 1 đến 5.000 ký tự/lần (với kịch bản dài hơn, hãy tách từng cảnh hoặc dùng "Đọc Trình duyệt (Miễn phí)" tối đa 12.000 ký tự).'});
  }
  const allowedVoices=new Set(['Puck','Charon','Kore','Fenrir','Zephyr']);
  const voice=allowedVoices.has(String(voiceName))?String(voiceName):'Kore';
  const style=typeof stylePrompt==='string'?stylePrompt.trim().slice(0,300):'';
  let fallbackUsed=false;
  let response:any;
  try{
   response=await ai.models.generateContent({
    model:'gemini-3.8-flash-lite-tts',
    contents:[{role:'user',parts:[style?{text:cleanText,speechMetadata:{style}} as any:{text:cleanText}]}],
    config:{
     responseModalities:['AUDIO'],
     speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}
    }
   });
  }catch(primaryErr:any){
   const msg=String(primaryErr?.message||primaryErr||'');
   if(style&&(/speechMetadata|Unknown name|INVALID_ARGUMENT|400/i.test(msg))){
    fallbackUsed=true;
    const directedText=`[Đọc theo sắc thái: ${style}]\n${cleanText}`;
    response=await ai.models.generateContent({
     model:'gemini-3.8-flash-lite-tts',
     contents:[{role:'user',parts:[{text:directedText}]}],
     config:{
      responseModalities:['AUDIO'],
      speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}
     }
    });
   }else{
    throw primaryErr;
   }
  }
  const parts:any[]=response?.candidates?.[0]?.content?.parts||[];
  const audioPart=parts.find((p:any)=>p?.inlineData?.data);
  const base64Audio=audioPart?.inlineData?.data;
  if(!base64Audio){
   return res.status(502).json({error:'Gemini TTS không trả về dữ liệu âm thanh. Hãy thử rút ngắn câu hoặc dùng "Đọc Trình duyệt (Miễn phí)".'});
  }
  const rawBuf=Buffer.from(base64Audio,'base64');
  const wavBuf=ensureWavBuffer(rawBuf,String(audioPart?.inlineData?.mimeType||'audio/wav'));
  res.json({
   audioBase64:wavBuf.toString('base64'),
   mimeType:'audio/wav',
   sampleRate:24000,
   voice,
   fallbackUsed
  });
 }catch(err:any){
  res.status(502).json({error:'Lỗi tạo giọng đọc Gemini TTS: '+String(err?.message||err).slice(0,260)});
 }
});
const root=process.cwd();
if(process.env.NODE_ENV==='production'){
 app.use(express.static(path.join(root,'dist')));
 app.get('*',(req,res,next)=>{if(req.path.startsWith('/api'))return next();res.sendFile(path.join(root,'dist','index.html'))});
}else{
 const vitePromise=createViteServer({server:{middlewareMode:true,allowedHosts:true},appType:'spa'});
 vitePromise.catch(err=>console.error('Vite dev middleware init error:',err));
 app.use(async(req,res,next)=>{
  try{
   const vite=await vitePromise;
   return vite.middlewares(req,res,next);
  }catch(err){
   return next(err);
  }
 });
}
const port=Number(process.env.PORT)||3000;
app.listen(port,'0.0.0.0',()=>console.log(`Stickman Director server on ${port}`));
