'use strict';
/* Floraison V4 : périodes datées et blocs matin/après-midi.
   Compatibilité : la vue historique reste active tant que les tables SQL V4 n'existent pas. */
const serreV4={ready:false,mode:'month',selectedPeriod:null,weekOffset:0,weekAnchor:null,error:null};
const serreOldGetAll=getAll,serreOldBloom=bloom,serreOldExport=exportJson;
const isoDay=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dayDate=s=>new Date(s+'T12:00:00');
const dayShift=(s,n)=>{const d=dayDate(s);d.setDate(d.getDate()+n);return isoDay(d)};
const dayLabel=s=>dayDate(s).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
const dayDiff=(a,b)=>Math.round((dayDate(b)-dayDate(a))/86400000);
const serreEscape=escapeHtml;
getAll=async function(){
 await serreOldGetAll();
 const [p,b]=await Promise.all([db.from('serre_milestone_periods').select('*'),db.from('serre_time_blocks').select('*')]);
 serreV4.ready=!p.error&&!b.error;
 serreV4.error=p.error?.message||b.error?.message||null;
 st.periods=p.data||[];st.blocks=b.data||[];
};
exportJson=function(){serreOldExport();};
function serreVisible(m){if(!bloomState.filter)return true;let id=m.project_id;const seen=new Set();while(id&&!seen.has(id)){if(id===bloomState.filter)return true;seen.add(id);id=project(id)?.parent_id}return false}
function serrePeriods(m){return st.periods.filter(p=>p.milestone_id===m.id)}
function serreMonthDays(){const first=st.month+'-01';return Array.from({length:new Date(+st.month.slice(0,4),+st.month.slice(5),0).getDate()},(_,i)=>dayShift(first,i))}
function serreProjectRows(){return st.projects.filter(p=>p.status==='active').filter(p=>st.milestones.some(m=>m.project_id===p.id&&serreVisible(m)&&serrePeriods(m).some(x=>x.start_date<=st.month+'-31'&&x.end_date>=st.month+'-01')))}
function serreMonth(){
 const days=serreMonthDays(),last=days.at(-1),todayIso=isoDay(new Date());
 const projects=serreProjectRows();
 const header='<div class="v4-dates">'+days.map(d=>'<span class="'+(d===todayIso?'v4-today':'')+'" title="'+d+'">'+dayDate(d).getDate()+'</span>').join('')+'</div>';
 const rows=projects.map(p=>{
  const ms=st.milestones.filter(m=>m.project_id===p.id&&serreVisible(m));
  const items=ms.flatMap(m=>serrePeriods(m).filter(x=>x.start_date<=last&&x.end_date>=days[0]).map(x=>({m,x})));
  return '<div class="v4-project-row"><div class="v4-row-label">'+tag(p)+'</div><div class="v4-row-tracks">'+items.map(({m,x})=>{
   const from=Math.max(0,dayDiff(days[0],x.start_date)),to=Math.min(days.length-1,dayDiff(days[0],x.end_date));
   return '<div class="v4-track" style="--color:'+serreEscape(p.color_hex||'#809e87')+'"><div class="v4-track-grid">'+days.map(d=>'<span data-v4-date="'+d+'"></span>').join('')+'</div><div class="v4-ribbon '+(bloomState.selected===m.id?'v4-selected':'')+'" style="left:calc('+from+' * 100% / '+days.length+');width:calc('+(to-from+1)+' * 100% / '+days.length+')" draggable="true" data-v4-period="'+x.id+'" data-v4-start="'+x.start_date+'" data-action="v4select" data-id="'+m.id+'" title="'+serreEscape(m.title)+' : '+x.start_date+' au '+x.end_date+'"><span class="v4-ribbon-text">'+serreEscape(m.title)+'</span><button class="v4-resize" data-action="v4editperiod" data-period="'+x.id+'" title="Modifier les dates" draggable="false">↔</button></div></div>';
  }).join('')+'</div></div>';
 }).join('');
 return '<div class="v4-month"><div class="v4-month-heading"><b>Projets</b>'+header.replace('class="v4-dates"','class="v4-dates" style="grid-template-columns:repeat('+days.length+',minmax(0,1fr))"')+'</div>'+(rows||'<div class="notice">Aucune période datée pour ce mois. Choisis un jalon dans un projet, puis « Ajouter une période ».</div>')+'</div>';
}
function serreWeek(){
 const anchor=serreV4.weekAnchor||isoDay(new Date()),base=dayShift(anchor,-(dayDate(anchor).getDay()+6)%7+serreV4.weekOffset*7);
 const days=Array.from({length:7},(_,i)=>dayShift(base,i));
 const milestones=st.milestones.filter(m=>serreVisible(m)&&project(m.project_id)?.status==='active');
 const cells=days.map(d=>'<div class="v4-day"><strong>'+dayDate(d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})+'</strong>'+['morning','afternoon'].map(part=>{
  const blocks=st.blocks.filter(x=>x.block_date===d&&x.day_part===part).filter(x=>milestones.some(m=>m.id===x.milestone_id));
  return '<div class="v4-slot" data-v4-date="'+d+'" data-v4-part="'+part+'"><small>'+(part==='morning'?'☀ Matin':'☾ Après-midi')+'</small>'+blocks.map(x=>{const m=st.milestones.find(y=>y.id===x.milestone_id),p=project(m.project_id);return '<div class="v4-block" draggable="true" data-v4-block="'+x.id+'" data-action="v4select" data-id="'+m.id+'" style="--color:'+serreEscape(p?.color_hex||'#809e87')+'">'+serreEscape(m.title)+' <button class="v4-remove" data-action="v4removeblock" data-id="'+x.id+'" title="Retirer ce bloc">×</button></div>'}).join('')+'<button class="v4-add" data-action="v4addblock" data-date="'+d+'" data-part="'+part+'">+ Réserver</button></div>';
 }).join('')+'</div>').join('');
 return '<div class="v4-week-nav"><button class="btn small" data-action="v4prevweek">← Semaine précédente</button><b>'+dayLabel(days[0])+' au '+dayLabel(days[6])+'</b><button class="btn small" data-action="v4today">Aujourd’hui</button><button class="btn small" data-action="v4nextweek">Semaine suivante →</button></div><div class="v4-week">'+cells+'</div><p class="muted small">Les demi-journées sont des réservations de temps, pas des échéances. Glisse un bloc vers un autre créneau pour le déplacer.</p>';
}
function serreDetails(){
 const m=st.milestones.find(x=>x.id===bloomState.selected);
 if(!m)return '<aside class="bloom-details"><h3>Fiche du jalon</h3><p class="muted">Sélectionne un ruban ou un bloc pour voir son jalon.</p></aside>';
 const periods=serrePeriods(m).sort((a,b)=>a.start_date.localeCompare(b.start_date));
 return '<aside class="bloom-details"><div class="between"><h3>Jalon</h3><button class="btn small" data-action="bloomdetails">×</button></div><p>'+tag(project(m.project_id))+'</p><h3>'+serreEscape(m.title)+'</h3><p class="muted small">Périodes de planification</p>'+periods.map(x=>'<div class="v4-period-line">'+dayLabel(x.start_date)+' → '+dayLabel(x.end_date)+' <button class="btn small" data-action="v4editperiod" data-period="'+x.id+'">Modifier</button><button class="btn small" data-action="v4removeperiod" data-period="'+x.id+'">×</button></div>').join('')+'<div class="bloom-detail-actions"><button class="btn primary" data-action="v4addperiod" data-id="'+m.id+'">+ Ajouter une période</button><button class="btn" data-action="editmilestone" data-id="'+m.id+'">Modifier le jalon</button></div>'+(m.hard_deadline?'<p class="muted small">Échéance ferme : '+serreEscape(m.hard_deadline)+'</p>':'')+'<p class="muted small">Déplacer une période ou un bloc ne modifie pas cette échéance.</p></aside>';
}
bloom=function(){
 if(!serreV4.ready)return '<div class="notice"><b>Floraison V4 : connexion aux nouvelles tables indisponible.</b><p>'+serreEscape(serreV4.error||'Chargement en cours. Recharge la page si le problème persiste.')+'</p><p>Les anciennes données sont conservées. Vérifie la migration SQL et les autorisations Supabase.</p></div>'+serreOldBloom();
 return '<div class="bloom-layout '+(!bloomState.sidebar?'no-sidebar ':'')+(!bloomState.details?'no-details':'')+'">'+(bloomState.sidebar?bloomSidebar():'')+'<main class="bloom-main"><div class="top"><div><h2>Floraison</h2><p class="muted">Dates réelles et temps réservé, sans transformer tes prévisions en obligations.</p></div>'+monthControls()+'</div><div class="bloom-toolbar">'+(!bloomState.sidebar?'<button class="btn small" data-action="bloomsidebar">☰ Projets</button>':'')+'<button class="btn small '+(serreV4.mode==='month'?'primary':'')+'" data-action="v4mode" data-mode="month">Vue Mois</button><button class="btn small '+(serreV4.mode==='week'?'primary':'')+'" data-action="v4mode" data-mode="week">Zoom Semaine</button><button class="btn small '+(serreV4.mode==='horizon'?'primary':'')+'" data-action="v4mode" data-mode="horizon">Horizons</button>'+(!bloomState.details?'<button class="btn small" data-action="bloomdetails">☷ Fiche</button>':'')+'</div>'+((st.weeks.length&&!st.periods.length?'<div class="notice">Tes placements hebdomadaires existent toujours. <button class="btn small" data-action="v4importweeks">Convertir en périodes datées</button></div>':'')+(serreV4.mode==='week'?serreWeek():serreV4.mode==='horizon'?serreHorizons():serreMonth()))+'</main>'+(bloomState.details?serreDetails():'')+'</div>';
};
function serreHorizons(){
 const hs=st.horizons.filter(h=>!bloomState.filter||h.project_id===bloomState.filter||project(h.project_id)?.parent_id===bloomState.filter);
 return '<div class="v4-horizons">'+(hs.map(h=>'<article class="card"><p>'+tag(project(h.project_id))+'</p><h3>T'+h.quarter+' '+h.year+' · '+serreEscape(h.title)+'</h3>'+st.milestones.filter(m=>m.horizon_id===h.id).map(m=>'<button class="v4-horizon-milestone" data-action="v4select" data-id="'+m.id+'">'+serreEscape(m.title)+'</button>').join('')+'</article>').join('')||'<p class="muted">Aucun horizon pour cette sélection.</p>')+'</div>';
}
function serrePeriodEditor(id,periodId){
 const old=st.periods.find(x=>x.id===periodId);
 const start=old?.start_date||st.month+'-01',end=old?.end_date||start;
 openEditor(old?'Modifier les dates':'Ajouter une période','<p class="muted">Ces dates décrivent la planification du jalon, pas son échéance ferme.</p><label>Début<input name="start_date" type="date" value="'+start+'" required></label><label>Fin<input name="end_date" type="date" value="'+end+'" required></label>',async f=>{
  const a=f.get('start_date'),b=f.get('end_date');if(b<a)throw Error('La fin doit suivre le début.');
  const obj={start_date:a,end_date:b};if(!old)obj.milestone_id=id;
  await persist('serre_milestone_periods',obj,old?.id);
 });
}
function serreBlockEditor(date,part){
 const ms=st.milestones.filter(m=>project(m.project_id)?.status==='active'&&serreVisible(m));
 if(!ms.length){alert('Crée d’abord un jalon dans un projet actif.');return}
 openEditor('Réserver une demi-journée','<p class="muted">'+dayLabel(date)+' · '+(part==='morning'?'Matin':'Après-midi')+'</p><label>Jalon<select name="milestone_id">'+ms.map(m=>'<option value="'+m.id+'">'+serreEscape(project(m.project_id)?.name)+' · '+serreEscape(m.title)+'</option>').join('')+'</select></label>',async f=>{
  await persist('serre_time_blocks',{milestone_id:f.get('milestone_id'),block_date:date,day_part:part});
 });
}
let serreDrag=null;
document.addEventListener('click',async e=>{
 if(!serreV4.ready||st.tab!=='bloom')return;
 const b=e.target.closest('[data-action]');if(!b)return;
 const act=b.dataset.action;
 if(!act.startsWith('v4'))return;
 e.stopImmediatePropagation();
 try{
  if(act==='v4importweeks')await serreImportWeeks();
  if(act==='v4mode'){serreV4.mode=b.dataset.mode;if(serreV4.mode==='week'){serreV4.weekAnchor=isoDay(new Date());serreV4.weekOffset=0}render()}
  if(act==='v4today'){serreV4.weekAnchor=isoDay(new Date());serreV4.weekOffset=0;st.month=serreV4.weekAnchor.slice(0,7);render()}
  if(act==='v4select'){bloomState.selected=b.dataset.id;bloomState.details=true;render()}
  if(act==='v4prevweek'){serreV4.weekOffset--;render()}
  if(act==='v4nextweek'){serreV4.weekOffset++;render()}
  if(act==='v4addperiod')serrePeriodEditor(b.dataset.id);
  if(act==='v4editperiod')serrePeriodEditor(null,b.dataset.period);
  if(act==='v4removeperiod'&&confirm('Retirer cette période de planification ? Le jalon restera intact.'))await erase('serre_milestone_periods',b.dataset.period);
  if(act==='v4addblock')serreBlockEditor(b.dataset.date,b.dataset.part);
  if(act==='v4removeblock')await erase('serre_time_blocks',b.dataset.id);
 }catch(err){alert(err.message)}
},true);
document.addEventListener('dragstart',e=>{
 if(!serreV4.ready||st.tab!=='bloom')return;
 const b=e.target.closest('[data-v4-block]'),p=e.target.closest('[data-v4-period]');
 if(!b&&!p)return;
 serreDrag=b?{type:'block',id:b.dataset.v4Block}:{type:'period',id:p.dataset.v4Period,start:p.dataset.v4Start};
 e.dataTransfer.setData('text/plain',serreDrag.id);e.dataTransfer.effectAllowed='move';
},true);
document.addEventListener('dragover',e=>{if(!serreDrag)return;const target=e.target.closest('[data-v4-date]');if(target)e.preventDefault()},true);
document.addEventListener('drop',async e=>{
 if(!serreDrag)return;const target=e.target.closest('[data-v4-date]');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();const drag=serreDrag;serreDrag=null;
 try{
  if(drag.type==='block'){
   const obj=st.blocks.find(x=>x.id===drag.id);if(!obj)return;
   const r=await db.from('serre_time_blocks').update({block_date:target.dataset.v4Date,day_part:target.dataset.v4Part||obj.day_part}).eq('id',drag.id);
   if(r.error)throw r.error;await reload();
  }else{
   const obj=st.periods.find(x=>x.id===drag.id);if(!obj)return;
   const delta=dayDiff(drag.start,target.dataset.v4Date);
   const r=await db.from('serre_milestone_periods').update({start_date:dayShift(obj.start_date,delta),end_date:dayShift(obj.end_date,delta)}).eq('id',drag.id);
   if(r.error)throw r.error;await reload();
  }
 }catch(err){alert('Déplacement impossible : '+err.message)}
},true);
document.addEventListener('dragend',()=>{serreDrag=null},true);

async function serreImportWeeks(){
 if(!confirm('Convertir les placements hebdomadaires en périodes datées ? Les anciennes semaines seront conservées.'))return;
 const groups=new Map();
 for(const w of st.weeks){const a=groups.get(w.milestone_id)||[];a.push(w.week_start);groups.set(w.milestone_id,a)}
 const additions=[];
 for(const [id,starts] of groups){
  if(st.periods.some(p=>p.milestone_id===id))continue;
  starts.sort();let a=starts[0],b=a;
  for(let i=1;i<starts.length;i++){
   if(dayDiff(b,starts[i])===7)b=starts[i];
   else{additions.push({milestone_id:id,start_date:a,end_date:dayShift(b,6)});a=b=starts[i]}
  }
  additions.push({milestone_id:id,start_date:a,end_date:dayShift(b,6)});
 }
 if(!additions.length){alert('Aucune période à importer.');return}
 const r=await db.from('serre_milestone_periods').insert(additions);
 if(r.error)throw r.error;
 await reload();
}

// Un chargement déjà démarré avant ce module peut encore utiliser l’ancienne version.
setTimeout(()=>{if(st.user)reload()},350);
