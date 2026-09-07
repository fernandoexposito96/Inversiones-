const STORAGE_KEY='mi-control.entries.v1';
const GOALS_KEY='mi-control.goals.v1';
let entries=loadEntries();
let activePeriod='week';

const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(n||0));
const todayISO=()=>new Date().toISOString().slice(0,10);
const el=id=>document.getElementById(id);

function loadEntries(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return []}}
function saveEntries(){localStorage.setItem(STORAGE_KEY,JSON.stringify(entries))}
function loadGoals(){try{return JSON.parse(localStorage.getItem(GOALS_KEY)||'{"profit":0,"loss":0}')}catch{return {profit:0,loss:0}}}
function saveGoals(g){localStorage.setItem(GOALS_KEY,JSON.stringify(g))}
function netOf(e){return Number(e.returned||0)-Number(e.stake||0)}
function startOfWeek(date=new Date()){const d=new Date(date);d.setHours(0,0,0,0);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}
function inPeriod(e,period){const d=new Date(e.date+'T12:00:00'),now=new Date();if(period==='all')return true;if(period==='today')return e.date===todayISO();if(period==='week'){const s=startOfWeek(now),end=new Date(s);end.setDate(s.getDate()+7);return d>=s&&d<end}if(period==='month')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();return true}
function filtered(period=activePeriod){return entries.filter(e=>inPeriod(e,period)).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt)}
function sum(list,fn){return list.reduce((s,x)=>s+fn(x),0)}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}

function switchView(view){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});if(view==='stats')renderStats();if(view==='history')renderHistory();if(view==='goals')renderGoals()}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));

function renderHome(){const list=filtered();const staked=sum(list,e=>Number(e.stake));const returned=sum(list,e=>Number(e.returned));const losses=sum(list,e=>Math.max(0,-netOf(e)));const net=returned-staked;el('totalStaked').textContent=euro(staked);el('totalReturned').textContent=euro(returned);el('totalLosses').textContent=euro(losses);el('netProfit').textContent=(net>0?'+':'')+euro(net);el('stakeSub').textContent=`${list.length} movimiento${list.length===1?'':'s'}`;el('netCard').classList.toggle('negative',net<0);el('netCard').classList.toggle('positive',net>=0);el('chartNet').textContent=(net>0?'+':'')+euro(net);el('chartLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo el tiempo'}[activePeriod];renderMovementList(el('recentList'),[...list].reverse().slice(0,5),true);drawChart(list)}

function renderMovementList(container,list,compact=false){if(!list.length){container.innerHTML='<div class="empty">Todavía no hay movimientos en este periodo.</div>';return}container.innerHTML=list.map(e=>{const n=netOf(e);return `<div class="movement-row"><span class="date">${new Date(e.date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span><div class="note"><strong>${escapeHtml(e.note||e.category||'Movimiento')}</strong><small>${escapeHtml(e.category||'Apuesta')}</small></div><span class="money stake">${euro(e.stake)}</span><span class="money returned">${euro(e.returned)}</span><span class="net ${n>=0?'pos':'neg'}">${n>0?'+':''}${euro(n)}</span><button class="row-menu" aria-label="Editar" data-edit="${e.id}">•••</button></div>`}).join('');container.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openDialog(entries.find(e=>e.id===b.dataset.edit))))}

function renderHistory(){let list=[...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);const period=el('historyPeriod').value;const q=el('searchInput').value.trim().toLowerCase();if(period!=='all')list=list.filter(e=>inPeriod(e,period));if(q)list=list.filter(e=>(e.note||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q));renderMovementList(el('historyList'),list)}
el('searchInput').addEventListener('input',renderHistory);el('historyPeriod').addEventListener('change',renderHistory);

document.querySelectorAll('#periodTabs button').forEach(b=>b.addEventListener('click',()=>{activePeriod=b.dataset.period;document.querySelectorAll('#periodTabs button').forEach(x=>x.classList.toggle('active',x===b));renderHome()}));

function renderStats(){const list=[...entries];const nets=list.map(netOf);const wins=nets.filter(n=>n>0).length;const losses=nets.filter(n=>n<0).length;const staked=sum(list,e=>Number(e.stake));const net=sum(list,netOf);el('sCount').textContent=list.length;el('sWins').textContent=wins;el('sLosses').textContent=losses;el('sHit').textContent=list.length?`${Math.round(wins/list.length*100)}%`:'0%';el('sRoi').textContent=staked?`${(net/staked*100).toFixed(1)}%`:'0%';el('sAvg').textContent=euro(list.length?net/list.length:0);el('sBest').textContent=euro(nets.length?Math.max(...nets):0);el('sWorst').textContent=euro(nets.length?Math.min(...nets):0);
 const now=new Date(),thisStart=startOfWeek(now),prevStart=new Date(thisStart);prevStart.setDate(prevStart.getDate()-7),prevEnd=new Date(thisStart);const thisNet=sum(entries.filter(e=>{const d=new Date(e.date+'T12:00:00');return d>=thisStart}),netOf);const prevNet=sum(entries.filter(e=>{const d=new Date(e.date+'T12:00:00');return d>=prevStart&&d<prevEnd}),netOf);el('thisWeek').textContent=(thisNet>0?'+':'')+euro(thisNet);el('prevWeek').textContent=(prevNet>0?'+':'')+euro(prevNet);const diff=thisNet-prevNet;el('weekDiff').textContent=(diff>0?'+':'')+euro(diff)}

