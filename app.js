const STORAGE_KEY='mi-control.entries.v1';
let entries=loadEntries();
let activePeriod='week';

const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(n||0));
const todayISO=()=>new Date().toISOString().slice(0,10);
const el=id=>document.getElementById(id);

function loadEntries(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return []}}
function saveEntries(){localStorage.setItem(STORAGE_KEY,JSON.stringify(entries))}
function netOf(e){return Number(e.returned||0)-Number(e.stake||0)}
function startOfWeek(date=new Date()){const d=new Date(date);d.setHours(0,0,0,0);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}
function inPeriod(e,period){const d=new Date(e.date+'T12:00:00'),now=new Date();if(period==='all')return true;if(period==='today')return e.date===todayISO();if(period==='week'){const s=startOfWeek(now),end=new Date(s);end.setDate(s.getDate()+7);return d>=s&&d<end}if(period==='month')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();return true}
function filtered(){return entries.filter(e=>inPeriod(e,activePeriod)).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt)}
function sum(list,fn){return list.reduce((s,x)=>s+fn(x),0)}
function escapeHtml(s){return String(s??'').replace(/[&<>'\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[m]))}
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}

function renderHome(){
  const list=filtered();
  const staked=sum(list,e=>Number(e.stake));
  const returned=sum(list,e=>Number(e.returned));
  const losses=sum(list,e=>Math.max(0,-netOf(e)));
  const net=returned-staked;
  el('totalStaked').textContent=euro(staked);
  el('totalReturned').textContent=euro(returned);
  el('totalLosses').textContent=euro(losses);
  el('netProfit').textContent=(net>0?'+':'')+euro(net);
  el('stakeSub').textContent=`${list.length} movimiento${list.length===1?'':'s'}`;
  el('netCard').classList.toggle('negative',net<0);
  el('netCard').classList.toggle('positive',net>=0);
  el('chartNet').textContent=(net>0?'+':'')+euro(net);
  el('chartLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo el tiempo'}[activePeriod];
  renderMovementList(el('recentList'),[...list].reverse().slice(0,8));
  drawChart(list);
}

function renderMovementList(container,list){
  if(!list.length){container.innerHTML='<div class="empty">Todavía no hay movimientos en este periodo.</div>';return}
  container.innerHTML=list.map(e=>{const n=netOf(e);return `<div class="movement-row"><span class="date">${new Date(e.date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span><div class="note"><strong>${escapeHtml(e.note||e.category||'Movimiento')}</strong><small>${escapeHtml(e.category||'Apuesta')}</small></div><span class="money stake">${euro(e.stake)}</span><span class="money returned">${euro(e.returned)}</span><span class="net ${n>=0?'pos':'neg'}">${n>0?'+':''}${euro(n)}</span><button class="row-menu" aria-label="Editar" data-edit="${e.id}">•••</button></div>`}).join('');
  container.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openDialog(entries.find(e=>e.id===b.dataset.edit))));
}

document.querySelectorAll('#periodTabs button').forEach(b=>b.addEventListener('click',()=>{
  activePeriod=b.dataset.period;
  document.querySelectorAll('#periodTabs button').forEach(x=>x.classList.toggle('active',x===b));
  renderHome();
}));

function openDialog(entry=null){
  el('entryForm').reset();
  el('entryDate').value=entry?.date||todayISO();
  el('editId').value=entry?.id||'';
  el('entryStake').value=entry?.stake??'';
  el('entryReturned').value=entry?.returned??'';
  el('entryCategory').value=entry?.category||'Apuesta';
  el('entryNote').value=entry?.note||'';
  el('dialogTitle').textContent=entry?'Editar movimiento':'Añadir movimiento';
  el('deleteEntry').hidden=!entry;
  updatePreview();
  el('entryDialog').showModal();
}
function closeDialog(){el('entryDialog').close()}
function updatePreview(){const n=Number(el('entryReturned').value||0)-Number(el('entryStake').value||0);el('entryPreview').textContent=`Resultado neto: ${n>0?'+':''}${euro(n)}`;el('entryPreview').style.color=n<0?'var(--red)':'var(--green)'}
['entryStake','entryReturned'].forEach(id=>el(id).addEventListener('input',updatePreview));
el('openAdd').addEventListener('click',()=>openDialog());
el('closeDialog').addEventListener('click',closeDialog);
el('deleteEntry').addEventListener('click',()=>{const id=el('editId').value;if(!id)return;if(!confirm('¿Eliminar este movimiento?'))return;entries=entries.filter(e=>e.id!==id);saveEntries();closeDialog();renderHome();toast('Movimiento eliminado')});

el('entryForm').addEventListener('submit',ev=>{
  ev.preventDefault();
  const id=el('editId').value;
  const data={id:id||crypto.randomUUID(),date:el('entryDate').value,stake:Number(el('entryStake').value),returned:Number(el('entryReturned').value),category:el('entryCategory').value,note:el('entryNote').value.trim(),createdAt:id?(entries.find(e=>e.id===id)?.createdAt||Date.now()):Date.now()};
  if(!data.date||data.stake<0||data.returned<0)return;
  entries=id?entries.map(e=>e.id===id?data:e):[...entries,data];
  saveEntries();closeDialog();renderHome();toast(id?'Movimiento actualizado':'Movimiento guardado');
});

el('quickForm').addEventListener('submit',ev=>{
  ev.preventDefault();
  entries.push({id:crypto.randomUUID(),date:el('qDate').value,stake:Number(el('qStake').value),returned:Number(el('qReturned').value),category:'Apuesta',note:el('qNote').value.trim(),createdAt:Date.now()});
  saveEntries();el('quickForm').reset();el('qDate').value=todayISO();renderHome();toast('Movimiento guardado');
});

function drawChart(list){
  const c=el('balanceChart'),ctx=c.getContext('2d'),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  c.width=Math.max(600,rect.width*dpr);c.height=Math.max(260,rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=rect.width,h=rect.height,p=38;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(150,180,210,.12)';ctx.lineWidth=1;
  for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}
  let acc=0;let pts=list.map(e=>(acc+=netOf(e)));if(!pts.length)pts=[0];
  const min=Math.min(0,...pts),max=Math.max(0,...pts),span=Math.max(1,max-min),step=(w-p*2)/Math.max(1,pts.length-1),xy=pts.map((v,i)=>[p+i*step,h-p-((v-min)/span)*(h-p*2)]);
  ctx.beginPath();xy.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=acc>=0?'#3ee68a':'#ff616d';ctx.lineWidth=3;ctx.stroke();
  ctx.lineTo(xy.at(-1)[0],h-p);ctx.lineTo(xy[0][0],h-p);ctx.closePath();const g=ctx.createLinearGradient(0,p,0,h);g.addColorStop(0,acc>=0?'rgba(62,230,138,.20)':'rgba(255,97,109,.18)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fill();ctx.fillStyle='#8296ac';ctx.font='11px system-ui';ctx.fillText(euro(max),4,p+4);ctx.fillText(euro(min),4,h-p+4);
}
window.addEventListener('resize',()=>drawChart(filtered()));

el('qDate').value=todayISO();
renderHome();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
