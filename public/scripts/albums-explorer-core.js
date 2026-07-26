const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const split=v=>String(v||'').split(/\s*(?:\/|;|\||\+)\s*|\s*,\s*/).map(x=>x.trim()).filter(Boolean);
const dateValue=v=>{const s=String(v||'').replace(/(\d)(st|nd|rd|th)\b/gi,'$1').trim();const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);if(m){const y=m[3].length===2?2000+Number(m[3]):Number(m[3]);const n=Date.UTC(y,Number(m[1])-1,Number(m[2]));return Number.isNaN(n)?null:n}const n=Date.parse(s);return Number.isNaN(n)?null:n};
const num=v=>v===''||v==null?null:(Number.isFinite(Number(v))?Number(v):null);
const nullable=(a,b,dir)=>a==null&&b==null?0:a==null?1:b==null?-1:dir==='asc'?a-b:b-a;
const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});

function boot(){
 const grid=$('#albums-grid'),explorer=$('#albums-explorer');if(!grid||!explorer)return;
 const cards=$$('.album-card',grid),buttons=$$('.albums-view-button');
 const controls={search:$('#album-search'),filtersToggle:$('#album-filters-toggle'),filtersPanel:$('#album-filters-panel'),filtersCount:$('#album-filters-count'),style:$('#album-style-filter'),subgenre:$('#album-subgenre-filter'),mood:$('#album-mood-filter'),country:$('#album-country-filter'),year:$('#album-listened-year-filter'),release:$('#album-release-filter'),sort:$('#album-sort'),results:$('#albums-results-summary'),clear:$('#albums-clear-filters'),empty:$('#albums-filter-empty'),mapView:$('#albums-map-view'),timelineView:$('#albums-timeline-view'),mapMetrics:$('#albums-map-metrics'),timelineMetrics:$('#albums-timeline-metrics'),mapStage:$('#albums-map-stage'),mapStatus:$('#albums-map-status'),mapTooltip:$('#albums-map-tooltip'),countryPanel:$('#albums-country-panel'),mapNote:$('#albums-map-note'),timelineContent:$('#albums-timeline-content'),timelineHelp:$('#albums-timeline-help')};
 const state={activeView:'list',selectedMapCountryId:'',mapModule:null,timelineModule:null,last:{album:null,country:null,style:null,release:null,year:null}};
 const haystack=new Map(cards.map(c=>[c,norm([c.dataset.title,c.dataset.artist,c.dataset.country,c.dataset.style,c.dataset.subgenre,c.dataset.mood,c.dataset.noteRaw].join(' '))]));
 cards.forEach(c=>{c._countryTokens=split(c.dataset.country).map(norm);c._subgenreTokens=split(c.dataset.subgenre).map(norm);c._moodTokens=split(c.dataset.mood).map(norm)});

 function populate(select,values,sorter=(a,b)=>collator.compare(a,b)){if(!select)return;const first=select.options[0]?.textContent||'All';select.innerHTML='';select.add(new Option(first,''));[...new Set(values.filter(Boolean))].sort(sorter).forEach(v=>select.add(new Option(v,v)))}
 populate(controls.style,cards.map(c=>c.dataset.style));
 populate(controls.subgenre,cards.flatMap(c=>split(c.dataset.subgenre)));
 populate(controls.mood,cards.flatMap(c=>split(c.dataset.mood)));
 populate(controls.country,cards.flatMap(c=>split(c.dataset.country)));
 populate(controls.year,cards.map(c=>c.dataset.listenedYear),(a,b)=>Number(b)-Number(a));
 const periods=new Map();cards.forEach(c=>periods.set(c.dataset.releasePeriod,{key:c.dataset.releasePeriod,label:c.dataset.releasePeriodLabel,order:Number(c.dataset.releasePeriodOrder||1e5)}));
 if(controls.release){controls.release.innerHTML='<option value="">All release periods</option>';[...periods.values()].filter(p=>p.key).sort((a,b)=>a.order-b.order||collator.compare(a.label,b.label)).forEach(p=>controls.release.add(new Option(p.label,p.key)))}

 function baseMatch(c){
  const words=norm(controls.search?.value).split(/\s+/).filter(Boolean);
  if(words.length&&!words.every(w=>haystack.get(c).includes(w)))return false;
  if(controls.style?.value&&norm(c.dataset.style)!==norm(controls.style.value))return false;
  if(controls.subgenre?.value&&!c._subgenreTokens.includes(norm(controls.subgenre.value)))return false;
  if(controls.mood?.value&&!c._moodTokens.includes(norm(controls.mood.value)))return false;
  if(controls.country?.value&&!c._countryTokens.includes(norm(controls.country.value)))return false;
  if(controls.year?.value&&c.dataset.listenedYear!==controls.year.value)return false;
  if(controls.release?.value&&c.dataset.releasePeriod!==controls.release.value)return false;
  return true;
 }
 function mapMatch(c){return !state.selectedMapCountryId||String(c.dataset.albumCountryIds||'').split(' ').includes(state.selectedMapCountryId)}
 const getBaseCards=()=>cards.filter(baseMatch);const getVisibleCards=()=>cards.filter(c=>baseMatch(c)&&mapMatch(c));
 function activeCount(){return [controls.style,controls.subgenre,controls.mood,controls.country,controls.year,controls.release].filter(c=>c?.value).length+Number(Boolean(state.selectedMapCountryId))}
 function updateResults(){const visible=getVisibleCards();cards.forEach(c=>c.style.display=visible.includes(c)?'':'none');if(controls.results)controls.results.textContent=`Showing ${visible.length.toLocaleString()} of ${cards.length.toLocaleString()} albums`;if(controls.empty)controls.empty.hidden=visible.length!==0;const n=activeCount();if(controls.filtersCount){controls.filtersCount.textContent=String(n);controls.filtersCount.hidden=n===0}controls.filtersToggle?.classList.toggle('has-active-filters',n>0);if(controls.clear)controls.clear.hidden=!(n||controls.search?.value.trim())}
 async function refreshExplorer(){if(state.activeView==='map'&&state.mapModule)await state.mapModule.renderAlbumMap(api);if(state.activeView==='timeline'&&state.timelineModule)state.timelineModule.renderAlbumTimeline(api)}
 function applyFilters(){updateResults();refreshExplorer()}
 function clearFilters(){if(controls.search)controls.search.value='';[controls.style,controls.subgenre,controls.mood,controls.country,controls.year,controls.release].forEach(c=>{if(c)c.value=''});state.selectedMapCountryId='';applyFilters()}

 function sortCards(){const mode=controls.sort?.value||'date-desc';const ordered=[...cards].sort((a,b)=>{let x=0;if(mode.startsWith('date-'))x=nullable(dateValue(a.dataset.dateListened),dateValue(b.dataset.dateListened),mode.endsWith('asc')?'asc':'desc');else if(mode==='title-asc')x=collator.compare(a.dataset.title||'',b.dataset.title||'');else if(mode==='artist-asc')x=collator.compare(a.dataset.artist||'',b.dataset.artist||'');else if(mode.startsWith('release-'))x=nullable(num(a.dataset.releaseSort),num(b.dataset.releaseSort),mode.endsWith('asc')?'asc':'desc');else if(mode.startsWith('length-'))x=nullable(num(a.dataset.lengthMinutes),num(b.dataset.lengthMinutes),mode.endsWith('asc')?'asc':'desc');return x||Number(a.dataset.originalIndex)-Number(b.dataset.originalIndex)});ordered.forEach(c=>grid.append(c))}

 function press(view){buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.albumView===view)))}
 function setCollectionView(view,persist=true){state.activeView=view;explorer.hidden=true;controls.mapView.hidden=true;controls.timelineView.hidden=true;grid.hidden=false;grid.dataset.albumView=view;press(view);cards.forEach(c=>c.classList.remove('show-note'));if(persist)try{localStorage.setItem(matchMedia('(max-width:900px)').matches?'lifeloggerz-albums-mobile-view':'lifeloggerz-albums-desktop-view',view)}catch{}}
 async function showView(view){if(view==='list'||view==='quilt'){setCollectionView(view);return}state.activeView=view;explorer.hidden=false;grid.hidden=true;controls.mapView.hidden=view!=='map';controls.timelineView.hidden=view!=='timeline';press(view);if(view==='map'){state.mapModule??=await import('./albums-map.js?v=20260726-1445');await state.mapModule.renderAlbumMap(api)}else{state.timelineModule??=await import('./albums-timeline.js?v=20260726-1445');state.timelineModule.renderAlbumTimeline(api)}explorer.scrollIntoView({behavior:'smooth',block:'nearest'})}
 function restore(){const mobile=matchMedia('(max-width:900px)').matches,key=mobile?'lifeloggerz-albums-mobile-view':'lifeloggerz-albums-desktop-view';let view=mobile?'list':'quilt';try{view=localStorage.getItem(key)||view}catch{}setCollectionView(view,false)}

 controls.filtersToggle?.addEventListener('click',()=>{const open=controls.filtersPanel.hidden;controls.filtersPanel.hidden=!open;controls.filtersToggle.setAttribute('aria-expanded',String(open))});
 controls.search?.addEventListener('input',applyFilters);[controls.style,controls.subgenre,controls.mood,controls.country,controls.year,controls.release].forEach(c=>c?.addEventListener('change',()=>{if(c===controls.country)state.selectedMapCountryId='';applyFilters()}));controls.sort?.addEventListener('change',sortCards);controls.clear?.addEventListener('click',clearFilters);buttons.forEach(b=>b.addEventListener('click',()=>showView(b.dataset.albumView)));$$('[data-close-explorer]').forEach(b=>b.addEventListener('click',()=>setCollectionView(grid.dataset.albumView==='list'?'list':'quilt')));

 const surprise=$('#albums-surprise'),trigger=$('#albums-surprise-trigger'),menu=$('#albums-surprise-menu'),toast=$('#albums-surprise-toast');let toastTimer;
 const random=(items,last)=>{const pool=items.length>1?items.filter(x=>x!==last):items;return pool[Math.floor(Math.random()*pool.length)]||items[0]};
 function say(text){clearTimeout(toastTimer);toast.textContent=text;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,3000)}
 function closeMenu(){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}
 async function surpriseRun(action){const current=getVisibleCards().length?getVisibleCards():cards;if(action==='album'){const c=random(current,state.last.album);if(!c)return say('No albums match the current filters.');state.last.album=c;window.open(c.href,'_blank','noopener,noreferrer');return say(`Opening: ${c.dataset.title}`)}const field=action==='country'?'country':action==='style'?'style':action==='release'?'release':'year';const control=controls[field];let values;if(action==='country')values=[...new Set(current.flatMap(c=>split(c.dataset.country)))];else if(action==='style')values=[...new Set(current.map(c=>c.dataset.style).filter(Boolean))];else if(action==='release')values=[...new Set(current.map(c=>c.dataset.releasePeriod).filter(v=>v&&v!=='unknown'))];else values=[...new Set(current.map(c=>c.dataset.listenedYear).filter(Boolean))];const choice=random(values,state.last[action]);if(!choice||!control)return say('Not enough metadata is available for that surprise.');state.last[action]=choice;state.selectedMapCountryId='';control.value=choice;applyFilters();if(action==='country')await showView('map');else if(action==='release'||action==='year'){await showView('timeline');setTimeout(()=>document.querySelector(`[data-timeline-mode="${action==='year'?'listening':'release'}"]`)?.click(),0)}say(action==='country'?`Exploring ${choice}`:action==='style'?`Exploring ${choice}`:action==='year'?`Revisiting ${choice}`:`Opening ${control.selectedOptions[0]?.textContent||choice}`)}
 trigger?.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)$('button',menu)?.focus()});$$('[data-surprise]',menu).forEach(b=>b.addEventListener('click',()=>{closeMenu();trigger.focus();surpriseRun(b.dataset.surprise)}));document.addEventListener('click',e=>{if(surprise&&!surprise.contains(e.target))closeMenu()});

 const infoButton=$('#albums-info-toggle'),infoPanel=$('#albums-info');infoButton?.addEventListener('click',()=>{const open=infoPanel.hidden;infoPanel.hidden=!open;infoPanel.classList.toggle('albums-info-panel--visible',open);infoButton.setAttribute('aria-expanded',String(open));infoButton.setAttribute('aria-pressed',String(open))});
 function adjustBubble(b){if(!b)return;b.style.setProperty('--shift','0px');const r=b.getBoundingClientRect(),m=8;let shift=0;if(r.left<m)shift=m-r.left;else if(r.right>innerWidth-m)shift=innerWidth-m-r.right;if(shift)b.style.setProperty('--shift',`${shift}px`)}
 grid.addEventListener('mouseenter',e=>requestAnimationFrame(()=>adjustBubble(e.target.closest('.album-card')?.querySelector('.album-note-bubble'))),true);grid.addEventListener('focusin',e=>requestAnimationFrame(()=>adjustBubble(e.target.closest('.album-card')?.querySelector('.album-note-bubble'))));document.addEventListener('click',e=>{const c=e.target.closest('.album-card');if(!c){cards.forEach(x=>x.classList.remove('show-note'));return}if(!matchMedia('(max-width:900px)').matches||grid.dataset.albumView!=='quilt'||c.classList.contains('show-note'))return;e.preventDefault();cards.forEach(x=>x.classList.remove('show-note'));c.classList.add('show-note');setTimeout(()=>c.classList.remove('show-note'),2500)},true);
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();clearFilters();if(state.activeView==='map'||state.activeView==='timeline')setCollectionView(grid.dataset.albumView==='list'?'list':'quilt')}else if(e.key==='/'&&e.target===document.body){e.preventDefault();controls.search?.focus()}});

 const api={cards,controls,state,norm,split,getBaseCards,getVisibleCards,applyFilters,updateResults,setMapCountryId(id){state.selectedMapCountryId=state.selectedMapCountryId===id?'':id;if(id&&controls.country)controls.country.value='';applyFilters()},setFilter(name,value){const c=controls[name];if(c){state.selectedMapCountryId='';c.value=value;applyFilters()}},showView};
 restore();sortCards();applyFilters();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
