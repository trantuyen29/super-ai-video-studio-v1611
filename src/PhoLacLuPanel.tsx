import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,AlertTriangle,Copy,Download,Sparkles,Users,Layers,Film,ShieldCheck,Upload,Search,ArrowRightLeft,Lock,Send} from 'lucide-react';
import {Project,Scene,STYLE,download,csvEscape} from './core';

export interface PLLCharacter{
 id:string;
 name:string;
 short_name:string;
 family:string;
 role:string;
 age_label:string;
 father_id:string|null;
 mother_id:string|null;
 siblings_ids:string|null;
 grandparent_ids:string|null;
 children_ids:string|null;
 pet_ids:string|null;
 color_hex:string;
 silhouette:string;
 face:string;
 outfit:string;
 strength:string;
 flaw:string;
 signature_motion:string;
 signature_motion_id:string;
 trigger:string;
 arc:string;
 canon_note:string;
 lock:string;
 master_asset_id:string;
 reference_ids:string[];
}

export interface PLLRelationship{
 KEY_A_B:string;
 KEY_B_A:string;
 REL_ID:string;
 A_ID:string;
 A_TEN:string;
 A_QUAN_HE_VOI_B:string;
 B_ID:string;
 B_TEN:string;
 B_QUAN_HE_VOI_A:string;
 NHOM:string;
 BANG_CHUNG_NGUON:string;
 TRANG_THAI:string;
 LUU_Y:string|null;
}

export interface PLLExpression{
 'Mã':string;
 'Tên biểu cảm':string;
 'Trạng thái':string;
 'Mắt':string;
 'Lông mày':string;
 'Miệng & má':string;
 'Đầu':string;
 'Vai, tay & thân':string;
 'Thời gian biến đổi':string;
 'Cường độ':string;
 'Nhân vật phù hợp':string;
 'Điều cần tránh':string;
}

export interface PLLMotion{
 'Mã':string;
 'Nhóm hành động':string;
 'Tên chuyển động':string;
 'Ý định cảm xúc':string;
 'Chuẩn bị (0–2s)':string;
 'Diễn chính (2–5s)':string;
 'Phản ứng (5–8s)':string;
 'Kết thúc (8–12s)':string;
 'Gợi ý góc quay':string;
 'Âm thanh phụ':string;
 'Cường độ':string;
 'Nối cảnh / tránh lỗi':string;
}

export interface PLLSignatureMotion{
 'Mã chuyển động':string;
 'Mã nhân vật':string;
 'Tên':string;
 'Nhóm':string;
 'Điều kiện kích hoạt':string;
 'Pha 1 – Chuẩn bị':string;
 'Pha 2 – Điểm nhấn':string;
 'Pha 3 – Hậu phản ứng':string;
 'Phân bổ nhịp 12s':string;
 'Biên độ & nguyên tắc':string;
 'Góc máy':string;
 'Character Lock':string;
 'Giới hạn tái sử dụng':string;
}

export interface PLLStorySeed{
 STORY_ID:string;
 GROUP:string;
 A_ID:string;
 B_ID:string;
 A_NAME:string;
 B_NAME:string;
 A_TO_B:string;
 TITLE:string;
 LOGLINE:string;
 TONE:string;
 DURATION:number;
 SCENES:number;
 STATUS:string;
}

export interface PLLSampleScene{
 SCENE_ID:string;
 STORY_ID:string;
 SCENE_NUM:number;
 BEAT:string;
 A_ID:string;
 B_ID:string;
 RELATION:string;
 ACTION:string;
 EXPRESSION_ID:string;
 MOTION_ID:string;
 START_STATE:string;
 END_STATE:string;
 DURATION_SEC:number;
 PROMPT:string;
 STATUS:string;
}

export interface PLLAssetItem{
 ASSET_ID:string;
 PL_ID:string;
 NAME:string;
 FAMILY:string;
 TYPE:string;
 DESCRIPTION:string;
 RATIO:string;
 SOURCE_HEX:string;
 DEPENDENCY:string;
 PROMPT:string;
 STATUS:string;
 QA:string;
 PRIORITY:string;
}

type AssetOverride={status:string;qa:string;fileName?:string};
type PLLSceneDraft={
 scene_id:string;
 beat:string;
 duration_sec:number;
 character_ids:string[];
 expression_id:string;
 main_motion_id:string;
 sub_motion_id:string;
 location:string;
 props:string;
 lighting:string;
 narration:string;
 action:string;
 start_state:string;
 end_state:string;
 prompt:string;
};

type SubView='canon'|'factory'|'acting'|'director';

const ASSET_STORE_KEY='pholaclu_asset_overrides_v3';

function parseCsvRows(rawText:string):Record<string,string>[]{
 const text=rawText.replace(/^\uFEFF/,'');
 const rows:string[][]=[];
 let row:string[]=[];
 let cell='';
 let inQuotes=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(inQuotes){
   if(ch==='"'){
    if(text[i+1]==='"'){cell+='"';i++;}
    else{inQuotes=false;}
   }else{cell+=ch;}
  }else{
   if(ch==='"'){inQuotes=true;}
   else if(ch===','){row.push(cell);cell='';}
   else if(ch==='\r'){
    if(text[i+1]==='\n')i++;
    row.push(cell);rows.push(row);row=[];cell='';
   }else if(ch==='\n'){
    row.push(cell);rows.push(row);row=[];cell='';
   }else{cell+=ch;}
  }
 }
 if(cell.length>0||row.length>0){row.push(cell);rows.push(row);}
 if(rows.length<2)return [];
 const headers=rows[0].map(h=>h.trim());
 return rows.slice(1).filter(r=>r.some(x=>x.trim().length>0)).map(r=>{
  const obj:Record<string,string>={};
  headers.forEach((h,idx)=>{obj[h]=(r[idx]??'').trim();});
  return obj;
 });
}

function lookupDirectedRelation(relationships:PLLRelationship[],aId:string,bId:string){
 for(const r of relationships){
  if(r.A_ID===aId&&r.B_ID===bId){
   return {found:true,aToB:r.A_QUAN_HE_VOI_B||'CHƯA_XAC_NHAN',bToA:r.B_QUAN_HE_VOI_A||'CHƯA_XAC_NHAN',status:r.TRANG_THAI||'CHƯA_XAC_NHAN',evidence:r.BANG_CHUNG_NGUON,note:r.LUU_Y,relId:r.REL_ID};
  }
  if(r.A_ID===bId&&r.B_ID===aId){
   return {found:true,aToB:r.B_QUAN_HE_VOI_A||'CHƯA_XAC_NHAN',bToA:r.A_QUAN_HE_VOI_B||'CHƯA_XAC_NHAN',status:r.TRANG_THAI||'CHƯA_XAC_NHAN',evidence:r.BANG_CHUNG_NGUON,note:r.LUU_Y,relId:r.REL_ID};
  }
 }
 return {found:false,aToB:'CHƯA_XAC_NHAN',bToA:'CHƯA_XAC_NHAN',status:'CHƯA_XAC_NHAN',evidence:'Không có bản ghi trong relationships.json',note:'Không được tự suy diễn quan hệ cha/mẹ/anh em/yêu đương.',relId:'NONE'};
}