function renderGoals(){const g=loadGoals();el('goalProfit').value=g.profit||'';el('goalLoss').value=g.loss||'';const month=entries.filter(e=>inPeriod(e,'month'));const net=sum(month,netOf);if(g.profit>0){const pct=Math.max(0,Math.min(100,(net/g.profit)*100));el('goalProgressBar').style.width=`${pct}%`;el('goalProgressText').textContent=`${Math.round(pct)}% · ${euro(net)} / ${euro(g.profit)}`}else{el('goalProgressBar').style.width='0%';el('goalProgressText').textContent='Sin objetivo'}}
el('saveGoals').addEventListener('click',()=>{saveGoals({profit:Number(el('goalProfit').value||0),loss:Number(el('goalLoss').value||0)});renderGoals();toast('Objetivos guardados')});

function openDialog(entry=null){el('entryForm').reset();el('entryDate').value=entry?.date||todayISO();el('editId').value=entry?.id||'';el('entryStake').value=entry?.stake??'';el('entryReturned').value=entry?.returned??'';el('entryCategory').value=entry?.category||'Apuesta';el('entryNote').value=entry?.note||'';el('dialogTitle').textContent=entry?'Editar movimiento':'Añadir movimiento';updatePreview();el('entryDialog').showModal()}
function closeDialog(){el('entryDialog').close()}
function updatePreview(){const n=Number(el('entryReturned').value||0)-Number(el('entryStake').value||0);el('entryPreview').textContent=`Resultado neto: ${n>0?'+':''}${euro(n)}`;el('entryPreview').style.color=n<0?'var(--red)':'var(--green)'}
['entryStake','entryReturned'].forEach(id=>el(id).addEventListener('input',updatePreview));
['openAdd','openAdd2','openAddMobile'].forEach(id=>el(id).addEventListener('click',()=>openDialog()));el('closeDialog').addEventListener('click',closeDialog);

el('entryForm').addEventListener('submit',ev=>{ev.preventDefault();const id=el('editId').value;const data={id:id||crypto.randomUUID(),date:el('entryDate').value,stake:Number(el('entryStake').value),returned:Number(el('entryReturned').value),category:el('entryCategory').value,note:el('entryNote').value.trim(),createdAt:id?(entries.find(e=>e.id===id)?.createdAt||Date.now()):Date.now()};if(!data.date||data.stake<0||data.returned<0)return;entries=id?entries.map(e=>e.id===id?data:e):[...entries,data];saveEntries();closeDialog();renderAll();toast(id?'Movimiento actualizado':'Movimiento guardado')});

el('quickForm').addEventListener('submit',ev=>{ev.preventDefault();entries.push({id:crypto.randomUUID(),date:el('qDate').value,stake:Number(el('qStake').value),returned:Number(el('qReturned').value),category:'Apuesta',note:el('qNote').value.trim(),createdAt:Date.now()});saveEntries();el('quickForm').reset();el('qDate').value=todayISO();renderAll();toast('Movimiento guardado')});

el('historyList').addEventListener('dblclick',ev=>{const btn=ev.target.closest('[data-edit]');if(!btn)return});

function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
el('exportCsv').addEventListener('click',()=>{const rows=[['Fecha','Nota','Categoria','Apostado','Cobrado','Neto'],...entries.map(e=>[e.date,e.note,e.category,e.stake,e.returned,netOf(e)])];download('mi-control-movimientos.csv',rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n'),'text/csv;charset=utf-8')});
el('exportJson').addEventListener('click',()=>download('mi-control-copia.json',JSON.stringify({entries,goals:loadGoals()},null,2),'application/json'));
el('importJson').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.entries))throw new Error();entries=data.entries;saveEntries();if(data.goals)saveGoals(data.goals);renderAll();toast('Copia importada')}catch{toast('Archivo no válido')}ev.target.value=''});
el('clearData').addEventListener('click',()=>{if(!confirm('¿Seguro que quieres borrar todos los movimientos?'))return;entries=[];saveEntries();renderAll();toast('Datos borrados')});

function drawChart(list){const c=el('balanceChart'),ctx=c.getContext('2d'),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=Math.max(600,rect.width*dpr);c.height=Math.max(260,rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height,p=38;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(150,180,210,.12)';ctx.lineWidth=1;for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}let acc=0;let pts=list.map(e=>(acc+=netOf(e)));if(!pts.length)pts=[0];const min=Math.min(0,...pts),max=Math.max(0,...pts),span=Math.max(1,max-min),step=(w-p*2)/Math.max(1,pts.length-1),xy=pts.map((v,i)=>[p+i*step,h-p-((v-min)/span)*(h-p*2)]);ctx.beginPath();xy.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=acc>=0?'#3ee68a':'#ff616d';ctx.lineWidth=3;ctx.stroke();ctx.lineTo(xy.at(-1)[0],h-p);ctx.lineTo(xy[0][0],h-p);ctx.closePath();const g=ctx.createLinearGradient(0,p,0,h);g.addColorStop(0,acc>=0?'rgba(62,230,138,.20)':'rgba(255,97,109,.18)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fill();ctx.fillStyle='#8296ac';ctx.font='11px system-ui';ctx.fillText(euro(max),4,p+4);ctx.fillText(euro(min),4,h-p+4)}
window.addEventListener('resize',()=>drawChart(filtered()));

function renderAll(){renderHome();renderHistory();renderStats();renderGoals()}
el('qDate').value=todayISO();renderAll();

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
