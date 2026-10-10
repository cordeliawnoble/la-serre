'use strict';
const root=document.getElementById('app');
const cfg=window.SERRE_CONFIG||{};
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const today=new Date();
const localMonth=()=>today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
const st={tab:'home',month:localMonth(),projects:[],milestones:[],weeks:[],focus:[],horizons:[],notes:[],user:null};
const monthDate=()=>st.month+'-01';
const monthName=()=>new Date(st.month+'-01T12:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
const project=id=>st.projects.find(p=>p.id===id);
const childrenOf=id=>st.projects.filter(p=>p.parent_id===id);
const tint=p=>(p?.color_hex||'#809e87')+'22';
const tag=p=>'<span class="tag" style="--color:'+escapeHtml(p?.color_hex||'#56775c')+';--tint:'+tint(p)+'">'+escapeHtml(p?.icon_name||'🌱')+' '+escapeHtml(p?.name||'Projet')+'</span>';
const progress={planned:'Prévu',in_progress:'En cours',completed:'Terminé'};
const planning={reserve:'En réserve',selected:'Sélectionné',deferred:'Reporté'};
let db=null;
function configurationMissing(){root.innerHTML='<div class="wrap"><div class="card"><h2>🌱 Dernier branchement</h2><p>La Serre est publiée, mais ses paramètres publics Supabase ne sont pas encore renseignés.</p><p class="muted">Ajoute dans <code>config.js</code> l’URL Supabase et la clé publique anon/publishable de ton projet Hub writing. Aucun mot de passe ni secret.</p><p><a href="https://supabase.com/dashboard">Ouvrir Supabase</a></p></div></div>'}
async function getAll(){
 const names=['serre_projects','serre_milestones','serre_milestone_weeks','serre_month_focus','serre_horizons','serre_project_notes'];
 const results=await Promise.all(names.map(n=>db.from(n).select('*')));
 const bad=results.find(r=>r.error);
 if(bad)throw bad.error;
 [st.projects,st.milestones,st.weeks,st.focus,st.horizons,st.notes]=results.map(r=>r.data||[]);
 st.projects.sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name));
}
async function reload(){try{await getAll();render()}catch(err){root.innerHTML='<div class="wrap"><div class="notice">Erreur de chargement : '+escapeHtml(err.message)+'</div><button class="btn" id="retry">Réessayer</button></div>';document.getElementById('retry').onclick=reload}}
async function persist(table,obj,id){const r=id?await db.from(table).update(obj).eq('id',id):await db.from(table).insert(obj);if(r.error)throw r.error;await reload()}
async function erase(table,id){const r=await db.from(table).delete().eq('id',id);if(r.error)throw r.error;await reload()}
function authView(){root.innerHTML='<section id="login" class="card"><h2>🌱 Bienvenue dans La Serre</h2><p class="muted">Connecte-toi avec ton compte Supabase habituel.</p><form id="sign"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Mot de passe<input type="password" name="password" autocomplete="current-password" required></label><button class="btn primary">Se connecter</button></form><p class="notice hidden" id="signErr"></p></section>';document.getElementById('sign').onsubmit=async e=>{e.preventDefault();let f=new FormData(e.target);const r=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(r.error){const el=document.getElementById('signErr');el.textContent=r.error.message;el.classList.remove('hidden')}}}
function shell(content){root.innerHTML='<div class="wrap"><div class="sitebar"><div class="sitebrand"><strong>🌿 La Serre</strong><span>Chaque projet a son espace pour grandir.</span></div><nav class="nav" aria-label="Navigation"><button data-tab="home" class="'+(st.tab==='home'?'active':'')+'">Accueil</button><button data-tab="projects" class="'+(st.tab==='projects'?'active':'')+'">Projets</button><button data-tab="bloom" class="'+(st.tab==='bloom'?'active':'')+'">Floraison</button><button data-tab="archives" class="'+(st.tab==='archives'?'active':'')+'">Archives</button><button data-tab="admin" class="'+(st.tab==='admin'?'active':'')+'">Administration</button></nav><button class="btn small" id="logout">Sortir</button></div>'+content+'<p class="muted small" style="margin-top:38px;text-align:center">Les prévisions ne sont pas des promesses. 🌿</p></div><aside id="projectDrawer" class="drawer" aria-label="Détails du projet" aria-hidden="true"></aside><div id="drawerBackdrop" class="drawer-backdrop" hidden></div><dialog id="editorDialog"><div class="between"><h3 id="editorTitle"></h3><button class="btn small" id="closeDialog" aria-label="Fermer">✕</button></div><form id="editorForm"></form></dialog>';document.getElementById('logout').onclick=()=>db.auth.signOut({scope:'local'});document.getElementById('drawerBackdrop').onclick=closeProjectDrawer;}
function closeProjectDrawer(){drawerState.projectId=null;const d=document.getElementById('projectDrawer');const b=document.getElementById('drawerBackdrop');if(d){d.classList.remove('open');d.setAttribute('aria-hidden','true')}if(b)b.hidden=true}