function buildPhoLacLuPrompt(opts:{
 scene:PLLSceneDraft;
 chars:PLLCharacter[];
 relationSummary:string;
 exp?:PLLExpression;
 mainMotion?:PLLMotion;
 subMotion?:PLLMotion;
 topic:string;
 tone:string;
 ratio:Project['ratio'];
 masterApprovedAll:boolean;
}):string{
 const {scene,chars,relationSummary,exp,mainMotion,subMotion,topic,tone,ratio,masterApprovedAll}=opts;
 const style=STYLE.pholaclu;
 const positions=['LEFT','RIGHT','CENTER-LEFT','CENTER-RIGHT'];
 const charBlocks=chars.map((c,idx)=>`CHARACTER ${String.fromCharCode(65+idx)} (${positions[idx]||'BACKGROUND'}) EXACT REF: ${c.id}_MASTER + ${c.id}_3Q.\n${c.lock}`).join('\n');
 const exprLine=exp?`${exp['Mã']} (${exp['Tên biểu cảm']} — Mắt: ${exp['Mắt']}; Lông mày: ${exp['Lông mày']}; Miệng: ${exp['Miệng & má']})`:scene.expression_id;
 const mainLine=mainMotion?`${mainMotion['Mã']} (${mainMotion['Tên chuyển động']}: 0–2s ${mainMotion['Chuẩn bị (0–2s)']} | 2–5s ${mainMotion['Diễn chính (2–5s)']} | 5–8s ${mainMotion['Phản ứng (5–8s)']} | 8–12s ${mainMotion['Kết thúc (8–12s)']})`:scene.main_motion_id;
 const subLine=subMotion?`${subMotion['Mã']} (${subMotion['Tên chuyển động']})`:'none (max 1 main + 1 sub)';
 const sigTriggers=chars.map(c=>`${c.id} ${c.signature_motion_id}: ${c.signature_motion} [only if trigger "${c.trigger}" fits]`).join(' | ');
 return `PHỐ LẮC LƯ | ${scene.scene_id} | ${scene.duration_sec}s | ${ratio} | Beat: ${scene.beat}
${masterApprovedAll?'STATUS: MASTER_REF_APPROVED':'DRAFT WARNING: {PL_ID}_MASTER reference assets are NOT QA APPROVED yet; review before final render.'}
STYLE LOCK: ${style.description}. PALETTE LOCK: ${style.palette}.
${charBlocks}
VERIFIED RELATIONSHIPS: ${relationSummary} (IF CHƯA_XAC_NHAN: do NOT infer kinship or romance).
STORY CONTEXT: ${topic} | TONE: ${tone}.
NARRATION CONTEXT (do not render text on screen): ${scene.narration||scene.action}
SCENE ACTION: ${scene.action}
LOCATION: ${scene.location}. PROPS: ${scene.props}. LIGHTING: ${scene.lighting}.
EXPRESSION: ${exprLine}.
MAIN MOTION: ${mainLine}. SECONDARY MOTION: ${subLine}.
SIGNATURE TRIGGERS: ${sigTriggers}.
TIMING BEATS: 0–2s establish START_STATE; 2–5s primary action; 5–8s emotional reaction; 8–10s micro reveal/shift; 10–12s settle cleanly into END_STATE.
START_STATE: ${scene.start_state}
END_STATE: ${scene.end_state}
CAMERA: One continuous medium shot, stable left/right screen geography, gentle push-in only; preserve prop hand, scale, color and silhouette. END_STATE must equal next scene START_STATE.
NEGATIVE: ${style.negative}, no abrupt cuts, no subtitles, no extra limbs, no unconfirmed characters.`;
}

