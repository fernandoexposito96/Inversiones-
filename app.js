'use strict';
(function(){
  const C=window.InversionesCore;
  if(!C)throw new Error('No se ha cargado core.js');

  const KEY='mi-control.entries.v1';
  const BACKUP_KEY=KEY+'.backup';
  const GOAL_KEY='mi-control.goal.v1';
  const DEFAULT_GOAL={amount:3000,start:'2026-09-07',end:'2026-12-06'};
  const TZ='Europe/Madrid';

  let entries=[],period='week',lastDate='',saving=false,undoState=null,undoTimer=null;
  let goal=loadGoal();
  const $=id=>document.getElementById(id);
  const euro=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const pct=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(Number(v||0))+'%';
  const pad=n=>String(n).padStart(2,'0');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const sp=(d=new Date())=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
  const iso=()=>{const p=sp();return `${p.year}-${p.month}-${p.day}`};
  const clock=()=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());
  const D=s=>C.dateObj(s);
  const full=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(d);
  const short=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short'}).format(d);
  const net=C.net;

  function goalDays(g=goal){
    const a=D(g.start),b=D(g.end);
    if(!a||!b||b<a)return 1;
    return Math.floor((b-a)/86400000)+1;
  }
  function loadGoal(){
    try{
      const saved=JSON.parse(localStorage.getItem(GOAL_KEY)||'null');
      const amount=Number(saved?.amount),start=String(saved?.start||''),end=String(saved?.end||'');
      if(Number.isFinite(amount)&&amount>0&&C.validDate(start)&&C.validDate(end)&&end>=start)return {amount:C.money(amount),start,end};
    }catch{}
    return {...DEFAULT_GOAL};
  }
  function persistGoal(next){
    try{localStorage.setItem(GOAL_KEY,JSON.stringify(next));goal=next;return true}catch(err){console.error('No se pudo guardar la meta',err);return false}
  }
  function readArray(key){
    try{const raw=localStorage.getItem(key);if(raw===null)return null;const v=JSON.parse(raw);return Array.isArray(v)?v:null}catch{return null}
  }
  function normalizeList(list){
    const out=[],seen=new Set();
    (Array.isArray(list)?list:[]).forEach((e,i)=>{const n=C.normalizeEntry(e,i);if(!n||seen.has(n.id))return;seen.add(n.id);out.push(n)});
    return out;
  }
  function load(){const main=readArray(KEY),backup=readArray(BACKUP_KEY);entries=normalizeList(main!==null?main:(backup!==null?backup:[]));goal=loadGoal()}
  function persist(next){
    const clean=normalizeList(next);
    try{
      const previous=localStorage.getItem(KEY);
      if(previous!==null){try{const p=JSON.parse(previous);if(Array.isArray(p))localStorage.setItem(BACKUP_KEY,previous)}catch{}}
      localStorage.setItem(KEY,JSON.stringify(clean));entries=clean;return true;
    }catch(err){console.error('No se pudo guardar',err);return false}
  }
  function setMsg(text,ok=true){const el=$('msg');if(!el)return;el.textContent=text;el.style.color=ok?'#20e4a0':'#ff7188'}
  function summary(a){return C.summary(a)}
  load();

  function syncDateDisplay(){const v=$('date').value;$('dateDisplay').textContent=C.validDate(v)?full(D(v)):'Seleccionar fecha'}
  function timeUI(){const i=iso();$('todayText').textContent=full(D(i));$('spainClock').textContent=clock();$('date').max=i;if(!$('date').value||$('date').dataset.auto==='1'){$('date').value=i;$('date').dataset.auto='1'}syncDateDisplay();lastDate=i}
  $('date').onchange=()=>{$('date').dataset.auto='0';syncDateDisplay()};
  timeUI();

  function show(isGoal){
    $('investView').classList.toggle('active',!isGoal);$('goalView').classList.toggle('active',isGoal);$('tabInvest').classList.toggle('active',!isGoal);$('tabGoal').classList.toggle('active',isGoal);
    if(isGoal)renderGoal();else renderInvest();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  $('tabInvest').onclick=()=>show(false);$('tabGoal').onclick=()=>show(true);$('navHome').onclick=()=>show(false);

  function startWeek(i){const d=D(i);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d}
  function current(){
    const i=iso(),n=D(i);
    return entries.filter(e=>{const d=D(e.date);if(!d)return false;if(period==='all')return true;if(period==='today')return e.date===i;if(period==='week'){const s=startWeek(i),en=new Date(s);en.setUTCDate(s.getUTCDate()+7);return d>=s&&d<en}return d.getUTCFullYear()===n.getUTCFullYear()&&d.getUTCMonth()===n.getUTCMonth()}).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);
  }
  document.querySelectorAll('#periods button').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('#periods button').forEach(x=>x.classList.toggle('active',x===b));renderInvest()});

  function preview(){const stake=Number($('stake').value||0),returned=Number($('returnedInput').value||0),n=C.money(returned-stake);$('preview').textContent=(n>0?'+':'')+euro(n);$('preview').style.color=n<0?'#ff4f6b':n>0?'#20e4a0':'#fff'}
  $('stake').oninput=preview;$('returnedInput').oninput=preview;
  $('save').onclick=()=>{
    if(saving)return;
    const stake=Number($('stake').value),returned=Number($('returnedInput').value),date=$('date').value;
    if(date>iso()){setMsg('La fecha no puede ser posterior a hoy.',false);return}
    const randomId=globalThis.crypto?.randomUUID?.()||`m-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const candidate=C.normalizeEntry({id:randomId,date,stake,returned,createdAt:Date.now()},entries.length);
    if(!candidate){setMsg('Introduce una fecha y cantidades válidas.',false);return}
    saving=true;$('save').disabled=true;$('save').style.opacity='.7';
    const ok=persist([...entries,candidate]);
    if(ok){$('stake').value='';$('returnedInput').value='';preview();setMsg('Movimiento guardado.');renderInvest();if($('goalView').classList.contains('active'))renderGoal();setTimeout(()=>setMsg(''),1500);setTimeout(()=>{saving=false;$('save').disabled=false;$('save').style.opacity=''},650)}else{setMsg('No se ha podido guardar. No se ha perdido ningún dato.',false);saving=false;$('save').disabled=false;$('save').style.opacity=''}
  };

  function ensureTools(){
    if($('dataTools'))return;
    const style=document.createElement('style');
    style.textContent=`
      .dataTools{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.dataTool{border:1px solid #2f75af;background:#061a30;color:#dff0ff;border-radius:10px;padding:6px 9px;font-size:9px;font-weight:900}.undoToast{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:50;width:min(420px,calc(100% - 24px));display:none;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border:1px solid #2f75af;border-radius:13px;background:rgba(4,21,40,.97);box-shadow:0 12px 35px rgba(0,0,0,.4);color:#eef7ff;font-size:11px}.undoToast button{border:0;border-radius:9px;padding:7px 10px;background:#168cff;color:#fff;font-weight:900}
      .goalEditBtn{border:1px solid #2ad4ff;background:linear-gradient(145deg,#0f4978,#123a69);color:#fff;border-radius:12px;padding:8px 12px;font-weight:900;font-size:10px;box-shadow:0 0 18px rgba(38,193,255,.18)}
      .goalEditor{display:none;margin:0 0 12px;padding:14px;border:1px solid #2a77b2;border-radius:16px;background:linear-gradient(180deg,rgba(8,34,63,.98),rgba(4,21,40,.98));box-shadow:0 14px 34px rgba(0,0,0,.26)}.goalEditor.open{display:block}.goalEditor h3{margin:0 0 12px;font-size:16px}.goalEditGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.goalEditField:first-child{grid-column:1/-1}.goalEditField label{display:block;color:#b9cce0;font-size:10px;font-weight:800;margin-bottom:5px}.goalEditField input{width:100%;height:46px;border:1px solid #2a689b;background:#041525;color:#fff;border-radius:11px;padding:0 11px;outline:none;color-scheme:dark}.goalEditActions{display:flex;gap:8px;margin-top:11px}.goalEditActions button{flex:1;height:44px;border-radius:11px;font-weight:900}.goalSave{border:0;background:linear-gradient(100deg,#25d9ff,#247dff 50%,#7b4dff);color:#fff}.goalCancel{border:1px solid #2f75af;background:#061a30;color:#dff0ff}.goalEditMsg{min-height:14px;margin-top:8px;font-size:10px;color:#ff7188}@media(max-width:430px){.goalEditGrid{grid-template-columns:1fr}.goalEditField:first-child{grid-column:auto}}
    `;
    document.head.appendChild(style);
    const count=$('historyCount'),head=count?.parentElement;
    if(head){const tools=document.createElement('div');tools.id='dataTools';tools.className='dataTools';tools.innerHTML='<button id="exportData" class="dataTool" type="button">Guardar copia</button><button id="importData" class="dataTool" type="button">Restaurar</button><input id="importFile" type="file" accept="application/json,.json" hidden>';head.appendChild(tools)}
    const toast=document.createElement('div');toast.id='undoToast';toast.className='undoToast';toast.innerHTML='<span>Movimiento eliminado.</span><button id="undoDelete" type="button">Deshacer</button>';document.body.appendChild(toast);
    $('exportData').onclick=exportBackup;$('importData').onclick=()=>$('importFile').click();$('importFile').onchange=importBackup;$('undoDelete').onclick=undoDelete;
    const avg=$('statAvg'),avgLabel=avg?.parentElement?.querySelector('span');if(avgLabel)avgLabel.textContent='Media / día con movimiento';
    ensureGoalEditor();
  }

  function ensureGoalEditor(){
    if($('goalEditor'))return;
    const host=$('goalView');if(!host)return;
    const editor=document.createElement('div');editor.id='goalEditor';editor.className='goalEditor';editor.innerHTML=`<h3>Cambiar meta</h3><div class="goalEditGrid"><div class="goalEditField"><label>Objetivo (€)</label><input id="goalAmountInput" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="goalEditField"><label>Fecha de inicio</label><input id="goalStartInput" type="date"></div><div class="goalEditField"><label>Fecha final</label><input id="goalEndInput" type="date"></div></div><div class="goalEditActions"><button id="goalCancel" class="goalCancel" type="button">Cancelar</button><button id="goalSave" class="goalSave" type="button">Guardar meta</button></div><div id="goalEditMsg" class="goalEditMsg"></div>`;
    host.prepend(editor);
    const btn=document.createElement('button');btn.id='goalEditBtn';btn.className='goalEditBtn';btn.type='button';btn.textContent='Cambiar meta';
    const firstCard=host.querySelector('.card');if(firstCard){const h=firstCard.querySelector('.head');if(h)h.appendChild(btn);else firstCard.prepend(btn)}else host.prepend(btn);
    btn.onclick=()=>openGoalEditor();$('goalCancel').onclick=()=>editor.classList.remove('open');$('goalSave').onclick=saveGoalEditor;
  }
  function syncGoalEditor(){
    if(!$('goalAmountInput'))return;$('goalAmountInput').value=goal.amount;$('goalStartInput').value=goal.start;$('goalEndInput').value=goal.end;$('goalEditMsg').textContent='';
  }
  function openGoalEditor(){syncGoalEditor();$('goalEditor').classList.add('open');$('goalAmountInput').focus();}
  function saveGoalEditor(){
    const amount=C.money(Number($('goalAmountInput').value)),start=$('goalStartInput').value,end=$('goalEndInput').value,msg=$('goalEditMsg');
    if(!Number.isFinite(amount)||amount<=0){msg.textContent='Introduce una meta mayor que 0 €.';return}
    if(!C.validDate(start)||!C.validDate(end)){msg.textContent='Selecciona fechas válidas.';return}
    if(end<start){msg.textContent='La fecha final debe ser posterior a la fecha de inicio.';return}
    if(!persistGoal({amount,start,end})){msg.textContent='No se ha podido guardar la meta.';return}
    $('goalEditor').classList.remove('open');renderGoal();
  }

  async function exportBackup(){
    const payload={app:'Inversiones',version:2,exportedAt:new Date().toISOString(),goal,entries:normalizeList(entries)};
    const text=JSON.stringify(payload,null,2),name=`inversiones-copia-${iso()}.json`,file=new File([text],name,{type:'application/json'});
    try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:'Copia de Inversiones',files:[file]});return}const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(err){if(err?.name!=='AbortError'){console.error(err);alert('No se ha podido crear la copia de seguridad.')}}
  }
  async function importBackup(ev){
    const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
    try{
      const data=JSON.parse(await file.text()),list=Array.isArray(data)?data:data?.entries,clean=normalizeList(list);
      if(!Array.isArray(list)||clean.length!==list.length)throw new Error('Copia inválida');
      if(!confirm(`¿Restaurar ${clean.length} movimiento${clean.length===1?'':'s'}? Se sustituirán los datos actuales.`))return;
      if(!persist(clean))throw new Error('No se pudo guardar');
      if(data?.goal){const g=data.goal,amount=C.money(Number(g.amount));if(amount>0&&C.validDate(g.start)&&C.validDate(g.end)&&g.end>=g.start)persistGoal({amount,start:g.start,end:g.end})}
      renderActive();alert('Copia restaurada correctamente.');
    }catch(err){console.error(err);alert('La copia no es válida o no se ha podido restaurar.')}
  }

  $('historyList').addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-del]');if(!btn)return;const id=btn.dataset.del,index=entries.findIndex(e=>e.id===id);if(index<0)return;if(!confirm('¿Eliminar este movimiento?'))return;
    const entry=entries[index],next=entries.filter(e=>e.id!==id);if(!persist(next)){alert('No se ha podido eliminar. El movimiento sigue guardado.');return}
    undoState={entry,index};clearTimeout(undoTimer);$('undoToast').style.display='flex';undoTimer=setTimeout(()=>{undoState=null;$('undoToast').style.display='none'},7000);renderInvest();if($('goalView').classList.contains('active'))renderGoal();
  });
  function undoDelete(){if(!undoState)return;const next=[...entries];next.splice(Math.min(undoState.index,next.length),0,undoState.entry);if(!persist(next)){alert('No se ha podido recuperar el movimiento.');return}clearTimeout(undoTimer);undoState=null;$('undoToast').style.display='none';renderActive()}
  function renderHistory(a){$('historyCount').textContent=`${a.length} movimiento${a.length===1?'':'s'}`;const o=[...a].sort((x,y)=>y.date.localeCompare(x.date)||y.createdAt-x.createdAt);$('historyList').innerHTML=o.length?o.map(e=>{const n=net(e);return `<div class="row"><span>${full(D(e.date))}</span><span class="hideM">${euro(e.stake)}</span><span class="hideM">${euro(e.returned)}</span><strong class="netM ${n<0?'negative':'positive'}">${n>0?'+':''}${euro(n)}</strong><button class="del" type="button" aria-label="Eliminar movimiento" data-del="${esc(e.id)}">×</button></div>`}).join(''):'<div class="empty">Todavía no hay movimientos en este periodo.</div>'}

  function renderInvest(){
    const a=current(),s=summary(a),all=summary(entries);
    $('staked').textContent=euro(s.st);$('returned').textContent=euro(s.rt);$('loss').textContent=euro(s.loss);$('net').textContent=(s.n>0?'+':'')+euro(s.n);$('net').style.color=s.n<0?'#ff4f6b':s.n>0?'#20e4a0':'#fff';
    $('movesMeta').textContent=`${a.length} movimientos`;$('winsMeta').textContent=`${s.wins} aciertos`;$('lossesMeta').textContent=`${s.losses} fallos`;$('roiMeta').textContent=s.st?pct(s.n/s.st*100):'0,0%';
    $('chartTotal').textContent=(s.n>0?'+':'')+euro(s.n);$('statMoves').textContent=a.length;$('statHit').textContent=a.length?pct(s.wins/a.length*100):'0%';$('statAvg').textContent=euro(s.n/(new Set(a.map(e=>e.date)).size||1));$('periodLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo'}[period];
    $('allStaked').textContent=euro(all.st);$('allReturned').textContent=euro(all.rt);$('allLoss').textContent=euro(all.loss);$('allNet').textContent=(all.n>0?'+':'')+euro(all.n);$('allNet').style.color=all.n<0?'#ff4f6b':all.n>0?'#20e4a0':'#fff';renderHistory(a);requestAnimationFrame(()=>draw(a));
  }
  function draw(a){
    const c=$('chart'),ctx=c.getContext('2d'),r=c.getBoundingClientRect();if(!r.width)return;const dpr=window.devicePixelRatio||1,w=r.width,h=210,p=28;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(80,180,255,.18)';ctx.lineWidth=1;for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}let cum=0;const pts=a.map(e=>cum=C.money(cum+net(e)));if(!pts.length)pts.push(0);const min=Math.min(0,...pts),max=Math.max(0,...pts),span=Math.max(1,max-min),step=(w-p*2)/Math.max(1,pts.length-1),coords=pts.map((v,i)=>({x:pts.length===1?w/2:p+i*step,y:h-p-(v-min)/span*(h-p*2)}));ctx.strokeStyle=cum>=0?'#2ca5ff':'#ff4f6b';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;if(coords.length>1){ctx.beginPath();coords.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke()}ctx.beginPath();ctx.arc(coords[coords.length-1].x,coords[coords.length-1].y,4,0,Math.PI*2);ctx.fill();
  }

  function renderGoal(){
    ensureGoalEditor();
    const total=goalDays();
    const a=entries.filter(e=>e.date>=goal.start&&e.date<=goal.end).sort((x,y)=>x.date.localeCompare(y.date)||x.createdAt-y.createdAt),s=summary(a),remain=Math.max(0,C.money(goal.amount-s.n)),prog=Math.max(0,Math.min(100,s.n/goal.amount*100)),g=C.goalClock(iso(),goal.start,goal.end,total);
    $('tabGoal').textContent=`Meta ${euro(goal.amount)}`;
    const title=$('goalView').querySelector('.head h2');if(title)title.textContent=`Meta ${euro(goal.amount)}`;
    const goalValue=$('goalView').querySelector('.goalValue');if(goalValue)goalValue.textContent=euro(goal.amount);
    const sub=$('goalView').querySelector('.sub');if(sub)sub.textContent=`Del ${full(D(goal.start))} al ${full(D(goal.end))}`;
    $('goalNet').textContent=(s.n>0?'+':'')+euro(s.n);$('goalNet').style.color=s.n<0?'#ff4f6b':s.n>0?'#20e4a0':'#fff';$('goalReturned').textContent=euro(s.rt);$('goalStaked').textContent=euro(s.st);$('goalBar').style.width=prog+'%';$('goalProgress').textContent=prog.toFixed(1).replace('.',',')+'% completado';$('goalRemaining').textContent=s.n>=goal.amount?'Meta alcanzada':'Faltan '+euro(remain);$('daysLeft').textContent=g.left;$('daysPassed').textContent=`Día ${g.elapsed} de ${total}`;$('dateInfo').innerHTML=`Hoy: ${full(g.today)}<br>Meta: ${full(g.end)}`;
    const daily=C.goalDaily(s.n,goal.amount,g.left);$('goalDaily').textContent=s.n>=goal.amount?'0,00 €/día':g.left?`${euro(daily)}/día`:'Plazo finalizado';$('goalDailySub').textContent=s.n>=goal.amount?'Objetivo conseguido.':g.left?`Faltan ${euro(remain)} en ${g.left} días.`:`Faltan ${euro(remain)}.`;
    const byDay=new Map();for(const e of a)byDay.set(e.date,C.money((byDay.get(e.date)||0)+net(e)));let cells='';for(let i=0;i<total;i++){const d=new Date(g.start);d.setUTCDate(g.start.getUTCDate()+i);const di=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,sum=byDay.get(di)||0;cells+=`<div class="day ${d<g.today?'done':''} ${di===iso()?'today':''}"><b>${i+1}</b><small>${short(d)}</small>${sum!==0?`<small class="${sum<0?'negative':'positive'}">${sum>0?'+':''}${euro(sum)}</small>`:''}</div>`}cells+=`<div class="day goalday"><b>Meta</b><small>${short(g.end)}</small></div>`;$('calendar').innerHTML=cells;
    $('goalMovementCount').textContent=`${a.length} movimiento${a.length===1?'':'s'}`;if(!a.length)$('goalHistory').innerHTML='<div class="empty">Todavía no hay movimientos dentro de esta meta.</div>';else{let cum=0;$('goalHistory').innerHTML='<div class="tableWrap"><table class="table"><thead><tr><th>Fecha</th><th>Apostado</th><th>Cobrado</th><th>Neto</th><th>Acumulado</th></tr></thead><tbody>'+a.map(e=>{const n=net(e);cum=C.money(cum+n);return `<tr><td>${full(D(e.date))}</td><td>${euro(e.stake)}</td><td>${euro(e.returned)}</td><td class="${n<0?'negative':'positive'}">${n>0?'+':''}${euro(n)}</td><td>${euro(cum)}</td></tr>`}).join('')+'</tbody></table></div>'}
  }

  function renderActive(){if($('goalView').classList.contains('active'))renderGoal();else renderInvest()}
  ensureTools();
  window.addEventListener('storage',()=>{load();renderActive()});
  window.addEventListener('pageshow',()=>{load();timeUI();show(false)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();timeUI();renderActive()}});
  setInterval(()=>{const i=iso();$('spainClock').textContent=clock();if(i!==lastDate){timeUI();renderActive()}},1000);
  window.addEventListener('resize',()=>{if($('investView').classList.contains('active'))requestAnimationFrame(()=>draw(current()))});
  if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{})}
  show(false);
})();