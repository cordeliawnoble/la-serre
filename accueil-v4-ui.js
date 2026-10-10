'use strict';
/* Accueil graphique, sans mutation de données ni changement des règles de planification. */
const serreOldHome=home;
home=function(){
 const all=st.milestones.filter(m=>m.target_month===monthDate());
 const focus=st.focus.find(x=>x.month_start===monthDate());
 const selected=all.filter(m=>m.planning_status==='selected');
 const completed=all.filter(m=>m.progress_status==='completed');
 const reserve=all.filter(m=>m.planning_status==='reserve');
 const inProgress=all.filter(m=>m.progress_status==='in_progress');
 const active=st.projects.filter(p=>p.status==='active');
 const focusProject=focus?.project_id?project(focus.project_id):null;
 const stat=(icon,label,count,hint)=>'<div class="v4-home-stat"><span class="v4-home-stat-icon">'+icon+'</span><div><span class="v4-home-stat-label">'+label+'</span><strong>'+count+'</strong><small>'+hint+'</small></div></div>';
 const milestones=all.slice().sort((a,b)=>{
  const score=m=>(m.progress_status==='completed'?3:m.planning_status==='selected'?0:m.progress_status==='in_progress'?1:2);
  return score(a)-score(b)||String(a.hard_deadline||'9999').localeCompare(String(b.hard_deadline||'9999'))||a.title.localeCompare(b.title);
 });
 const item=m=>{
  const p=project(m.project_id),color=escapeHtml(p?.color_hex||'#88a88d');
  const periods=st.periods?.filter(x=>x.milestone_id===m.id)||[];
  const blocks=st.blocks?.filter(x=>x.milestone_id===m.id&&x.block_date.slice(0,7)===st.month)||[];
  const status=m.progress_status==='completed'?'✓ Accompli':m.progress_status==='in_progress'?'◐ En cours':'○ À venir';
  const date=periods.length?periods.slice().sort((a,b)=>a.start_date.localeCompare(b.start_date))[0].start_date:null;
  return '<article class="v4-home-milestone" style="--project-color:'+color+'"><div class="v4-home-milestone-top"><span class="v4-home-project">'+escapeHtml(p?.icon_name||'🌿')+' '+escapeHtml(p?.name||'Projet')+'</span><span class="v4-home-status">'+status+'</span></div><h3>'+escapeHtml(m.title)+'</h3><div class="v4-home-meta">'+(m.hard_deadline?'<span>⏰ Échéance ferme : '+escapeHtml(m.hard_deadline)+'</span>':date?'<span>📅 À partir du '+escapeHtml(dayLabel(date))+'</span>':'<span>🌱 À positionner librement</span>')+(blocks.length?'<span>◷ '+blocks.length+' demi-journée'+(blocks.length>1?'s':'')+' réservée'+(blocks.length>1?'s':'')+'</span>':'')+'</div><div class="v4-home-bottom"><span class="v4-home-plan">'+escapeHtml(planning[m.planning_status]||'')+'</span><button class="btn small" data-action="editmilestone" data-id="'+m.id+'">Consulter / modifier →</button></div></article>';
 };
 const percent=selected.length?Math.round(selected.filter(m=>m.progress_status==='completed').length/selected.length*100):0;
 return '<div class="v4-home"><header class="v4-home-hero"><div><div class="v4-home-eyebrow">✧ LE COCKPIT DE LA SERRE</div><p>Un cap, quelques jalons, et de la place pour respirer.</p></div><div class="v4-home-month">'+monthControls()+'</div></header><section class="v4-home-focus"><div class="v4-home-focus-copy"><span class="v4-home-eyebrow">🌿 TON CAP DU MOIS</span><h3>'+(focusProject?escapeHtml(focusProject.name):'Quel projet aimerais-tu privilégier ?')+'</h3><p>'+(focusProject?'Un point de repère pour ce mois, pas une obligation de tout terminer.':'Aucun cap obligatoire. Tu peux en choisir un ou laisser le mois ouvert.')+'</p><button class="btn primary" data-action="focus">'+(focusProject?'Ajuster mon cap':'Choisir mon cap')+' →</button></div><div class="v4-home-focus-progress"><div class="v4-home-progress-heading"><strong>Progression du cap mensuel</strong><b>'+percent+' %</b></div><div class="v4-home-progress-track" role="progressbar" aria-label="Jalons sélectionnés accomplis" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span style="width:'+percent+'%"></span></div><span class="muted small">'+(selected.length?selected.filter(m=>m.progress_status==='completed').length+' sur '+selected.length+' jalon(s) sélectionné(s) accomplis':'Aucun jalon sélectionné pour le moment')+'</span></div></section><section class="v4-home-stats">'+stat('◈','Sélectionnés',selected.length,'jalons retenus')+stat('✓','Accomplis',completed.length,'jalons du mois')+stat('◌','En cours',inProgress.length,'jalons en progression')+stat('❋','En réserve',reserve.length,'sans urgence imposée')+'</section><div class="v4-home-section-title"><div><span class="v4-home-eyebrow">LES GRANDES ÉTAPES</span><h2>Jalons du mois <span>'+all.length+'</span></h2></div><span class="muted small">Création dans Projets · dates dans Floraison</span></div>'+(milestones.length?'<div class="v4-home-milestones">'+milestones.map(item).join('')+'</div>':'<div class="v4-home-empty">🌷 Aucun jalon ce mois-ci. Une page blanche est aussi un espace pour grandir.</div>')+'<footer class="v4-home-footer">✧ Les prévisions ne sont pas des promesses. '+active.length+' projet'+(active.length>1?'s':'')+' actif'+(active.length>1?'s':'')+' dans La Serre.</footer></div>';
};