const drawerState={projectId:null,tab:'fiche',expanded:false};
function openProjectDrawer(id,tab){
 const p=project(id);if(!p)return;drawerState.projectId=id;if(tab)drawerState.tab=tab;
 const d=document.getElementById('projectDrawer');if(!d)return;
 d.classList.toggle('expanded',drawerState.expanded);
 const horizons=st.horizons.filter(h=>h.project_id===id).sort((a,b)=>b.year-a.year||b.quarter-a.quarter);
 const milestones=st.milestones.filter(m=>m.project_id===id).sort((a,b)=>a.target_month.localeCompare(b.target_month));
 const notes=st.notes.filter(n=>n.project_id===id);
 const choices=[['','Sans horizon'],...horizons.map(h=>[h.id,'T'+h.quarter+' '+h.year+' · '+h.title])];
 const tabs=[['fiche','Fiche'],['horizons','Horizons'],['jalons','Jalons'],['notes','Post-it'],['children','Sous-projets']];
 const image='<div class="project-visual" style="--color:'+escapeHtml(p.color_hex)+'"><span class="project-visual-sun"></span><span class="project-visual-icon">'+escapeHtml(p.icon_name||'🌱')+'</span></div>';
 let panel='';
 if(drawerState.tab==='fiche'){
  panel='<div class="project-summary"><div class="muted small">LE PROJET EN QUELQUES MOTS</div><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.description||'Quelques lignes suffisent à poser la direction de ce projet.')+'</p><p class="muted small">Statut : '+escapeHtml({active:'Actif',paused:'En pause',archived:'Archivé'}[p.status]||'')+'</p><button class="btn primary small" data-action="editproject" data-id="'+id+'">Modifier cette fiche</button></div>';
 }else if(drawerState.tab==='horizons'){
  panel='<div class="between drawer-heading"><h3>Horizons trimestriels</h3><button class="btn primary small" data-action="newprojecthorizon" data-id="'+id+'">+ Horizon</button></div><p class="muted small">Les grands résultats visés sur un trimestre. Rien n’oblige à avoir un horizon pour chaque jalon.</p>'+
  (horizons.length?horizons.map(h=>'<div class="drawer-item"><div><b>T'+h.quarter+' '+h.year+' · '+escapeHtml(h.title)+'</b>'+(h.desired_outcome?'<p class="muted small">'+escapeHtml(h.desired_outcome)+'</p>':'')+'</div><button class="btn small" data-action="edithorizon" data-id="'+h.id+'">Modifier</button></div>').join(''):'<div class="empty">Aucun horizon défini pour ce projet.</div>');
 }else if(drawerState.tab==='jalons'){
  panel='<div class="between drawer-heading"><h3>Jalons mensuels</h3><span class="muted small">'+milestones.length+' enregistré(s)</span></div><p class="muted small">Choisis le mois ici. Les semaines se décident ensuite dans Floraison.</p>'+
  '<form id="quickMilestone" class="drawer-form">'+row('Résultat attendu *','title','','text','required maxlength="240"')+row('Mois cible','target_month',st.month,'month','required')+options('Horizon facultatif','horizon_id',choices,'')+options('Planification','planning_status',Object.entries(planning),'reserve')+'<button class="btn primary" type="submit">+ Ajouter le jalon</button></form>'+
  (milestones.length?milestones.map(m=>{const h=horizons.find(h=>h.id===m.horizon_id);return '<div class="drawer-item"><div><b>'+escapeHtml(m.title)+'</b><p class="muted small">'+escapeHtml(m.target_month.slice(0,7))+' · '+escapeHtml(planning[m.planning_status])+(h?' · T'+h.quarter+' '+h.year:'')+'</p></div><button class="btn small" data-action="editmilestone" data-id="'+m.id+'">Modifier</button></div>'}).join(''):'<div class="empty">Aucun jalon défini.</div>');
 }else if(drawerState.tab==='children'){
 const kids=childrenOf(id);
 panel='<div class="between drawer-heading"><h3>Sous-projets</h3>'+(p.parent_id?'':'<button class="btn primary small" data-action="newchild" data-id="'+id+'">+ Sous-projet</button>')+'</div><p class="muted small">Rattache un projet existant depuis sa fiche.</p>'+(kids.length?kids.map(k=>'<div class="drawer-item"><div>'+tag(k)+'</div><button class="btn small" data-action="openproject" data-id="'+k.id+'">Ouvrir</button></div>').join(''):'<div class="empty">Aucun sous-projet.</div>');
 }else if(drawerState.tab==='notes'){
  panel='<div class="between drawer-heading"><h3>Post-it du projet</h3><button class="btn primary small" data-action="newprojectnote" data-id="'+id+'">+ Post-it</button></div><p class="muted small">Idées et pistes à garder sous la main, sans les transformer en urgences.</p>'+
  (notes.length?notes.map(n=>'<div class="drawer-item"><div><b>'+escapeHtml(n.title)+'</b><p class="muted small">'+escapeHtml(n.body||'')+'</p></div><button class="btn small" data-action="editnote" data-id="'+n.id+'">Modifier</button></div>').join(''):'<div class="empty">Aucun post-it. Ton espace d’idées est prêt.</div>');
 }
 d.innerHTML='<div class="between drawer-controls"><span class="muted small">PROJET · '+escapeHtml(p.name)+'</span><div class="between"><button class="btn small" data-action="expanddrawer" aria-label="'+(drawerState.expanded?'Réduire':'Agrandir')+' le panneau">'+(drawerState.expanded?'↙ Réduire':'⛶ Agrandir')+'</button><button class="btn small" data-action="closedrawer" aria-label="Fermer">✕</button></div></div>'+
 image+'<div class="project-drawer-title">'+tag(p)+'</div>'+
 '<nav class="drawer-tabs" aria-label="Rubriques du projet">'+tabs.map(([key,label])=>'<button type="button" data-action="drawertab" data-drawertab="'+key+'" class="'+(drawerState.tab===key?'active':'')+'">'+label+'</button>').join('')+'</nav>'+
 '<div class="drawer-panel">'+panel+'</div>';
 d.classList.add('open');d.setAttribute('aria-hidden','false');document.getElementById('drawerBackdrop').hidden=false;
 const form=document.getElementById('quickMilestone');
 if(form)form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);const btn=form.querySelector('[type=submit]');btn.disabled=true;try{const result=await db.from('serre_milestones').insert({project_id:id,horizon_id:f.get('horizon_id')||null,title:String(f.get('title')).trim(),target_month:f.get('target_month')+'-01',planning_status:f.get('planning_status'),progress_status:'planned'});if(result.error)throw result.error;await getAll();render();openProjectDrawer(id,'jalons')}catch(err){alert('Impossible de créer le jalon : '+err.message);btn.disabled=false}};
}
function monthControls(){return '<div class="between"><button class="btn small" data-action="monthprev">←</button><b>'+escapeHtml(monthName())+'</b><button class="btn small" data-action="monthnext">→</button></div>'}
function milestoneView(m){return '<div class="item"><div>'+tag(project(m.project_id))+'<div style="margin-top:7px"><b>'+escapeHtml(m.title)+'</b></div><div class="muted small">'+escapeHtml(progress[m.progress_status]||'')+' · '+escapeHtml(planning[m.planning_status]||'')+(m.hard_deadline?' · Échéance ferme : '+escapeHtml(m.hard_deadline):'')+'</div></div><button class="btn small" data-action="editmilestone" data-id="'+m.id+'">Modifier</button></div>'}
function home(){const all=st.milestones.filter(m=>m.target_month===monthDate());const focus=st.focus.find(x=>x.month_start===monthDate());return '<div class="top"><div><div class="muted small">TABLEAU DE BORD MENSUEL</div><h2>'+escapeHtml(monthName())+'</h2></div>'+monthControls()+'</div><div class="focus"><div class="muted small">Projet à privilégier</div><div style="margin:12px 0">'+(focus?.project_id?tag(project(focus.project_id)):'<span class="muted">Aucun choix obligatoire ce mois-ci.</span>')+'</div><button class="btn small" data-action="focus">Choisir le cap</button></div><div class="stats"><div class="card"><div class="muted small">Sélectionnés</div><strong>'+all.filter(m=>m.planning_status==='selected').length+'</strong></div><div class="card"><div class="muted small">Accomplis</div><strong>'+all.filter(m=>m.progress_status==='completed').length+'</strong></div><div class="card"><div class="muted small">En réserve</div><strong>'+all.filter(m=>m.planning_status==='reserve').length+'</strong></div></div><div class="between"><h2>Jalons du mois</h2><span class="muted small">Création depuis Projets · répartition dans Floraison</span></div>'+(all.length?'<div class="home-milestone-grid">'+all.map(milestoneView).join('')+'</div>':'<div class="empty">Une page blanche, pas une liste de retard. 🌱</div>')}
function projectCard(p,child=false){
 const kids=childrenOf(p.id).filter(k=>k.status!=='archived');
 return '<div class="project-group"><div class="card project" style="--color:'+escapeHtml(p.color_hex)+'"><div class="project-card-visual" style="--color:'+escapeHtml(p.color_hex)+'"><span>'+escapeHtml(p.icon_name||'🌱')+'</span></div><h3>'+escapeHtml(p.name)+'</h3><p class="muted">'+escapeHtml(p.description||'')+'</p><div class="between"><span class="muted small">'+(child?'↳ Sous-projet':kids.length?kids.length+' sous-projet(s)':'Actif')+'</span><div class="project-actions">'+(kids.length?'<button class="btn small" data-action="togglechildren" data-id="'+p.id+'" aria-expanded="false">Déplier ▾</button>':'')+'<button class="btn primary small" data-action="openproject" data-id="'+p.id+'">Ouvrir</button></div></div></div>'+(kids.length?'<div class="project-children" data-children="'+p.id+'" hidden>'+kids.map(k=>projectCard(k,true)).join('')+'</div>':'')+'</div>';
}
function projects(){const roots=st.projects.filter(p=>!p.parent_id&&p.status==='active');return '<div class="between"><h2>Mes projets</h2><button class="btn primary" data-action="newproject">+ Projet</button></div><p class="muted">Chaque projet possède sa fiche, ses horizons, ses jalons et ses post-it. Déplie les familles pour retrouver les sous-projets.</p><div class="cards">'+roots.map(p=>projectCard(p)).join('')+'</div>'+(roots.length?'':'<div class="empty">Aucun projet actif. Les autres t’attendent dans les Archives.</div>')}
function archives(){const list=st.projects.filter(p=>p.status!=='active');return '<h2>Archives et projets en pause</h2><p class="muted">Tous les jalons et les horizons sont conservés. Tu peux réactiver un projet.</p><div class="archive-grid">'+(list.length?list.map(p=>'<div class="card archive-card" style="--color:'+escapeHtml(p.color_hex)+'">'+tag(p)+'<p class="muted small">'+(p.status==='archived'?'Archivé':'En pause')+'</p><div class="between"><button class="btn small" data-action="openproject" data-id="'+p.id+'">Consulter</button><button class="btn primary small" data-action="reactivate" data-id="'+p.id+'">Réactiver</button></div></div>').join(''):'<div class="empty">Aucun projet archivé ou en pause.</div>')+'</div>'}
function weekStarts(){const d=new Date(st.month+'-01T12:00:00'),end=new Date(d.getFullYear(),d.getMonth()+1,0,12);d.setDate(d.getDate()-(d.getDay()+6)%7);const v=[];while(d<=end){v.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));d.setDate(d.getDate()+7)}return v}
function weekItems(week){return st.weeks.filter(w=>w.week_start===week).map(w=>({link:w,m:st.milestones.find(m=>m.id===w.milestone_id)})).filter(x=>x.m&&x.m.target_month===monthDate()).sort((a,b)=>(a.link.sort_order??0)-(b.link.sort_order??0)||a.link.created_at.localeCompare(b.link.created_at))}
function bloom(){
 const weeks=weekStarts(),first=new Date(st.month+'-01T12:00:00'),month=first.getMonth();
 const days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
 const header='<div class="calendar-weekdays">'+days.map(d=>'<span>'+d+'</span>').join('')+'</div>';
 const rows=weeks.map(w=>{
  const start=new Date(w+'T12:00:00');
  const dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d});
  const cells='<div class="calendar-days">'+dates.map(d=>'<div class="calendar-day '+(d.getMonth()!==month?'outside':'')+'"><span>'+d.getDate()+'</span></div>').join('')+'</div>';
  const entries=weekItems(w);
  const strips=entries.map((x,i)=>{
   const color=escapeHtml(project(x.m.project_id)?.color_hex||'#65886c');
   const label=escapeHtml(x.m.title);
   const wi=weeks.indexOf(w);
   const before=wi>0&&st.weeks.some(link=>link.week_start===weeks[wi-1]&&link.milestone_id===x.m.id);
   const after=wi<weeks.length-1&&st.weeks.some(link=>link.week_start===weeks[wi+1]&&link.milestone_id===x.m.id);
   const continuity=before&&after?'middle':before?'end':after?'start':'single';
   const middle=before&&after;
   const content=middle?'<span class="continuity-note" title="'+label+'">En cours</span>':'<b title="'+label+'">'+label+'</b>';
   return '<div class="calendar-strip continuity-'+continuity+'" style="--color:'+color+'" title="'+label+'"><div class="calendar-strip-label">'+tag(project(x.m.project_id))+content+'</div><div class="calendar-strip-actions"><button class="btn small" data-action="weekup" data-week="'+w+'" data-id="'+x.link.id+'" aria-label="Monter" '+(i===0?'disabled':'')+'>↑</button><button class="btn small" data-action="weekdown" data-week="'+w+'" data-id="'+x.link.id+'" aria-label="Descendre" '+(i===entries.length-1?'disabled':'')+'>↓</button><button class="btn small" data-action="unplaceweek" data-week="'+w+'" data-id="'+x.m.id+'" aria-label="Retirer ce jalon de cette semaine">×</button></div></div>'
  }).join('');
  return '<section class="calendar-week" aria-label="Semaine du '+dates[0].toLocaleDateString('fr-FR')+'">'+cells+'<div class="calendar-week-events">'+(strips||'<p class="calendar-empty">Aucun jalon prévu</p>')+'<button class="calendar-add" data-action="placeweek" data-week="'+w+'">+ Placer un jalon</button></div></section>'
 }).join('');
 return '<div class="top"><h2>Floraison</h2>'+monthControls()+'</div><p class="muted">Ton mois d’un seul regard. Chaque bande représente un jalon pour la semaine, sans imposer de travail quotidien.</p><div class="floraison-calendar">'+header+rows+'</div><p class="muted small">Les traits colorés indiquent les jalons qui se poursuivent d’une semaine à l’autre. Les flèches règlent leur ordre.</p>';
}
function admin(){return '<h2>Administration</h2><p class="muted">La gestion des horizons, jalons et post-it se fait désormais dans les projets.</p><div class="cards"><div class="card"><h3>Sauvegarde</h3><p class="muted">Exporter tes données La Serre au format JSON.</p><button class="btn" data-action="export">Exporter les données</button></div><div class="card"><h3>Personnalisation</h3><p class="muted">Couleurs, icônes et informations des projets se modifient directement dans leur fiche.</p><button class="btn" data-tab="projects">Voir mes projets</button></div></div>'}
function render(){if(!st.user)return authView();shell(({home,projects,bloom,archives,admin})[st.tab]())}
function row(label,name,value='',type='text',required=''){return '<label>'+label+'<input type="'+type+'" name="'+name+'" value="'+escapeHtml(value)+'" '+required+'></label>'}
function options(label,name,opts,selected){return '<label>'+label+'<select name="'+name+'">'+opts.map(([v,t])=>'<option value="'+escapeHtml(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+escapeHtml(t)+'</option>').join('')+'</select></label>'}
function area(label,name,value=''){return '<label>'+label+'<textarea name="'+name+'">'+escapeHtml(value)+'</textarea></label>'}
function openEditor(title,fields,submit){document.getElementById('editorTitle').textContent=title;const form=document.getElementById('editorForm');form.innerHTML=fields+'<div class="between" style="margin-top:15px"><button type="button" class="btn" id="cancelEditor">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>';document.getElementById('cancelEditor').onclick=()=>document.getElementById('editorDialog').close();document.getElementById('closeDialog').onclick=()=>document.getElementById('editorDialog').close();form.onsubmit=async e=>{e.preventDefault();let button=form.querySelector('[type=submit]');button.disabled=true;try{await submit(new FormData(form));document.getElementById('editorDialog').close()}catch(e){alert('Impossible de sauvegarder : '+e.message)}finally{button.disabled=false}};document.getElementById('editorDialog').showModal()}
function projectEditor(id,parentId=null){
 const p=project(id),kids=childrenOf(id);
 const possible=st.projects.filter(x=>x.id!==id&&!x.parent_id&&x.status!=='archived');
 const parents=[['','Aucun (projet indépendant)'],...possible.map(x=>[x.id,x.name])];
 if(parentId&&!parents.some(([v])=>v===parentId))parents.push([parentId,project(parentId)?.name||'Projet parent']);
 openEditor(p?'Modifier le projet':'Créer un projet',
 row('Nom *','name',p?.name||'','text','required maxlength="160"')+
 row('Couleur','color_hex',p?.color_hex||project(parentId)?.color_hex||'#C4B3E8','color')+
 row('Icône (emoji)','icon_name',p?.icon_name||'🌱')+
 options('Projet parent (facultatif)','parent_id',kids.length?[['','Aucun : ce projet possède des enfants']]:parents,p?.parent_id||parentId||'')+
 options('Statut','status',[['active','Actif'],['paused','En pause'],['archived','Archivé']],p?.status||'active')+
 area('Description','description',p?.description||''),
 async f=>{
  const parent_id=f.get('parent_id')||null;
  if(parent_id===id)throw Error('Un projet ne peut pas être son propre parent.');
  if(parent_id&&project(parent_id)?.parent_id)throw Error('Deux niveaux maximum.');
  if(parent_id&&kids.length)throw Error('Ce projet possède déjà des enfants.');
  await persist('serre_projects',{name:f.get('name').trim(),color_hex:f.get('color_hex'),icon_name:f.get('icon_name')||'🌱',parent_id,status:f.get('status'),description:f.get('description')},id);
 });
}
function milestoneEditor(id){if(!st.projects.length){alert('Commence par créer un projet dans l’onglet Projets.');return}const m=st.milestones.find(x=>x.id===id);const chosen=m?.project_id||st.projects[0].id;const hs=[['','Sans horizon'],...st.horizons.filter(h=>h.project_id===chosen).map(h=>[h.id,h.title])];openEditor(m?'Modifier le jalon':'Créer un jalon',row('Résultat attendu *','title',m?.title||'','text','required')+options('Projet','project_id',st.projects.map(p=>[p.id,p.name]),chosen)+options('Horizon facultatif','horizon_id',hs,m?.horizon_id||'')+row('Mois cible','target_month',(m?.target_month||monthDate()).slice(0,7),'month','required')+row('Vraie échéance (facultative)','hard_deadline',m?.hard_deadline||'','date')+options('Planification','planning_status',Object.entries(planning),m?.planning_status||'reserve')+options('Avancement','progress_status',Object.entries(progress),m?.progress_status||'planned')+area('Notes','details',m?.details||''),async f=>{const project_id=f.get('project_id'),horizon_id=f.get('horizon_id')||null;if(horizon_id&&!st.horizons.some(h=>h.id===horizon_id&&h.project_id===project_id))throw Error('L’horizon doit appartenir au projet sélectionné.');const status=f.get('progress_status');await persist('serre_milestones',{project_id,horizon_id,title:f.get('title').trim(),target_month:f.get('target_month')+'-01',hard_deadline:f.get('hard_deadline')||null,planning_status:f.get('planning_status'),progress_status:status,completed_at:status==='completed'?(m?.completed_at||new Date().toISOString()):null,details:f.get('details')},id)});const ps=document.querySelector('[name=project_id]');ps.onchange=()=>{const field=document.querySelector('[name=horizon_id]');field.innerHTML='<option value="">Sans horizon</option>'+st.horizons.filter(h=>h.project_id===ps.value).map(h=>'<option value="'+escapeHtml(h.id)+'">'+escapeHtml(h.title)+'</option>').join('')}}
function focusEditor(){const old=st.focus.find(f=>f.month_start===monthDate());openEditor('Cap du mois',options('Projet à privilégier','project_id',[['','Aucun'],...st.projects.map(p=>[p.id,p.name])],old?.project_id||'')+area('Note du mois','focus_note',old?.focus_note||''),async f=>persist('serre_month_focus',{month_start:monthDate(),project_id:f.get('project_id')||null,focus_note:f.get('focus_note')},old?.id))}
function horizonEditor(id,projectId){
 if(!st.projects.length)return alert('Crée d’abord un projet.');
 const h=st.horizons.find(x=>x.id===id),selected=h?.project_id||projectId||st.projects[0].id;
 const year=new Date().getFullYear(),quarter=Math.floor(new Date().getMonth()/3)+1;
 openEditor('Horizon trimestriel',row('Intitulé *','title',h?.title||'','text','required')+
 options('Projet','project_id',st.projects.map(p=>[p.id,p.name]),selected)+row('Année','year',h?.year||year,'number','required min="2020" max="2100"')+
 options('Trimestre','quarter',[[1,'T1'],[2,'T2'],[3,'T3'],[4,'T4']],h?.quarter||quarter)+area('Résultat souhaité','desired_outcome',h?.desired_outcome||''),
 async f=>persist('serre_horizons',{title:f.get('title').trim(),project_id:f.get('project_id'),year:Number(f.get('year')),quarter:Number(f.get('quarter')),desired_outcome:f.get('desired_outcome')},id))
}
function noteEditor(id,projectId){if(!st.projects.length)return alert('Crée d’abord un projet.');const n=st.notes.find(x=>x.id===id);openEditor('Post-it',row('Titre *','title',n?.title||'','text','required')+options('Projet','project_id',st.projects.map(p=>[p.id,p.name]),n?.project_id||projectId||st.projects[0].id)+area('Idée','body',n?.body||''),async f=>persist('serre_project_notes',{title:f.get('title').trim(),project_id:f.get('project_id'),body:f.get('body')},id))}
function placeWeek(w){
 const candidates=st.milestones.filter(m=>m.target_month===monthDate());
 if(!candidates.length)return alert('Crée d’abord un jalon pour ce mois depuis la fiche du projet.');
 const weeks=weekStarts();
 const weeksHtml=weeks.map(date=>'<label class="week-choice"><input type="checkbox" name="weeks" value="'+date+'" '+(date===w?'checked':'')+'><span>Semaine du '+new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+'</span></label>').join('');
 const body=options('Jalon à répartir','milestone_id',candidates.map(m=>[m.id,(project(m.project_id)?.name||'')+' · '+m.title]),candidates[0].id)+
 options('Durée','placement_scope',[['single','Cette semaine uniquement'],['multiple','Plusieurs semaines au choix'],['month','Tout le mois']],'single')+
 '<div id="weekChoiceBox" class="week-choices hidden"><p class="muted small">Sélectionne les semaines concernées :</p>'+weeksHtml+'</div>'+
 '<p class="muted small">Un jalon déjà placé sur une semaine ne sera pas ajouté une deuxième fois.</p>';
 openEditor('Répartir un jalon',body,async f=>{
  const scope=f.get('placement_scope');
  const selected=scope==='month'?weeks:scope==='multiple'?f.getAll('weeks'):[w];
  if(!selected.length)throw Error('Choisis au moins une semaine.');
  const id=f.get('milestone_id');
  const missing=selected.filter(week=>!st.weeks.some(x=>x.milestone_id===id&&x.week_start===week));
  if(!missing.length){alert('Ce jalon est déjà placé sur les semaines choisies.');return}
  const records=missing.map(week=>({milestone_id:id,week_start:week,sort_order:Math.max(-1,...st.weeks.filter(x=>x.week_start===week).map(x=>x.sort_order??0))+1}));
  const result=await db.from('serre_milestone_weeks').insert(records);
  if(result.error)throw result.error;await reload();
 });
 const selector=document.querySelector('#editorForm select[name="placement_scope"]'),box=document.getElementById('weekChoiceBox');
 const update=()=>{box.classList.toggle('hidden',selector.value!=='multiple')};
 selector.addEventListener('change',update);update();
}
async function moveWeek(id,week,direction){
 const list=weekItems(week);
 const i=list.findIndex(x=>x.link.id===id),j=i+direction;
 if(i<0||j<0||j>=list.length)return;
 // Renumber positions first so newly migrated and historic rows remain predictable.
 const reordered=list.slice();[reordered[i],reordered[j]]=[reordered[j],reordered[i]];
 for(let n=0;n<reordered.length;n++){
  const x=reordered[n];
  if(x.link.sort_order!==n){const result=await db.from('serre_milestone_weeks').update({sort_order:n}).eq('id',x.link.id);if(result.error){await reload();throw result.error}}
 }
 await reload();
}
function exportJson(){const o={exported_at:new Date().toISOString(),projects:st.projects,milestones:st.milestones,weeks:st.weeks,focus:st.focus,horizons:st.horizons,notes:st.notes};const url=URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='la-serre-'+st.month+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.addEventListener('click',async e=>{const tab=e.target.closest('[data-tab]');if(tab){closeProjectDrawer();st.tab=tab.dataset.tab;render();return}const b=e.target.closest('[data-action]');if(!b)return;try{switch(b.dataset.action){case'monthprev':case'monthnext':{const d=new Date(st.month+'-01T12:00:00');d.setMonth(d.getMonth()+(b.dataset.action==='monthprev'?-1:1));st.month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');render();break}case'newproject':projectEditor();break;case'newchild':closeProjectDrawer();projectEditor(undefined,b.dataset.id);break;case'togglechildren':{const el=document.querySelector('[data-children="'+b.dataset.id+'"]');if(el){el.hidden=!el.hidden;b.setAttribute('aria-expanded',String(!el.hidden));b.textContent=el.hidden?'Déplier ▾':'Replier ▴'}break}case'reactivate':await persist('serre_projects',{status:'active'},b.dataset.id);break;case'openproject':drawerState.tab='fiche';openProjectDrawer(b.dataset.id);break;case'drawertab':openProjectDrawer(drawerState.projectId,b.dataset.drawertab);break;case'expanddrawer':drawerState.expanded=!drawerState.expanded;openProjectDrawer(drawerState.projectId);break;case'closedrawer':closeProjectDrawer();break;case'editproject':closeProjectDrawer();projectEditor(b.dataset.id);break;case'newmilestone':milestoneEditor();break;case'editmilestone':closeProjectDrawer();milestoneEditor(b.dataset.id);break;case'focus':focusEditor();break;case'newhorizon':horizonEditor();break;case'newprojecthorizon':closeProjectDrawer();horizonEditor(undefined,b.dataset.id);break;case'edithorizon':closeProjectDrawer();horizonEditor(b.dataset.id);break;case'newnote':noteEditor();break;case'newprojectnote':closeProjectDrawer();noteEditor(undefined,b.dataset.id);break;case'editnote':noteEditor(b.dataset.id);break;case'placeweek':placeWeek(b.dataset.week);break;case'weekup':await moveWeek(b.dataset.id,b.dataset.week,-1);break;case'weekdown':await moveWeek(b.dataset.id,b.dataset.week,1);break;case'unplaceweek':{const w=st.weeks.find(x=>x.milestone_id===b.dataset.id&&x.week_start===b.dataset.week);if(w)await erase('serre_milestone_weeks',w.id);break}case'export':exportJson();break}}catch(err){alert(err.message)}});
async function init(){if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){configurationMissing();return}db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{storageKey:'la-serre-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});db.auth.onAuthStateChange((event,session)=>{setTimeout(async()=>{const old=st.user?.id;st.user=session?.user||null;if(st.user){if(st.user.id!==old)await reload()}else authView()},0)});const r=await db.auth.getSession();if(r.error){root.textContent=r.error.message;return}st.user=r.data.session?.user||null;if(st.user)await reload();else authView()}
init();
