'use strict';
(function(){
  const C=window.InversionesCore;
  if(!C)throw new Error('No se ha cargado core.js');
  const KEY='mi-control.entries.v1',BACKUP_KEY=KEY+'.backup',GOAL=3000,START='2026-09-07',END='2026-12-06',TOTAL=90,TZ='Europe/Madrid';
  let entries=[],period='week',lastDate='',saving=false;
  const $=id=>document.getElementById(id);
  const euro=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const pct=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(Number(v||0))+'%';
  const pad=n=>String(n).padStart(2,'0');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sp=(d=new Date())=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
  const iso=()=>{const p=sp();return `${p.year}-${p.month}-${p.day}`};
  const clock=()=>new Intl.DateTimeFormat('es-ES',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());
  const D=s=>C.dateObj(s);
  const full=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(d);
  const short=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short'}).format(d);
  const net=C.net;

  function readArray(key){
    try{const raw=localStorage.getItem(key);if(raw===null)return null;const v=JSON.parse(raw);return Array.isArray(v)?v:null}catch{return null}
  }
  function normalizeList(list){
    const out=[],seen=new Set();
    (Array.isArray(list)?list:[]).forEach((e,i)=>{const n=C.normalizeEntry(e,i);if(!n||seen.has(n.id))return;seen.add(n.id);out.push(n)});
    return out;
  }
  function load(){
    const main=readArray(KEY),backup=readArray(BACKUP_KEY);
    entries=normalizeList(main!==null?main:(backup!==null?backup:[]));
  }
  function persist(next){
    const clean=normalizeList(next);
    try{
      const previous=localStorage.getItem(KEY);
      if(previous!==null){try{const p=JSON.parse(previous);if(Array.isArray(p))localStorage.setItem(BACKUP_KEY,previous)}catch{}}
      localStorage.setItem(KEY,JSON.stringify(clean));
      entries=clean;
      return true;
    }catch(err){console.error('No se pudo guardar',err);return false}
  }
  function setMsg(text,ok=true){const el=$('msg');el.textContent=text;el.style.color=ok?'#20e4a0':'#ff7188'}
  function summary(a){return C.summary(a)}
  load();

  function syncDateDisplay(){const v=$('date').value;$('dateDisplay').textContent=C.validDate(v)?full(D(v)):'Seleccionar fecha'}
  function timeUI(){const i=iso();$('todayText').textContent=full(D(i));$('spainClock').textContent=clock();if(!$('date').value||$('date').dataset.auto==='1'){$('date').value=i;$('date').dataset.auto='1'}syncDateDisplay();lastDate=i}
  $('date').onchange=()=>{$('date').dataset.auto='0';syncDateDisplay()};
  timeUI();

  function show(goal){
    $('investView').classList.toggle('active',!goal);$('goalView').classList.toggle('active',goal);$('tabInvest').classList.toggle('active',!goal);$('tabGoal').classList.toggle('active',goal);
    if(goal)renderGoal();else renderInvest();
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
    const candidate=C.normalizeEntry({id:(crypto&&crypto.randomUUID?crypto.randomUUID():`m-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),date,stake,returned,createdAt:Date.now()},entries.length);
    if(!candidate){setMsg('Introduce una fecha y cantidades válidas.',false);return}
    saving=true;$('save').disabled=true;$('save').style.opacity='.7';
    const ok=persist([...entries,candidate]);
    if(ok){$('stake').value='';$('returnedInput').value='';preview();setMsg('Movimiento guardado.');renderInvest();if($('goalView').classList.contains('active'))renderGoal();setTimeout(()=>setMsg(''),1500)}else setMsg('No se ha podido guardar. No se ha perdido ningún dato.',false);
    saving=false;$('save').disabled=false;$('save').style.opacity='';
  };

  $('historyList').addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-del]');if(!btn)return;
    const id=btn.dataset.del,entry=entries.find(e=>e.id===id);if(!entry)return;
    if(!confirm('¿Eliminar este movimiento?'))return;
    const next=entries.filter(e=>e.id!==id);
    if(!persist(next)){alert('No se ha podido eliminar. El movimiento sigue guardado.');return}
    renderInvest();if($('goalView').classList.contains('active'))renderGoal();
  });

  function renderHistory(a){
    $('historyCount').textContent=`${a.length} movimiento${a.length===1?'':'s'}`;
    const o=[...a].sort((x,y)=>y.date.localeCompare(x.date)||y.createdAt-x.createdAt);
    $('historyList').innerHTML=o.length?o.map(e=>{const n=net(e);return `<div class="row"><span>${full(D(e.date))}</span><span class="hideM">${euro(e.stake)}</span><span class="hideM">${euro(e.returned)}</span><strong class="netM ${n<0?'negative':'positive'}">${n>0?'+':''}${euro(n)}</strong><button class="del" type="button" aria-label="Eliminar movimiento" data-del="${esc(e.id)}">×</button></div>`}).join(''):'<div class="empty">Todavía no hay movimientos en este periodo.</div>';
  }
  function renderInvest(){
    const a=current(),s=summary(a),all=summary(entries);
    $('staked').textContent=euro(s.st);$('returned').textContent=euro(s.rt);$('loss').textContent=euro(s.loss);$('net').textContent=(s.n>0?'+':'')+euro(s.n);$('net').style.color=s.n<0?'#ff4f6b':s.n>0?'#20e4a0':'#fff';
    $('movesMeta').textContent=`${a.length} movimientos`;$('winsMeta').textContent=`${s.wins} aciertos`;$('lossesMeta').textContent=`${s.losses} fallos`;$('roiMeta').textContent=s.st?pct(s.n/s.st*100):'0,0%';
    $('chartTotal').textContent=(s.n>0?'+':'')+euro(s.n);$('statMoves').textContent=a.length;$('statHit').textContent=a.length?pct(s.wins/a.length*100):'0%';$('statAvg').textContent=euro(s.n/(new Set(a.map(e=>e.date)).size||1));$('periodLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo'}[period];
    $('allStaked').textContent=euro(all.st);$('allReturned').textContent=euro(all.rt);$('allLoss').textContent=euro(all.loss);$('allNet').textContent=(all.n>0?'+':'')+euro(all.n);$('allNet').style.color=all.n<0?'#ff4f6b':all.n>0?'#20e4a0':'#fff';
    renderHistory(a);requestAnimationFrame(()=>draw(a));
  }
  function draw(a){
    const c=$('chart'),ctx=c.getContext('2d'),r=c.getBoundingClientRect();if(!r.width)return;
    const dpr=window.devicePixelRatio||1,w=r.width,h=210,p=28;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(80,180,255,.18)';ctx.lineWidth=1;for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}
    let cum=0;const pts=a.map(e=>cum=C.money(cum+net(e)));if(!pts.length)pts.push(0);
    const min=Math.min(0,...pts),max=Math.max(0,...pts),span=Math.max(1,max-min),step=(w-p*2)/Math.max(1,pts.length-1),coords=pts.map((v,i)=>({x:pts.length===1?w/2:p+i*step,y:h-p-(v-min)/span*(h-p*2)}));
    ctx.strokeStyle=cum>=0?'#2ca5ff':'#ff4f6b';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;if(coords.length>1){ctx.beginPath();coords.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke()}ctx.beginPath();ctx.arc(coords[coords.length-1].x,coords[coords.length-1].y,4,0,Math.PI*2);ctx.fill();
  }

  function renderGoal(){
    const a=entries.filter(e=>e.date>=START&&e.date<=END).sort((x,y)=>x.date.localeCompare(y.date)||x.createdAt-y.createdAt),s=summary(a),remain=Math.max(0,C.money(GOAL-s.n)),prog=Math.max(0,Math.min(100,s.n/GOAL*100)),g=C.goalClock(iso(),START,END,TOTAL);
    $('goalNet').textContent=(s.n>0?'+':'')+euro(s.n);$('goalNet').style.color=s.n<0?'#ff4f6b':s.n>0?'#20e4a0':'#fff';$('goalReturned').textContent=euro(s.rt);$('goalStaked').textContent=euro(s.st);$('goalBar').style.width=prog+'%';$('goalProgress').textContent=prog.toFixed(1).replace('.',',')+'% completado';$('goalRemaining').textContent=s.n>=GOAL?'Meta alcanzada':'Faltan '+euro(remain);$('daysLeft').textContent=g.left;$('daysPassed').textContent=`Día ${g.elapsed} de ${TOTAL}`;$('dateInfo').innerHTML=`Hoy: ${full(g.today)}<br>Meta: ${full(g.end)}`;
    const daily=C.goalDaily(s.n,GOAL,g.left);$('goalDaily').textContent=s.n>=GOAL?'0,00 €/día':g.left?`${euro(daily)}/día`:'Plazo finalizado';$('goalDailySub').textContent=s.n>=GOAL?'Objetivo conseguido.':g.left?`Faltan ${euro(remain)} en ${g.left} días.`:`Faltan ${euro(remain)}.`;
    const byDay=new Map();for(const e of a)byDay.set(e.date,C.money((byDay.get(e.date)||0)+net(e)));
    let cells='';for(let i=0;i<TOTAL;i++){const d=new Date(g.start);d.setUTCDate(g.start.getUTCDate()+i);const di=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,sum=byDay.get(di)||0;cells+=`<div class="day ${d<g.today?'done':''} ${di===iso()?'today':''}"><b>${i+1}</b><small>${short(d)}</small>${sum!==0?`<small class="${sum<0?'negative':'positive'}">${sum>0?'+':''}${euro(sum)}</small>`:''}</div>`}cells+=`<div class="day goalday"><b>Meta</b><small>${short(g.end)}</small></div>`;$('calendar').innerHTML=cells;
    $('goalMovementCount').textContent=`${a.length} movimiento${a.length===1?'':'s'}`;if(!a.length)$('goalHistory').innerHTML='<div class="empty">Todavía no hay movimientos dentro de esta meta.</div>';else{let cum=0;$('goalHistory').innerHTML='<div class="tableWrap"><table class="table"><thead><tr><th>Fecha</th><th>Apostado</th><th>Cobrado</th><th>Neto</th><th>Acumulado</th></tr></thead><tbody>'+a.map(e=>{const n=net(e);cum=C.money(cum+n);return `<tr><td>${full(D(e.date))}</td><td>${euro(e.stake)}</td><td>${euro(e.returned)}</td><td class="${n<0?'negative':'positive'}">${n>0?'+':''}${euro(n)}</td><td>${euro(cum)}</td></tr>`}).join('')+'</tbody></table></div>'}
  }
  function renderActive(){if($('goalView').classList.contains('active'))renderGoal();else renderInvest()}
  window.addEventListener('storage',()=>{load();renderActive()});
  window.addEventListener('pageshow',()=>{load();timeUI();show(false)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();timeUI();renderActive()}});
  setInterval(()=>{const i=iso();$('spainClock').textContent=clock();if(i!==lastDate){timeUI();renderActive()}},1000);
  window.addEventListener('resize',()=>{if($('investView').classList.contains('active'))requestAnimationFrame(()=>draw(current()))});
  if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{})}
  show(false);
})();
