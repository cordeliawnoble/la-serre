'use strict';
/* Floraison V4 · habillage graphique : explorateur, calendrier à rubans, fiche en tiroir. */
bloomState.details=false;
const serreFolderState={search:'',archives:false};
function serreExplorer(){
 const query=serreFolderState.search.trim().toLocaleLowerCase('fr');
 const matches=p=>p.name.toLocaleLowerCase('fr').includes(query)||childrenOf(p.id).some(matches);
 const node=(p,depth=0)=>{
  if(query&&!matches(p))return '';
  const kids=childrenOf(p.id).filter(k=>k.status===p.status);
  const expanded=query||!bloomState.collapsed.has(p.id);
  const count=kids.length?' <span class="v4-tree-count">'+kids.length+'</span>':'';
  return '<div class="v4-tree-node"><div class="v4-tree-line" style="padding-left:'+(depth*14)+'px">'+(kids.length?'<button class="v4-tree-toggle" data-action="bloomfold" data-id="'+p.id+'" aria-label="Déplier ou replier">'+(expanded?'⌄':'›')+'</button>':'<span class="v4-tree-spacer"></span>')+'<button class="v4-tree-name '+(bloomState.filter===p.id?'active':'')+'" data-action="bloomfilter" data-id="'+p.id+'" style="--tree-color:'+serreEscape(p.color_hex||'#8aa89b')+'"><span class="v4-tree-dot"></span><span>'+serreEscape(p.icon_name||'')+' '+serreEscape(p.name)+'</span>'+count+'</button></div>'+(expanded?kids.map(k=>node(k,depth+1)).join(''):'')+'</div>';
 };
 const active=st.projects.filter(p=>p.status==='active'),roots=active.filter(p=>!p.parent_id||project(p.parent_id)?.status!=='active');
 const archived=st.projects.filter(p=>p.status!=='active');
 return '<aside class="v4-explorer"><div class="between"><h3>Projets</h3><button class="btn small" data-action="bloomsidebar" aria-label="Masquer les projets">‹</button></div><input class="v4-project-search" data-v4-search placeholder="Rechercher un projet…" value="'+serreEscape(serreFolderState.search)+'" aria-label="Rechercher un projet"><button class="v4-tree-all '+(!bloomState.filter?'active':'')+'" data-action="bloomfilter" data-id="">🌿 Tous les projets</button><div class="v4-tree-group">♧ Projets actifs <span>'+active.length+'</span></div>'+roots.map(p=>node(p)).join('')+'<button class="v4-tree-archive" data-action="v4archives">▢ Projets archivés <span>'+archived.length+'</span> '+(serreFolderState.archives?'⌄':'›')+'</button>'+(serreFolderState.archives?archived.filter(p=>!p.parent_id||project(p.parent_id)?.status==='active'||!project(p.parent_id)).map(p=>node(p)).join(''):'')+'</aside>';
}
function serreCalendar(){
 const first=st.month+'-01',last=serreMonthDays().at(-1),offset=(dayDate(first).getDay()+6)%7;
 const start=dayShift(first,-offset),weekCount=Math.ceil((offset+serreMonthDays().length)/7);
 const visible=st.milestones.filter(m=>serreVisible(m)&&project(m.project_id)?.status==='active');
 const todayIso=isoDay(new Date());
 let rows='';
 for(let w=0;w<weekCount;w++){
  const weekStart=dayShift(start,w*7),weekEnd=dayShift(weekStart,6);
  const entries=visible.flatMap(m=>serrePeriods(m).filter(p=>p.start_date<=weekEnd&&p.end_date>=weekStart).map(p=>({m,p,from:Math.max(0,dayDiff(weekStart,p.start_date)),to:Math.min(6,dayDiff(weekStart,p.end_date))})));
  entries.sort((a,b)=>a.from-b.from||b.to-a.to||a.m.title.localeCompare(b.m.title));
  const lanes=[];for(const e of entries){let lane=lanes.findIndex(end=>end<e.from);if(lane<0){lane=lanes.length;lanes.push(e.to)}else lanes[lane]=e.to;e.lane=lane}
  const dates=Array.from({length:7},(_,i)=>dayShift(weekStart,i));
  const cells=dates.map(d=>'<div class="v4-calendar-day '+(d.slice(0,7)!==st.month?'outside':'')+' '+(d===todayIso?'today':'')+'" data-v4-date="'+d+'"><span>'+dayDate(d).getDate()+'</span></div>').join('');
  const bands=entries.map(e=>{const p=project(e.m.project_id),color=serreEscape(p?.color_hex||'#809e87');
   const starts=e.p.start_date>=weekStart,ends=e.p.end_date<=weekEnd;
   return '<div class="v4-calendar-band '+(starts?'begins':'continues')+' '+(ends?'ends':'ongoing')+'" style="--band:'+color+';left:calc('+e.from+' * 100% / 7 + 4px);width:calc('+(e.to-e.from+1)+' * 100% / 7 - 8px);top:'+(e.lane*30)+'px" draggable="true" data-v4-period="'+e.p.id+'" data-v4-start="'+e.p.start_date+'" data-action="v4select" data-id="'+e.m.id+'" title="'+serreEscape(e.m.title)+' · '+e.p.start_date+' → '+e.p.end_date+'"><span class="v4-band-icon">'+serreEscape(p?.icon_name||'✦')+'</span><span class="v4-band-title">'+serreEscape(p?.name||'')+' · '+serreEscape(e.m.title)+'</span>'+(e.m.progress_status==='completed'?'<span class="v4-band-status">✓</span>':'')+'</div>';
  }).join('');
  rows+='<section class="v4-calendar-week" style="min-height:'+(Math.max(1,lanes.length)*30+49)+'px"><div class="v4-calendar-cells">'+cells+'</div><div class="v4-calendar-bands">'+bands+'</div></section>';
 }
 return '<div class="v4-calendar"><div class="v4-calendar-head">'+['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>'<span>'+d+'</span>').join('')+'</div>'+rows+'</div><p class="muted small">Clique sur un ruban pour ouvrir sa fiche. Glisse-le sur une date pour déplacer sa période. Les échéances fermes restent inchangées.</p>';
}
const serrePreviousBloom=bloom;
bloom=function(){
 if(!serreV4.ready)return serrePreviousBloom();
 const panel=bloomState.details&&bloomState.selected?'<div class="v4-drawer-shade" data-action="v4drawerclose"></div><aside class="v4-jalon-drawer" aria-label="Fiche du jalon"><button class="v4-drawer-close" data-action="v4drawerclose" aria-label="Fermer la fiche">×</button>'+serreDetails()+'</aside>':'';
 return '<div class="v4-shell">'+(bloomState.sidebar?serreExplorer():'')+'<main class="v4-content"><div class="top"><div><h2>Floraison</h2><p class="muted">Ton mois d’un seul regard. Chaque bande représente une période de jalon.</p></div>'+monthControls()+'</div><div class="bloom-toolbar">'+(!bloomState.sidebar?'<button class="btn small" data-action="bloomsidebar">☰ Projets</button>':'')+'<button class="btn small '+(serreV4.mode==='month'?'primary':'')+'" data-action="v4mode" data-mode="month">Vue Mois</button><button class="btn small '+(serreV4.mode==='week'?'primary':'')+'" data-action="v4mode" data-mode="week">Zoom Semaine</button><button class="btn small '+(serreV4.mode==='horizon'?'primary':'')+'" data-action="v4mode" data-mode="horizon">Horizons</button></div>'+(st.weeks.length&&!st.periods.length?'<div class="notice">Tes placements hebdomadaires existent toujours. <button class="btn small" data-action="v4importweeks">Convertir en périodes datées</button></div>':'')+(serreV4.mode==='week'?serreWeek():serreV4.mode==='horizon'?serreHorizons():serreCalendar())+'</main>'+panel+'</div>';
};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||st.tab!=='bloom'||!serreV4.ready)return;
 if(b.dataset.action==='v4drawerclose'){e.stopImmediatePropagation();bloomState.details=false;bloomState.selected=null;render()}
 if(b.dataset.action==='v4archives'){e.stopImmediatePropagation();serreFolderState.archives=!serreFolderState.archives;render()}
},true);
document.addEventListener('input',e=>{
 if(!e.target.matches('[data-v4-search]'))return;
 const el=e.target,pos=el.selectionStart;serreFolderState.search=el.value;
 const parent=el.closest('.v4-explorer');if(!parent)return;
 const temp=document.createElement('div');temp.innerHTML=serreExplorer();
 parent.replaceWith(temp.firstElementChild);
 const next=document.querySelector('[data-v4-search]');next.focus();next.setSelectionRange(pos,pos);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bloomState.details&&st.tab==='bloom'){bloomState.details=false;bloomState.selected=null;render()}});