export function PhoLacLuPanel({
 project,
 onApplyStyleAndCharacters,
 onPushScenesToProject,
 onNotice
}:{
 project:Project;
 onApplyStyleAndCharacters:(patch:{style:Project['style'];ratio?:Project['ratio'];topic?:string;script?:string})=>void;
 onPushScenesToProject:(scenes:Scene[],meta:{topic?:string;script?:string;style:Project['style'];duration:number})=>void;
 onNotice:(msg:string)=>void;
}){
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState('');
 const [subView,setSubView]=useState<SubView>('canon');

 const [characters,setCharacters]=useState<PLLCharacter[]>([]);
 const [relationships,setRelationships]=useState<PLLRelationship[]>([]);
 const [expressions,setExpressions]=useState<PLLExpression[]>([]);
 const [motionBank,setMotionBank]=useState<PLLMotion[]>([]);
 const [signatureMotions,setSignatureMotions]=useState<PLLSignatureMotion[]>([]);
 const [storySeeds,setStorySeeds]=useState<PLLStorySeed[]>([]);
 const [sampleScenes,setSampleScenes]=useState<PLLSampleScene[]>([]);
 const [assetQueue,setAssetQueue]=useState<PLLAssetItem[]>([]);

 // Canon & Relationship Inspector state
 const [familyFilter,setFamilyFilter]=useState('Tất cả');
 const [charQuery,setCharQuery]=useState('');
 const [selectedCharId,setSelectedCharId]=useState('PL001');
 const [relCharA,setRelCharA]=useState('PL001');
 const [relCharB,setRelCharB]=useState('PL002');

 // Asset Factory state
 const [assetCharFilter,setAssetCharFilter]=useState('PL001');
 const [assetTypeFilter,setAssetTypeFilter]=useState('Tất cả');
 const [assetStatusFilter,setAssetStatusFilter]=useState('Tất cả');
 const [assetOverrides,setAssetOverrides]=useState<Record<string,AssetOverride>>(()=>{
  try{return JSON.parse(localStorage.getItem(ASSET_STORE_KEY)||'{}')||{};}catch{return {};}
 });
 const [localPreviews,setLocalPreviews]=useState<Record<string,string>>({});

 // Acting Library state
 const [actingTab,setActingTab]=useState<'ex'|'mv'|'sm'>('ex');
 const [motionGroupFilter,setMotionGroupFilter]=useState('Tất cả');

 // Story & 12s Director state
 const [castIds,setCastIds]=useState<string[]>(['PL001','PL002']);
 const [manualIdTest,setManualIdTest]=useState('');
 const [storyTopic,setStoryTopic]=useState('Bơ đánh rơi khung ảnh, cha giúp con mà không trách mắng');
 const [storyTone,setStoryTone]=useState('Hài ấm áp');
 const [storyDuration,setStoryDuration]=useState<24|36|48|60>(60);
 const [storyNarration,setStoryNarration]=useState('');
 const [storyStatus,setStoryStatus]=useState<'DRAFT'|'STORY_APPROVED'>('DRAFT');
 const [storyEngineMode,setStoryEngineMode]=useState<'template'|'gemini'|'sample'>('template');
 const [selectedExprId,setSelectedExprId]=useState('EX01');
 const [selectedMainMotionId,setSelectedMainMotionId]=useState('MV001');
 const [selectedSubMotionId,setSelectedSubMotionId]=useState('');
 const [scenes,setScenes]=useState<PLLSceneDraft[]>([]);
 const [geminiBusy,setGeminiBusy]=useState(false);

 useEffect(()=>{
  let alive=true;
  (async()=>{
   try{
    const urls=[
     '/assets/aistudio/characters_6071def4.json',
     '/assets/aistudio/relationships_269a6888.json',
     '/assets/aistudio/expressions_9fca5632.json',
     '/assets/aistudio/motion_bank_90276310.json',
     '/assets/aistudio/signature_motions_dc0e0ce2.json',
     '/assets/aistudio/story_seeds_a217558e.json',
     '/assets/aistudio/sample_scenes_da94fcaa.json',
     '/assets/aistudio/asset_queue_b86d4c4c.csv'
    ];
    const responses=await Promise.all(urls.map(u=>fetch(u)));
    const bad=responses.find(r=>!r.ok);
    if(bad)throw new Error(`Không tải được dữ liệu (${bad.url} · HTTP ${bad.status})`);
    const [charsJ,relsJ,expsJ,mvsJ,smsJ,seedsJ,samplesJ,csvTxt]=await Promise.all([
     responses[0].json(),
     responses[1].json(),
     responses[2].json(),
     responses[3].json(),
     responses[4].json(),
     responses[5].json(),
     responses[6].json(),
     responses[7].text()
    ]);
    if(!alive)return;
    setCharacters(Array.isArray(charsJ)?charsJ:[]);
    setRelationships(Array.isArray(relsJ)?relsJ:[]);
    setExpressions(Array.isArray(expsJ)?expsJ:[]);
    setMotionBank(Array.isArray(mvsJ)?mvsJ:[]);
    setSignatureMotions(Array.isArray(smsJ)?smsJ:[]);
    setStorySeeds(Array.isArray(seedsJ)?seedsJ:[]);
    setSampleScenes(Array.isArray(samplesJ)?samplesJ:[]);
    const parsedCsv=parseCsvRows(csvTxt) as unknown as PLLAssetItem[];
    setAssetQueue(parsedCsv);
    setLoading(false);
   }catch(err){
    if(!alive)return;
    setLoadError(String(err instanceof Error?err.message:err));
    setLoading(false);
   }
  })();
  return()=>{alive=false;};
 },[]);

 useEffect(()=>{
  try{localStorage.setItem(ASSET_STORE_KEY,JSON.stringify(assetOverrides));}catch{}
 },[assetOverrides]);

 const byId=useMemo(()=>Object.fromEntries(characters.map(c=>[c.id,c])),[characters]);
 const expById=useMemo(()=>Object.fromEntries(expressions.map(e=>[e['Mã'],e])),[expressions]);
 const mvById=useMemo(()=>Object.fromEntries(motionBank.map(m=>[m['Mã'],m])),[motionBank]);
 const smByCharId=useMemo(()=>Object.fromEntries(signatureMotions.map(s=>[s['Mã nhân vật'],s])),[signatureMotions]);

 const families=useMemo(()=>['Tất cả',...Array.from(new Set(characters.map(c=>c.family)))],[characters]);
 const motionGroups=useMemo(()=>['Tất cả',...Array.from(new Set(motionBank.map(m=>m['Nhóm hành động'])))],[motionBank]);

 const filteredChars=useMemo(()=>{
  const q=charQuery.trim().toLowerCase();
  return characters.filter(c=>{
   if(familyFilter!=='Tất cả'&&c.family!==familyFilter)return false;
   if(!q)return true;
   return c.id.toLowerCase().includes(q)||c.name.toLowerCase().includes(q)||c.role.toLowerCase().includes(q)||c.family.toLowerCase().includes(q);
  });
 },[characters,familyFilter,charQuery]);

 const activeChar=byId[selectedCharId]||filteredChars[0]||characters[0];
 const invalidQueryCode=useMemo(()=>{
  const q=charQuery.trim().toUpperCase();
  if(/^PL\d{3,}$/.test(q)&&!byId[q])return q;
  return '';
 },[charQuery,byId]);

 const pairRelation=useMemo(()=>lookupDirectedRelation(relationships,relCharA,relCharB),[relationships,relCharA,relCharB]);

 // Asset Queue merged with user QA overrides
 const mergedAssets=useMemo(()=>assetQueue.map(item=>{
  const ov=assetOverrides[item.ASSET_ID];
  return {
   ...item,
   STATUS:ov?.status||item.STATUS||'CHƯA TẠO',
   QA:ov?.qa||item.QA||'CHƯA KIỂM',
   fileName:ov?.fileName||''
  };
 }),[assetQueue,assetOverrides]);

 const approvedMasterCount=useMemo(()=>mergedAssets.filter(a=>a.TYPE==='MASTER'&&a.STATUS==='APPROVED'&&a.QA==='ĐẠT').length,[mergedAssets]);
 const approvedAssetCount=useMemo(()=>mergedAssets.filter(a=>a.STATUS==='APPROVED').length,[mergedAssets]);

 const filteredAssets=useMemo(()=>mergedAssets.filter(a=>{
  if(assetCharFilter!=='Tất cả'&&a.PL_ID!==assetCharFilter)return false;
  if(assetTypeFilter!=='Tất cả'&&a.TYPE!==assetTypeFilter)return false;
  if(assetStatusFilter!=='Tất cả'&&a.STATUS!==assetStatusFilter)return false;
  return true;
 }),[mergedAssets,assetCharFilter,assetTypeFilter,assetStatusFilter]);

 const isMasterApproved=(plId:string)=>{
  const m=mergedAssets.find(a=>a.ASSET_ID===`${plId}_MASTER`);
  return Boolean(m&&m.STATUS==='APPROVED'&&m.QA==='ĐẠT');
 };

 const updateAsset=(asset:PLLAssetItem,patch:Partial<AssetOverride>)=>{
  const nextStatus=patch.status??(assetOverrides[asset.ASSET_ID]?.status||asset.STATUS);
  if(asset.TYPE!=='MASTER'&&nextStatus==='APPROVED'&&!isMasterApproved(asset.PL_ID)){
   onNotice(`Bị chặn: Hãy duyệt ${asset.PL_ID}_MASTER (APPROVED + ĐẠT) trước khi duyệt ${asset.ASSET_ID}.`);
   return;
  }
  setAssetOverrides(prev=>({
   ...prev,
   [asset.ASSET_ID]:{
    status:nextStatus,
    qa:patch.qa??(prev[asset.ASSET_ID]?.qa||asset.QA),
    fileName:patch.fileName??prev[asset.ASSET_ID]?.fileName
   }
  }));
 };

 const handleUploadAssetPreview=(asset:PLLAssetItem,file:File)=>{
  const url=URL.createObjectURL(file);
  setLocalPreviews(prev=>({...prev,[asset.ASSET_ID]:url}));
  updateAsset(asset,{status:'DRAFT',qa:'CHƯA KIỂM',fileName:file.name});
  onNotice(`Đã gắn ảnh xem trước cục bộ "${file.name}" cho ${asset.ASSET_ID} (trạng thái DRAFT, cần QA duyệt bằng mắt).`);
 };

 // Cast validation & relationships for Director
 const normalizedCast=useMemo(()=>{
  const base=castIds.map(x=>x.trim().toUpperCase()).filter(Boolean);
  const manual=manualIdTest.trim().toUpperCase();
  return manual?[...base,manual]:base;
 },[castIds,manualIdTest]);

 const invalidCastIds=useMemo(()=>normalizedCast.filter(id=>!byId[id]),[normalizedCast,byId]);
 const duplicateCast=useMemo(()=>new Set(normalizedCast).size!==normalizedCast.length,[normalizedCast]);
 const validCastChars=useMemo(()=>normalizedCast.map(id=>byId[id]).filter(Boolean),[normalizedCast,byId]);

 const castPairRelations=useMemo(()=>{
  const list:{a:string;b:string;aToB:string;bToA:string;status:string;note:string|null}[]=[];
  for(let i=0;i<validCastChars.length;i++){
   for(let j=i+1;j<validCastChars.length;j++){
    const r=lookupDirectedRelation(relationships,validCastChars[i].id,validCastChars[j].id);
    list.push({a:validCastChars[i].id,b:validCastChars[j].id,aToB:r.aToB,bToA:r.bToA,status:r.status,note:r.note});
   }
  }
  return list;
 },[validCastChars,relationships]);

 const castRelSummary=useMemo(()=>castPairRelations.length
  ?castPairRelations.map(r=>`${r.a}→${r.b}: ${r.aToB} / ${r.b}→${r.a}: ${r.bToA} [${r.status}]`).join(' ; ')
  :'Chưa đủ 2 nhân vật',
 [castPairRelations]);

 const rebuildPrompts=(drafts:PLLSceneDraft[],topicVal=storyTopic,toneVal=storyTone)=>{
  const allMasterOk=validCastChars.length>0&&validCastChars.every(c=>isMasterApproved(c.id));
  return drafts.map(s=>{
   const scChars=s.character_ids.map(id=>byId[id]).filter(Boolean);
   return {
    ...s,
    prompt:buildPhoLacLuPrompt({
     scene:s,
     chars:scChars.length?scChars:validCastChars,
     relationSummary:castRelSummary,
     exp:expById[s.expression_id],
     mainMotion:mvById[s.main_motion_id],
     subMotion:s.sub_motion_id?mvById[s.sub_motion_id]:undefined,
     topic:topicVal,
     tone:toneVal,
     ratio:project.ratio,
     masterApprovedAll:allMasterOk
    })
   };
  });
 };

 const generateTemplateScenes=()=>{
  if(invalidCastIds.length){
   return onNotice(`Bị chặn: Phát hiện mã nhân vật không tồn tại (${invalidCastIds.join(', ')}). Chỉ chấp nhận PL001–PL048.`);
  }
  if(validCastChars.length<2){
   return onNotice('Cần chọn ít nhất 2 nhân vật hợp lệ (tối đa 4).');
  }
  if(duplicateCast){
   return onNotice('Bị chặn: Không được chọn trùng mã nhân vật trong cùng dàn diễn viên.');
  }
  if(!storyTopic.trim()){
   return onNotice('Hãy nhập chủ đề câu chuyện trước khi lập nhịp 12s.');
  }
  const n=Math.max(2,Math.min(5,Math.round(storyDuration/12)));
  const beatTemplates=[
   'Sự cố mở đầu (Hook)',
   'Phản ứng đặc trưng',
   'Hiểu lầm / Cao trào nhỏ',
   'Khám phá bất ngờ',
   'Giải quyết ấm áp (Ending)'
  ];
  const chosenBeats=n===2?[beatTemplates[0],beatTemplates[4]]:n===3?[beatTemplates[0],beatTemplates[2],beatTemplates[4]]:n===4?[beatTemplates[0],beatTemplates[1],beatTemplates[3],beatTemplates[4]]:beatTemplates;
  const states=[
   `Trạng thái 0: ${validCastChars.map((c,idx)=>`${c.name} (${idx===0?'trái':'phải'})`).join(', ')} đứng trong góc phố ấm #F5EBD3, đồ vật trung tâm đặt giữa khung hình.`,
   ...chosenBeats.map((b,idx)=>`Trạng thái ${idx+1}: Sau nhịp "${b}", vị trí trái/phải và đạo cụ giữ nguyên, ánh nhìn và tư thế sẵn sàng nối tiếp mượt.`)
  ];
  const drafts:PLLSceneDraft[]=chosenBeats.map((beat,i)=>({
   scene_id:`PLL-S${String(i+1).padStart(2,'0')}`,
   beat,
   duration_sec:12,
   character_ids:validCastChars.map(c=>c.id),
   expression_id:selectedExprId||'EX01',
   main_motion_id:selectedMainMotionId||'MV001',
   sub_motion_id:selectedSubMotionId||'',
   location:'Góc hẻm Phố Lắc Lư — nền than #151820, ánh sáng kem ấm #F5EBD3',
   props:'Đồ vật trung tâm theo chủ đề câu chuyện',
   lighting:'Warm cream spotlight #F5EBD3 on charcoal #151820',
   narration:`[${beat}] ${storyTopic} (${validCastChars.map(c=>c.short_name).join(' & ')})`,
   action:`${beat}: diễn xuất theo ${validCastChars[0].signature_motion} (chỉ dùng nếu đúng kích hoạt) và tương tác giữa ${validCastChars.map(c=>c.name).join(', ')}.`,
   start_state:states[i],
   end_state:states[i+1],
   prompt:''
  }));
  const withPrompts=rebuildPrompts(drafts);
  setScenes(withPrompts);
  setStoryStatus('DRAFT');
  setStoryEngineMode('template');
  onNotice(`Đã lập ${withPrompts.length} cảnh × 12s theo mẫu nội bộ (trạng thái DRAFT — chưa dùng AI).`);
 };

 const generateGeminiStory=async()=>{
  if(invalidCastIds.length){
   return onNotice(`Bị chặn: Mã nhân vật không hợp lệ (${invalidCastIds.join(', ')}).`);
  }
  if(validCastChars.length<2||duplicateCast){
   return onNotice('Cần 2–4 nhân vật hợp lệ không trùng nhau.');
  }
  setGeminiBusy(true);
  try{
   const r=await fetch('/api/pholaclu-story',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     characters:validCastChars,
     relationships:castPairRelations,
     topic:storyTopic,
     tone:storyTone,
     duration:storyDuration,
     ratio:project.ratio
    })
   });
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||'Không tạo được truyện từ Gemini.');
   const aiScenes:any[]=Array.isArray(data.scenes)?data.scenes:[];
   if(!aiScenes.length)throw new Error('Gemini trả về danh sách cảnh rỗng.');
   const drafts:PLLSceneDraft[]=aiScenes.map((sc,i)=>({
    scene_id:`PLL-AI-S${String(i+1).padStart(2,'0')}`,
    beat:String(sc.beat||`Nhịp ${i+1}`),
    duration_sec:12,
    character_ids:validCastChars.map(c=>c.id),
    expression_id:selectedExprId||'EX01',
    main_motion_id:selectedMainMotionId||'MV001',
    sub_motion_id:selectedSubMotionId||'',
    location:String(sc.location||'Phố Lắc Lư — nền #151820, ánh sáng ấm #F5EBD3'),
    props:String(sc.props||'Đạo cụ nhất quán'),
    lighting:String(sc.lighting||'Warm cream spotlight #F5EBD3'),
    narration:String(sc.narration||''),
    action:String(sc.action||''),
    start_state:i>0?String(aiScenes[i-1]?.end_state||sc.start_state||''):String(sc.start_state||''),
    end_state:String(sc.end_state||''),
    prompt:''
   }));
   setStoryNarration(String(data.narration||''));
   const withPrompts=rebuildPrompts(drafts,data.title||storyTopic,storyTone);
   setScenes(withPrompts);
   setStoryStatus('DRAFT');
   setStoryEngineMode('gemini');
   onNotice(`Gemini đã sinh truyện "${data.title||storyTopic}" (${withPrompts.length} cảnh 12s) — đang ở trạng thái DRAFT, cần duyệt.`);
  }catch(err){
   onNotice(String(err instanceof Error?err.message:err));
  }finally{
   setGeminiBusy(false);
  }
 };

 const loadSeed=(seed:PLLStorySeed)=>{
  setCastIds([seed.A_ID,seed.B_ID]);
  setManualIdTest('');
  setStoryTopic(`${seed.TITLE}: ${seed.LOGLINE}`);
  setStoryTone(seed.TONE||'Hài ấm áp');
  const d=([24,36,48,60].includes(seed.DURATION)?seed.DURATION:60) as 24|36|48|60;
  setStoryDuration(d);
  const matching=sampleScenes.filter(s=>s.STORY_ID===seed.STORY_ID).sort((a,b)=>a.SCENE_NUM-b.SCENE_NUM);
  if(matching.length){
   const drafts:PLLSceneDraft[]=matching.map(m=>({
    scene_id:m.SCENE_ID,
    beat:m.BEAT,
    duration_sec:m.DURATION_SEC||12,
    character_ids:[m.A_ID,m.B_ID],
    expression_id:m.EXPRESSION_ID||'EX01',
    main_motion_id:m.MOTION_ID||'MV001',
    sub_motion_id:'',
    location:'Phố Lắc Lư — nền #151820, kem ấm #F5EBD3',
    props:seed.TITLE,
    lighting:'Warm cream spotlight #F5EBD3',
    narration:m.ACTION,
    action:m.ACTION,
    start_state:m.START_STATE,
    end_state:m.END_STATE,
    prompt:m.PROMPT
   }));
   setScenes(drafts);
   setStoryEngineMode('sample');
   setStoryStatus('DRAFT');
   onNotice(`Đã nạp hạt giống "${seed.TITLE}" kèm ${drafts.length} cảnh mẫu DRAFT.`);
  }else{
   setScenes([]);
   onNotice(`Đã nạp hạt giống "${seed.TITLE}". Bấm Lập nhịp 12s hoặc Sinh bằng Gemini để dựng cảnh.`);
  }
 };

 const mutateSceneDraft=(idx:number,patch:Partial<PLLSceneDraft>)=>{
  setScenes(prev=>{
   const next=prev.map((s,i)=>i===idx?{...s,...patch}:s);
   return rebuildPrompts(next);
  });
 };

 const syncContinuityChain=()=>{
  setScenes(prev=>{
   const chained=prev.map((s,i)=>i===0?s:{...s,start_state:prev[i-1].end_state});
   return rebuildPrompts(chained);
  });
  onNotice('Đã đồng bộ START_STATE của S(n+1) khớp hoàn toàn với END_STATE của S(n).');
 };

 const pushToMainStoryboard=()=>{
  if(!scenes.length)return onNotice('Chưa có cảnh Phố Lắc Lư để đẩy sang Storyboard.');
  if(invalidCastIds.length)return onNotice(`Không thể đẩy: mã nhân vật không hợp lệ (${invalidCastIds.join(', ')}).`);
  const mapped:Scene[]=scenes.map((s,i)=>{
   const dur=s.duration_sec||12;
   const start=i*dur;
   const end=start+dur;
   const refs=s.character_ids.map(id=>`${id}_MASTER; ${id}_3Q`).join('; ');
   return {
    id:`F${String(i+1).padStart(3,'0')}`,
    start,
    end,
    narration:s.narration||s.action,
    location:s.location,
    characters:s.character_ids.map(id=>`${id} (${byId[id]?.name||''})`).join(', '),
    reference:refs,
    action:`[${s.beat}] ${s.action} | START: ${s.start_state} → END: ${s.end_state}`,
    prompt:s.prompt,
    status:storyStatus==='STORY_APPROVED'&&validCastChars.every(c=>isMasterApproved(c.id))?'approved':'review'
   };
  });
  onPushScenesToProject(mapped,{
   topic:storyTopic,
   script:storyNarration||scenes.map(s=>s.narration||s.action).join(' '),
   style:'pholaclu',
   duration:12
  });
 };

 // Phố Lắc Lư QA IF/ELSE Rules
 const qaChecks=useMemo(()=>{
  const hasInvalidId=invalidCastIds.length>0;
  const distinctOk=!duplicateCast&&validCastChars.length>=2&&validCastChars.length<=4;
  const unconfirmedPairs=castPairRelations.filter(r=>r.status==='CHƯA_XAC_NHAN'||r.aToB==='CHƯA_XAC_NHAN');
  const allRelationsVerified=castPairRelations.length>0&&unconfirmedPairs.length===0;
  const hasScenes=scenes.length>0;
  const startEndFilled=hasScenes&&scenes.every(s=>s.start_state.trim().length>0&&s.end_state.trim().length>0);
  const continuityOk=hasScenes&&scenes.slice(1).every((s,i)=>s.start_state.trim()===scenes[i].end_state.trim());
  const actingLimitOk=hasScenes&&scenes.every(s=>Boolean(s.main_motion_id)&&(!s.sub_motion_id||s.sub_motion_id!==s.main_motion_id));
  const duration12sOk=hasScenes&&scenes.every(s=>s.duration_sec>=1&&s.duration_sec<=15);
  const storyApprovedOk=storyStatus==='STORY_APPROVED';
  const unapprovedMasters=validCastChars.filter(c=>!isMasterApproved(c.id)).map(c=>`${c.id}_MASTER`);
  const mastersOk=validCastChars.length>0&&unapprovedMasters.length===0;

  return [
   {id:'QA01',label:'Mã nhân vật thuộc sổ canon PL001–PL048',ok:!hasInvalidId,severity:'BLOCK',detail:hasInvalidId?`Chặn mã không hợp lệ: ${invalidCastIds.join(', ')}`:`Hợp lệ: ${validCastChars.map(c=>c.id).join(', ')}`},
   {id:'QA02',label:'Chọn 2–4 nhân vật không trùng lặp',ok:distinctOk,severity:'BLOCK',detail:distinctOk?`${validCastChars.length} nhân vật riêng biệt`:'Kiểm tra lại số lượng (2–4) hoặc trùng mã'},
   {id:'QA03',label:'Quan hệ cặp nhân vật đã xác thực canon',ok:allRelationsVerified,severity:'REVIEW',detail:allRelationsVerified?castRelSummary:`Cảnh báo CHƯA_XAC_NHAN (${unconfirmedPairs.map(p=>`${p.a}-${p.b}`).join(', ')}): không bịa gia đình/yêu đương`},
   {id:'QA04',label:'Đã tạo danh sách cảnh & prompt Grok 12s',ok:hasScenes,severity:'BLOCK',detail:hasScenes?`${scenes.length} cảnh × 12s (${scenes.length*12}s)`:'Chưa tạo cảnh'},
   {id:'QA05',label:'Mỗi cảnh có đủ START_STATE & END_STATE',ok:startEndFilled,severity:'BLOCK',detail:startEndFilled?'Đầy đủ trạng thái đầu/cuối':'Còn cảnh thiếu START/END_STATE'},
   {id:'QA06',label:'Nối cảnh liên tục: END_STATE S(n) === START_STATE S(n+1)',ok:continuityOk,severity:'BLOCK',detail:continuityOk?'Chuỗi nối cảnh khớp 100%':'Có cảnh bị đứt mạch START/END (dùng nút Đồng bộ)'},
   {id:'QA07',label:'Diễn xuất tối đa 1 chuyển động chính + 1 phụ & clip ≤ 15s',ok:actingLimitOk&&duration12sOk,severity:'BLOCK',detail:actingLimitOk&&duration12sOk?'Đạt chuẩn 12s và giới hạn chuyển động':'Kiểm tra motion_id hoặc thời lượng'},
   {id:'QA08',label:'Cổng duyệt kịch bản (STORY_APPROVED)',ok:storyApprovedOk,severity:'REVIEW',detail:storyApprovedOk?'Người dùng đã duyệt STORY_APPROVED':'Đang là DRAFT — cần người dùng duyệt trước khi khóa'},
   {id:'QA09',label:'Ảnh tham chiếu {PL_ID}_MASTER đã QA APPROVED',ok:mastersOk,severity:'BLOCK',detail:mastersOk?'Tất cả MASTER của dàn nhân vật đã APPROVED':'CẢNH BÁO DRAFT: chưa duyệt '+unapprovedMasters.join(', ')}
  ];
 },[invalidCastIds,duplicateCast,validCastChars,castPairRelations,castRelSummary,scenes,storyStatus,mergedAssets]);

 if(loading){
  return <section className="panel"><h2>Vũ trụ Phố Lắc Lư V3.0</h2><p className="muted">Đang tải 48 nhân vật, 105 quan hệ, 64 chuyển động, 24 biểu cảm và 384 mục Asset Queue...</p></section>;
 }
 if(loadError){
  return <section className="panel"><h2>Vũ trụ Phố Lắc Lư V3.0</h2><p className="danger">{loadError}</p></section>;
 }

 return <>
  <div className="grid3">
   <div className="metric"><span>Nhân vật Canon (Read-Only)</span><strong>{characters.length}</strong><span>8 nhóm · PL001 → PL048</span></div>
   <div className="metric"><span>Đồ thị Quan hệ & Diễn xuất</span><strong>{relationships.length}</strong><span>24 biểu cảm · 64 motion · 48 signature</span></div>
   <div className="metric"><span>Asset Factory (384 ảnh)</span><strong className={approvedMasterCount===48?'success':'warning'}>{approvedAssetCount}/{assetQueue.length}</strong><span>MASTER đã duyệt: {approvedMasterCount}/48</span></div>
  </div>

  <section className="panel">
   <div className="topbar" style={{marginBottom:12}}>
    <div>
     <h2>Vũ trụ Phố Lắc Lư V3.0 — Character Lock & Production Studio</h2>
     <div className="muted">Dữ liệu canon khóa cứng (read-only). Phong cách chuẩn: nền than #151820, kem ấm #F5EBD3, nét 2D người lớn.</div>
    </div>
    <div className="actions">
     <button className={project.style==='pholaclu'?'secondary':''} onClick={()=>{onApplyStyleAndCharacters({style:'pholaclu'});onNotice('Đã khóa phong cách Phố Lắc Lư Editorial 2D cho dự án hiện tại.');}}>
      <Lock size={14}/> {project.style==='pholaclu'?'Đang khóa Style Phố Lắc Lư':'Khóa Style Phố Lắc Lư cho dự án'}
     </button>
    </div>
   </div>
   <div className="sceneList" style={{marginBottom:0}}>
    <button className={subView==='canon'?'selected':''} onClick={()=>setSubView('canon')}><Users size={14} style={{verticalAlign:'middle',marginRight:6}}/>Canon & Quan hệ (48 NV)</button>
    <button className={subView==='factory'?'selected':''} onClick={()=>setSubView('factory')}><Layers size={14} style={{verticalAlign:'middle',marginRight:6}}/>Asset Factory (384 ảnh)</button>
    <button className={subView==='acting'?'selected':''} onClick={()=>setSubView('acting')}><Sparkles size={14} style={{verticalAlign:'middle',marginRight:6}}/>Diễn xuất (SM · MV · EX)</button>
    <button className={subView==='director'?'selected':''} onClick={()=>setSubView('director')}><Film size={14} style={{verticalAlign:'middle',marginRight:6}}/>Story → Nhịp 12s → Prompt & QA</button>
   </div>
  </section>

  {subView==='canon'&&<>
   <div className="grid">
    <section className="panel">
     <h2>Sổ 48 Nhân vật Canon</h2>
     <div className="grid">
      <div className="field">
       <label>Lọc theo 8 nhóm</label>
       <select value={familyFilter} onChange={e=>setFamilyFilter(e.target.value)}>
        {families.map(f=><option key={f} value={f}>{f}</option>)}
       </select>
      </div>
      <div className="field">
       <label>Tìm mã PL hoặc tên</label>
       <input value={charQuery} onChange={e=>setCharQuery(e.target.value)} placeholder="VD: PL001, Bơ, Mây, PL999..."/>
      </div>
     </div>
     {invalidQueryCode&&<div className="qaItem"><b className="danger">BLOCK · {invalidQueryCode}</b> — Mã nhân vật không có trong sổ canon PL001–PL048. Không tự tạo nhân vật mới.</div>}
     <div style={{maxHeight:420,overflow:'auto',display:'grid',gap:8}}>
      {filteredChars.map(c=><button key={c.id} className={activeChar?.id===c.id?'':'secondary'} style={{textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}} onClick={()=>setSelectedCharId(c.id)}>
       <span><b>{c.id}</b> · {c.name} <span className="mini" style={{color:'inherit',opacity:.85}}>({c.family} · {c.role})</span></span>
       <span style={{width:18,height:18,borderRadius:5,background:c.color_hex,border:'1px solid #fff4',flexShrink:0}} title={c.color_hex}/>
      </button>)}
      {!filteredChars.length&&!invalidQueryCode&&<p className="muted"><Search size={14}/> Không tìm thấy nhân vật khớp bộ lọc.</p>}
     </div>
    </section>

    <section className="panel">
     {activeChar&&<>
      <div className="topbar" style={{marginBottom:12}}>
       <div>
        <h2>{activeChar.id} — {activeChar.name}</h2>
        <div className="muted">{activeChar.family} · {activeChar.role} · {activeChar.age_label}</div>
       </div>
       <span className="chip" style={{background:activeChar.color_hex,color:'#111827',fontWeight:700}}>{activeChar.color_hex}</span>
      </div>
      <div className="qaItem"><b>Hình khối (Silhouette):</b> {activeChar.silhouette}</div>
      <div className="qaItem"><b>Gương mặt (Face):</b> {activeChar.face}</div>
      <div className="qaItem"><b>Trang phục (Outfit):</b> {activeChar.outfit}</div>
      <div className="qaItem"><b>Signature ({activeChar.signature_motion_id}):</b> {activeChar.signature_motion} <span className="mini">(Kích hoạt: {activeChar.trigger})</span></div>
      <div className="qaItem"><b>Tính cách & Arc:</b> Điểm mạnh: {activeChar.strength} · Khuyết điểm: {activeChar.flaw} · Arc: {activeChar.arc}</div>
      {activeChar.canon_note&&<div className="qaItem"><b className="warning">Canon Note:</b> {activeChar.canon_note}</div>}
      <div className="field" style={{marginTop:10}}>
       <label>Character Lock Prompt & Reference IDs</label>
       <div className="output" style={{maxHeight:130}}>{activeChar.lock}{'\n'}REFS: {activeChar.reference_ids.join(', ')}</div>
      </div>
      <div className="actions">
       <button className="secondary" onClick={()=>{navigator.clipboard.writeText(activeChar.lock).then(()=>onNotice(`Đã sao chép Lock của ${activeChar.id}`)).catch(()=>onNotice('Hãy sao chép từ ô Lock'))}}><Copy size={14}/> Chép Character Lock</button>
       <button onClick={()=>{setAssetCharFilter(activeChar.id);setSubView('factory');}}><Layers size={14}/> Xem 8 Asset của {activeChar.id}</button>
       <button className="ghost" onClick={()=>{if(!castIds.includes(activeChar.id))setCastIds(prev=>prev.length>=4?[...prev.slice(0,3),activeChar.id]:[...prev,activeChar.id]);onNotice(`Đã đưa ${activeChar.id} (${activeChar.name}) vào dàn diễn viên Scene Director.`);}}>+ Đưa vào Scene Director</button>
      </div>
     </>}
    </section>
   </div>

   <section className="panel">
    <div className="topbar" style={{marginBottom:12}}>
     <div>
      <h2>Kiểm tra Đồ thị Quan hệ Có hướng (A ↔ B)</h2>
      <div className="muted">Đọc chính xác A_QUAN_HE_VOI_B và B_QUAN_HE_VOI_A. Nếu không có bản ghi → cảnh báo CHƯA_XAC_NHAN, tuyệt đối không bịa quan hệ.</div>
     </div>
     <div className="actions">
      <button className="ghost" onClick={()=>{setRelCharA('PL001');setRelCharB('PL002');}}>Test: PL001 + PL002</button>
      <button className="ghost" onClick={()=>{setRelCharA('PL001');setRelCharB('PL007');}}>Test: PL001 + PL007</button>
      <button className="ghost" onClick={()=>{setRelCharA('PL043');setRelCharB('PL048');}}>Test: PL043 + PL048</button>
     </div>
    </div>
    <div className="grid">
     <div className="field">
      <label>Nhân vật A</label>
      <select value={relCharA} onChange={e=>setRelCharA(e.target.value)}>
       {characters.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name} ({c.family})</option>)}
      </select>
     </div>
     <div className="field">
      <label>Nhân vật B</label>
      <select value={relCharB} onChange={e=>setRelCharB(e.target.value)}>
       {characters.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name} ({c.family})</option>)}
      </select>
     </div>
    </div>
    <div className="grid3">
     <div className="metric"><span>{relCharA} → {relCharB}</span><strong style={{fontSize:20}}>{pairRelation.aToB}</strong><span>{byId[relCharA]?.name} là ... của {byId[relCharB]?.name}</span></div>
     <div className="metric"><span>{relCharB} → {relCharA}</span><strong style={{fontSize:20}}>{pairRelation.bToA}</strong><span>{byId[relCharB]?.name} là ... của {byId[relCharA]?.name}</span></div>
     <div className="metric">
      <span>Trạng thái Canon ({pairRelation.relId})</span>
      <strong style={{fontSize:18}} className={pairRelation.status==='CANON_NGUON'?'success':'warning'}>{pairRelation.status}</strong>
      <span>{pairRelation.note||pairRelation.evidence}</span>
     </div>
    </div>
    <div className="actions" style={{marginTop:12}}>
     <button className="secondary" onClick={()=>{setCastIds([relCharA,relCharB]);setSubView('director');onNotice(`Đã chọn cặp ${relCharA} + ${relCharB} vào Scene Director.`);}}><ArrowRightLeft size={14}/> Dựng truyện với cặp A–B này</button>
    </div>
   </section>
  </>}

  {subView==='factory'&&<>
   <section className="panel">
    <div className="topbar" style={{marginBottom:12}}>
     <div>
      <h2>Character Visual Factory — Hàng đợi 384 Asset</h2>
      <div className="muted">Trạng thái ban đầu CHƯA TẠO. Luật bắt buộc: phải QA APPROVED ảnh {'{PL_ID}'}_MASTER trước khi duyệt FRONT/SIDE/BACK/3Q/FACE/POSE/COLOR hoặc render video.</div>
     </div>
     <div className="actions">
      <button className="secondary" onClick={()=>{
       const header=['ASSET_ID','PL_ID','NAME','FAMILY','TYPE','RATIO','SOURCE_HEX','DEPENDENCY','STATUS','QA','FILE'];
       const rows=filteredAssets.map(a=>[a.ASSET_ID,a.PL_ID,a.NAME,a.FAMILY,a.TYPE,a.RATIO,a.SOURCE_HEX,a.DEPENDENCY,a.STATUS,a.QA,a.fileName||'']);
       download('PHO_LAC_LU_ASSET_QUEUE.csv',[header,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
      }}><Download size={14}/> Xuất CSV ({filteredAssets.length})</button>
      <button className="ghost" onClick={()=>download('PHO_LAC_LU_ASSET_QUEUE.json',JSON.stringify(filteredAssets,null,2),'application/json')}><Download size={14}/> Xuất JSON</button>
     </div>
    </div>
    <div className="grid3">
     <div className="field">
      <label>Nhân vật</label>
      <select value={assetCharFilter} onChange={e=>setAssetCharFilter(e.target.value)}>
       <option value="Tất cả">Tất cả 48 nhân vật (384 ảnh)</option>
       {characters.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Loại ảnh</label>
      <select value={assetTypeFilter} onChange={e=>setAssetTypeFilter(e.target.value)}>
       {['Tất cả','MASTER','FRONT','SIDE','BACK','3Q','FACE','POSE','COLOR'].map(t=><option key={t} value={t}>{t}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Trạng thái</label>
      <select value={assetStatusFilter} onChange={e=>setAssetStatusFilter(e.target.value)}>
       {['Tất cả','CHƯA TẠO','DRAFT','APPROVED','CẦN SỬA'].map(st=><option key={st} value={st}>{st}</option>)}
      </select>
     </div>
    </div>

    <div className="tableWrap">
     <table className="table">
      <thead>
       <tr>
        <th>Asset ID</th>
        <th>Nhân vật</th>
        <th>Loại / Tỷ lệ</th>
        <th>Phụ thuộc</th>
        <th>Trạng thái</th>
        <th>QA</th>
        <th>Thao tác & Prompt</th>
       </tr>
      </thead>
      <tbody>
       {filteredAssets.slice(0,80).map(a=>{
        const masterOk=isMasterApproved(a.PL_ID);
        const preview=localPreviews[a.ASSET_ID];
        return <tr key={a.ASSET_ID}>
         <td><b>{a.ASSET_ID}</b><div className="mini" style={{color:a.SOURCE_HEX}}>{a.SOURCE_HEX}</div></td>
         <td>{a.NAME}<div className="mini">{a.FAMILY}</div></td>
         <td><span className="chip">{a.TYPE}</span> · {a.RATIO}<div className="mini">{a.DESCRIPTION}</div></td>
         <td>
          {a.DEPENDENCY
           ?<span className={masterOk?'success':'warning'}>{a.DEPENDENCY} ({masterOk?'Đã duyệt':'Chưa duyệt'})</span>
           :<span className="mini">Gốc (MASTER)</span>}
          {preview&&<div style={{marginTop:6}}><img src={preview} alt={a.ASSET_ID} style={{width:56,height:56,objectFit:'cover',borderRadius:6,border:'1px solid #35465b'}}/><div className="mini">{a.fileName}</div></div>}
         </td>
         <td>
          <select value={a.STATUS} onChange={e=>updateAsset(a,{status:e.target.value})}>
           <option value="CHƯA TẠO">CHƯA TẠO</option>
           <option value="DRAFT">DRAFT</option>
           <option value="APPROVED">APPROVED</option>
           <option value="CẦN SỬA">CẦN SỬA</option>
          </select>
         </td>
         <td>
          <select value={a.QA} onChange={e=>updateAsset(a,{qa:e.target.value})}>
           <option value="CHƯA KIỂM">CHƯA KIỂM</option>
           <option value="ĐẠT">ĐẠT</option>
           <option value="CẦN SỬA">CẦN SỬA</option>
          </select>
         </td>
         <td>
          <div className="actions">
           <button className="secondary" onClick={()=>{navigator.clipboard.writeText(a.PROMPT).then(()=>onNotice(`Đã sao chép prompt ảnh ${a.ASSET_ID}`)).catch(()=>onNotice('Không thể sao chép tự động'));}}><Copy size={12}/> Chép Prompt</button>
           <label className="fileLabel" style={{padding:'6px 9px',fontSize:11}}><Upload size={12}/> Gắn ảnh<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)handleUploadAssetPreview(a,f);}}/></label>
          </div>
          <details style={{marginTop:6}}><summary className="mini" style={{cursor:'pointer'}}>Xem prompt tạo ảnh</summary><div className="output" style={{marginTop:6,maxHeight:150}}>{a.PROMPT}</div></details>
         </td>
        </tr>;
       })}
      </tbody>
     </table>
    </div>
    {filteredAssets.length>80&&<p className="mini" style={{marginTop:10}}>Đang hiển thị 80/{filteredAssets.length} mục đầu. Hãy lọc theo nhân vật hoặc loại ảnh để thao tác nhanh, hoặc xuất CSV để xem toàn bộ.</p>}
   </section>
  </>}

  {subView==='acting'&&<>
   <section className="panel">
    <div className="topbar" style={{marginBottom:12}}>
     <div>
      <h2>Thư viện Diễn xuất Chuẩn hóa</h2>
      <div className="muted">Phối tối đa 1 chuyển động chính (Motion Bank) + 1 chuyển động phụ hoặc Signature Motion cho mỗi cảnh 12s.</div>
     </div>
     <div className="actions">
      <button className={actingTab==='ex'?'':'secondary'} onClick={()=>setActingTab('ex')}>24 Biểu cảm (EX)</button>
      <button className={actingTab==='mv'?'':'secondary'} onClick={()=>setActingTab('mv')}>64 Motion Bank (MV)</button>
      <button className={actingTab==='sm'?'':'secondary'} onClick={()=>setActingTab('sm')}>48 Signature (SM)</button>
     </div>
    </div>

    {actingTab==='ex'&&<div className="tableWrap">
     <table className="table">
      <thead><tr><th>Mã</th><th>Biểu cảm</th><th>Chi tiết khuôn mặt & dáng</th><th>Cường độ / Nhân vật hợp</th><th>Chọn cho Scene</th></tr></thead>
      <tbody>
       {expressions.map(e=><tr key={e['Mã']}>
        <td><b>{e['Mã']}</b></td>
        <td>{e['Tên biểu cảm']}<div className="mini">{e['Trạng thái']} · {e['Thời gian biến đổi']}</div></td>
        <td>Mắt: {e['Mắt']} · Mày: {e['Lông mày']}<div className="mini">Miệng: {e['Miệng & má']} · Thân: {e['Vai, tay & thân']}</div><div className="mini warning">Tránh: {e['Điều cần tránh']}</div></td>
        <td>{e['Cường độ']}<div className="mini">{e['Nhân vật phù hợp']}</div></td>
        <td><button className="secondary" onClick={()=>{setSelectedExprId(e['Mã']);onNotice(`Đã chọn biểu cảm ${e['Mã']} (${e['Tên biểu cảm']}) làm mặc định cho Scene Director.`);}}>Dùng {e['Mã']}</button></td>
       </tr>)}
      </tbody>
     </table>
    </div>}

    {actingTab==='mv'&&<>
     <div className="field" style={{maxWidth:320}}>
      <label>Lọc nhóm hành động</label>
      <select value={motionGroupFilter} onChange={e=>setMotionGroupFilter(e.target.value)}>
       {motionGroups.map(g=><option key={g} value={g}>{g}</option>)}
      </select>
     </div>
     <div className="tableWrap">
      <table className="table">
       <thead><tr><th>Mã</th><th>Tên & Ý định</th><th>Nhịp 0–2 / 2–5 / 5–8 / 8–12s</th><th>Góc quay & Foley</th><th>Chọn cho Scene</th></tr></thead>
       <tbody>
        {motionBank.filter(m=>motionGroupFilter==='Tất cả'||m['Nhóm hành động']===motionGroupFilter).map(m=><tr key={m['Mã']}>
         <td><b>{m['Mã']}</b><div className="mini">{m['Nhóm hành động']}</div></td>
         <td>{m['Tên chuyển động']}<div className="mini">{m['Ý định cảm xúc']} · {m['Cường độ']}</div></td>
         <td>0–2s: {m['Chuẩn bị (0–2s)']} · 2–5s: {m['Diễn chính (2–5s)']}<div className="mini">5–8s: {m['Phản ứng (5–8s)']} · 8–12s: {m['Kết thúc (8–12s)']}</div></td>
         <td>{m['Gợi ý góc quay']}<div className="mini">Foley: {m['Âm thanh phụ']}</div></td>
         <td>
          <div className="actions">
           <button className="secondary" onClick={()=>{setSelectedMainMotionId(m['Mã']);onNotice(`Đã đặt ${m['Mã']} làm chuyển động chính.`);}}>Chính</button>
           <button className="ghost" onClick={()=>{setSelectedSubMotionId(m['Mã']);onNotice(`Đã đặt ${m['Mã']} làm chuyển động phụ.`);}}>Phụ</button>
          </div>
         </td>
        </tr>)}
       </tbody>
      </table>
     </div>
    </>}

    {actingTab==='sm'&&<div className="tableWrap">
     <table className="table">
      <thead><tr><th>Mã SM</th><th>Nhân vật</th><th>Kích hoạt & 3 Pha</th><th>Nhịp 12s & Nguyên tắc</th></tr></thead>
      <tbody>
       {signatureMotions.map(sm=><tr key={sm['Mã chuyển động']}>
        <td><b>{sm['Mã chuyển động']}</b></td>
        <td>{sm['Mã nhân vật']} · {sm['Tên']}<div className="mini">{sm['Nhóm']}</div></td>
        <td><b>Kích hoạt:</b> {sm['Điều kiện kích hoạt']}<div className="mini">{sm['Pha 1 – Chuẩn bị']} → {sm['Pha 2 – Điểm nhấn']} → {sm['Pha 3 – Hậu phản ứng']}</div></td>
        <td>{sm['Phân bổ nhịp 12s']}<div className="mini warning">{sm['Giới hạn tái sử dụng']}</div></td>
       </tr>)}
      </tbody>
     </table>
    </div>}
   </section>
  </>}

  {subView==='director'&&<>
   <section className="panel">
    <h2>1. Hạt giống truyện DRAFT (24 Story Seeds)</h2>
    <div className="field">
     <label>Nạp nhanh ý tưởng mẫu (trạng thái DRAFT — không phải canon mới)</label>
     <select defaultValue="" onChange={e=>{const seed=storySeeds.find(s=>s.STORY_ID===e.target.value);if(seed)loadSeed(seed);}}>
      <option value="">-- Chọn từ 24 Story Seeds Phố Lắc Lư --</option>
      {storySeeds.map(s=><option key={s.STORY_ID} value={s.STORY_ID}>{s.STORY_ID} · {s.TITLE} ({s.A_NAME} + {s.B_NAME})</option>)}
     </select>
    </div>
   </section>

   <section className="panel">
    <h2>2. Story Engine & Scene Director (12 giây/cảnh)</h2>
    <div className="grid">
     <div className="field">
      <label>Nhân vật A (Trái)</label>
      <select value={castIds[0]||''} onChange={e=>setCastIds(prev=>[e.target.value,...prev.slice(1)])}>
       {characters.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Nhân vật B (Phải)</label>
      <select value={castIds[1]||''} onChange={e=>setCastIds(prev=>[prev[0]||'PL001',e.target.value,...prev.slice(2)])}>
       {characters.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Nhân vật C (tùy chọn)</label>
      <select value={castIds[2]||''} onChange={e=>{const v=e.target.value;setCastIds(prev=>v?[prev[0],prev[1],v,...(prev[3]?[prev[3]]:[])]:prev.slice(0,2));}}>
       <option value="">-- Không dùng --</option>
       {characters.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Nhân vật D / Kiểm tra chặn mã lạ (VD: PL999)</label>
      <input value={manualIdTest} onChange={e=>setManualIdTest(e.target.value)} placeholder="Để trống hoặc gõ PL005 / PL999 để test QA BLOCK"/>
     </div>
    </div>

    <div className="qaItem" style={{marginBottom:12}}>
     <b>Quan hệ xác thực của dàn nhân vật:</b> {castRelSummary}
     {invalidCastIds.length>0&&<div className="danger" style={{marginTop:4}}>BLOCK: Mã không tồn tại trong sổ canon: {invalidCastIds.join(', ')}</div>}
    </div>

    <div className="grid3">
     <div className="field">
      <label>Chủ đề / Mâu thuẫn câu chuyện</label>
      <input value={storyTopic} onChange={e=>setStoryTopic(e.target.value)}/>
     </div>
     <div className="field">
      <label>Thời lượng mục tiêu (mỗi cảnh 12s)</label>
      <select value={storyDuration} onChange={e=>setStoryDuration(Number(e.target.value) as 24|36|48|60)}>
       <option value={24}>24 giây · 2 cảnh × 12s</option>
       <option value={36}>36 giây · 3 cảnh × 12s</option>
       <option value={48}>48 giây · 4 cảnh × 12s</option>
       <option value={60}>60 giây · 5 cảnh × 12s</option>
      </select>
     </div>
     <div className="field">
      <label>Không khí / Giọng điệu</label>
      <select value={storyTone} onChange={e=>setStoryTone(e.target.value)}>
       <option>Hài ấm áp</option>
       <option>Không lời ngộ nghĩnh</option>
       <option>Gia đình cảm động</option>
       <option>Bài học cuộc sống</option>
      </select>
     </div>
    </div>

    <div className="grid3">
     <div className="field">
      <label>Biểu cảm mặc định (EX)</label>
      <select value={selectedExprId} onChange={e=>setSelectedExprId(e.target.value)}>
       {expressions.map(ex=><option key={ex['Mã']} value={ex['Mã']}>{ex['Mã']} · {ex['Tên biểu cảm']}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Chuyển động chính (MV)</label>
      <select value={selectedMainMotionId} onChange={e=>setSelectedMainMotionId(e.target.value)}>
       {motionBank.map(m=><option key={m['Mã']} value={m['Mã']}>{m['Mã']} · {m['Tên chuyển động']}</option>)}
      </select>
     </div>
     <div className="field">
      <label>Chuyển động phụ (tối đa 1)</label>
      <select value={selectedSubMotionId} onChange={e=>setSelectedSubMotionId(e.target.value)}>
       <option value="">-- Không thêm chuyển động phụ --</option>
       {motionBank.map(m=><option key={m['Mã']} value={m['Mã']}>{m['Mã']} · {m['Tên chuyển động']}</option>)}
      </select>
     </div>
    </div>

    <div className="actions">
     <button className="secondary" onClick={generateTemplateScenes} disabled={geminiBusy}>Lập nhịp 12s (Mẫu nội bộ)</button>
     <button onClick={generateGeminiStory} disabled={geminiBusy}><Sparkles size={14}/> {geminiBusy?'Gemini đang viết truyện...':'Sinh truyện & cảnh 12s (Gemini)'}</button>
     <button className={storyStatus==='STORY_APPROVED'?'secondary':'ghost'} onClick={()=>setStoryStatus(s=>s==='DRAFT'?'STORY_APPROVED':'DRAFT')}>
      {storyStatus==='STORY_APPROVED'?'✓ Đã duyệt: STORY_APPROVED':'Duyệt kịch bản → STORY_APPROVED'}
     </button>
    </div>
    <p className="mini" style={{marginTop:8}}>Nguồn hiện tại: <b>{storyEngineMode==='gemini'?'AI Gemini (DRAFT)':storyEngineMode==='sample'?'Cảnh mẫu DRAFT':'Mẫu nội bộ (không phải AI)'}</b> · Trạng thái kịch bản: <b className={storyStatus==='STORY_APPROVED'?'success':'warning'}>{storyStatus}</b></p>

    {storyNarration&&<div className="field" style={{marginTop:10}}>
     <label>Lời kể tiếng Việt (có thể chỉnh sửa trước khi đẩy sang Kịch bản / Storyboard)</label>
     <textarea rows={4} value={storyNarration} onChange={e=>setStoryNarration(e.target.value)}/>
    </div>}
   </section>

   <section className="panel">
    <div className="topbar" style={{marginBottom:12}}>
     <div>
      <h2>3. Danh sách cảnh 12s & Grok Video Prompt ({scenes.length} cảnh)</h2>
      <div className="muted">Kiểm chặt START_STATE và END_STATE trước khi xuất sang Storyboard / Prompt Grok.</div>
     </div>
     <div className="actions">
      <button className="ghost" disabled={scenes.length<2} onClick={syncContinuityChain}>Khớp END→START toàn bộ</button>
      <button className="secondary" disabled={!scenes.length} onClick={()=>{navigator.clipboard.writeText(scenes.map(s=>s.prompt).join('\n\n'+'='.repeat(50)+'\n\n')).then(()=>onNotice('Đã sao chép toàn bộ prompt Phố Lắc Lư.')).catch(()=>onNotice('Không thể sao chép tự động'));}}><Copy size={14}/> Copy tất cả</button>
      <button className="secondary" disabled={!scenes.length} onClick={()=>download('PHO_LAC_LU_PROMPTS_12S.txt',scenes.map(s=>s.prompt).join('\n\n'+'='.repeat(56)+'\n\n'))}><Download size={14}/> Xuất TXT</button>
      <button className="secondary" disabled={!scenes.length} onClick={()=>download('PHO_LAC_LU_SCENES.json',JSON.stringify({storyStatus,characters:validCastChars.map(c=>c.id),relationships:castPairRelations,scenes},null,2),'application/json')}><Download size={14}/> Xuất JSON</button>
      <button disabled={!scenes.length} onClick={pushToMainStoryboard}><Send size={14}/> Đẩy sang Storyboard & Prompt Grok</button>
     </div>
    </div>

    {!scenes.length?<p className="muted">Chưa có cảnh. Hãy chọn 2–4 nhân vật và bấm “Lập nhịp 12s (Mẫu nội bộ)” hoặc “Sinh truyện & cảnh 12s (Gemini)”.</p>:
    scenes.map((sc,idx)=><div key={sc.scene_id} className="panel subpanel">
     <div className="topbar" style={{marginBottom:10}}>
      <div><strong>{sc.scene_id} · {sc.beat}</strong> <span className="chip">{sc.duration_sec}s</span> <span className="chip">{sc.character_ids.join(' + ')}</span></div>
      <button className="secondary" onClick={()=>{navigator.clipboard.writeText(sc.prompt).then(()=>onNotice(`Đã sao chép prompt ${sc.scene_id}`)).catch(()=>onNotice('Sao chép thủ công từ ô prompt'));}}><Copy size={13}/> Chép Prompt</button>
     </div>
     <div className="grid3">
      <div className="field">
       <label>Biểu cảm (EX)</label>
       <select value={sc.expression_id} onChange={e=>mutateSceneDraft(idx,{expression_id:e.target.value})}>
        {expressions.map(ex=><option key={ex['Mã']} value={ex['Mã']}>{ex['Mã']} · {ex['Tên biểu cảm']}</option>)}
       </select>
      </div>
      <div className="field">
       <label>Motion chính (MV)</label>
       <select value={sc.main_motion_id} onChange={e=>mutateSceneDraft(idx,{main_motion_id:e.target.value})}>
        {motionBank.map(m=><option key={m['Mã']} value={m['Mã']}>{m['Mã']} · {m['Tên chuyển động']}</option>)}
       </select>
      </div>
      <div className="field">
       <label>Motion phụ (tùy chọn)</label>
       <select value={sc.sub_motion_id} onChange={e=>mutateSceneDraft(idx,{sub_motion_id:e.target.value})}>
        <option value="">-- Không --</option>
        {motionBank.map(m=><option key={m['Mã']} value={m['Mã']}>{m['Mã']} · {m['Tên chuyển động']}</option>)}
       </select>
      </div>
     </div>
     <div className="grid">
      <div className="field"><label>Hành động chính (2–10s)</label><input value={sc.action} onChange={e=>mutateSceneDraft(idx,{action:e.target.value})}/></div>
      <div className="field"><label>Bối cảnh & Ánh sáng</label><input value={sc.location} onChange={e=>mutateSceneDraft(idx,{location:e.target.value})}/></div>
      <div className="field"><label>Đạo cụ trung tâm</label><input value={sc.props} onChange={e=>mutateSceneDraft(idx,{props:e.target.value})}/></div>
      <div className="field"><label>Ánh sáng / Tông màu</label><input value={sc.lighting} onChange={e=>mutateSceneDraft(idx,{lighting:e.target.value})}/></div>
      <div className="field"><label>START_STATE (0–2s)</label><input value={sc.start_state} onChange={e=>mutateSceneDraft(idx,{start_state:e.target.value})}/></div>
      <div className="field"><label>END_STATE (10–12s)</label><input value={sc.end_state} onChange={e=>mutateSceneDraft(idx,{end_state:e.target.value})}/></div>
     </div>
     <details>
      <summary className="mini" style={{cursor:'pointer'}}>Xem / Sao chép Prompt Grok hoàn chỉnh ({sc.scene_id})</summary>
      <div className="output" style={{marginTop:8}}>{sc.prompt}</div>
     </details>
    </div>)}
   </section>

   <section className="panel">
    <h2><ShieldCheck size={16} style={{verticalAlign:'middle',marginRight:6}}/>4. Bảng kiểm QA IF/ELSE — Phố Lắc Lư V3.0</h2>
    <div className="grid">
     {qaChecks.map(q=><div key={q.id} className="qaItem">
      <b className={q.ok?'success':(q.severity==='BLOCK'?'danger':'warning')}>
       {q.ok?<CheckCircle2 size={13} style={{verticalAlign:'middle',marginRight:5}}/>:<AlertTriangle size={13} style={{verticalAlign:'middle',marginRight:5}}/>}
       {q.id} · {q.ok?'PASS':q.severity} — {q.label}
      </b>
      <div className="mini" style={{marginTop:3}}>{q.detail}</div>
     </div>)}
    </div>
   </section>
  </>}
 </>;
}
