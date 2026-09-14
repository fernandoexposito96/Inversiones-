'use strict';
(function(){
  const C=window.InversionesCore;
  if(!C)throw new Error('No se ha cargado core.js');

  const KEY='mi-control.entries.v1';
  const GOAL_KEY='mi-control.goal.v1';
  const RESET_KEY='mi-control.reset.zero.2026-09-14.v2';
  const DEFAULT_GOAL={amount:3000,start:'2026-09-07',end:'2026-12-06'};
  const TZ='Europe/Madrid';
  const $=id=>document.getElementById(id);
  const euro=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const pct=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(Number(v||0))+'%';
  const sp=()=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const iso=()=>{const p=sp();return `${p.year}-${p.month}-${p.day}`};
  const D=s=>C.dateObj(s);
  const full=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(d);
  const short=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short'}).format(d);

  try{
    if(localStorage.getItem(RESET_KEY)!=='1'){
      localStorage.setItem(KEY,'[]');
      localStorage.removeItem(KEY+'.backup');
      localStorage.setItem(RESET_KEY,'1');
    }
  }catch{}

  function readEntries(){
    try{return (JSON.parse(localStorage.getItem(KEY)||'[]')||[]).map((e,i)=>C.normalizeEntry(e,i)).filter(Boolean)}catch{return []}
  }
  function saveEntries(list){localStorage.setItem(KEY,JSON.stringify(list));}
  function loadGoal(){
    try{
      const g=JSON.parse(localStorage.getItem(GOAL_KEY)||'null');
      if(g&&Number(g.amount)>0&&C.validDate(g.start)&&C.validDate(g.end)&&g.end>=g.start)return {amount:C.money(g.amount),start:g.start,end:g.end};
    }catch{}
    return {...DEFAULT_GOAL};
  }
  function saveGoal(g){localStorage.setItem(GOAL_KEY,JSON.stringify(g));goal=g;}

  let entries=readEntries(),goal=loadGoal(),period='week';

  function setView(goalMode){
    $('investView').classList.toggle('active',!goalMode);
    $('goalView').classList.toggle('active',goalMode);
    $('tabInvest').classList.toggle('active',!goalMode);
    $('tabGoal').classList.toggle('active',goalMode);
    if(goalMode)renderGoal();else renderInvest();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function current(){
    const today=iso(),now=D(today);
    return entries.filter(e=>{
      const d=D(e.date); if(!d)return false;
      if(period==='all')return true;
      if(period==='today')return e.date===today;
      if(period==='month')return d.getUTCFullYear()===now.getUTCFullYear()&&d.getUTCMonth()===now.getUTCMonth();
      const start=new Date(now);start.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));
      const end=new Date(start);end.setUTCDate(start.getUTCDate()+7);
      return d>=start&&d<end;
    }).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);
  }

  function renderInvest(){
    const a=current(),s=C.summary(a),all=C.summary(entries);
    $('staked').textContent=euro(s.st);$('returned').textContent=euro(s.rt);$('loss').textContent=euro(s.loss);$('net').textContent=(s.n>0?'+':'')+euro(s.n);
    $('movesMeta').textContent=`${a.length} movimientos`;$('winsMeta').textContent=`${s.wins} aciertos`;$('lossesMeta').textContent=`${s.losses} fallos`;$('roiMeta').textContent=s.st?pct(s.n/s.st*100):'0,0%';
    $('chartTotal').textContent=(s.n>0?'+':'')+euro(s.n);$('statMoves').textContent=a.length;$('statHit').textContent=a.length?pct(s.wins/a.length*100):'0%';
    const activeDays=new Set(a.map(e=>e.date)).size||1;$('statAvg').textContent=euro(s.n/activeDays);
    $('periodLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo'}[period];
    $('allStaked').textContent=euro(all.st);$('allReturned').textContent=euro(all.rt);$('allLoss').textContent=euro(all.loss);$('allNet').textContent=(all.n>0?'+':'')+euro(all.n);
    $('net').className=s.n<0?'negative':s.n>0?'positive':'';$('allNet').className=all.n<0?'negative':all.n>0?'positive':'';
    drawChart(a);
  }

  function drawChart(a){
    const c=$('chart'),ctx=c.getContext('2d'),r=c.getBoundingClientRect();if(!r.width)return;
    const dpr=window.devicePixelRatio||1,w=r.width,h=210,p=28;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(69,112,180,.16)';ctx.lineWidth=1;for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}
    let cum=0;const pts=a.map(e=>cum=C.money(cum+C.net(e)));if(!pts.length)pts.push(0);
    const min=Math.min(0,...pts),max=Math.max(0,...pts),span=Math.max(1,max-min),step=(w-p*2)/Math.max(1,pts.length-1);
    const coords=pts.map((v,i)=>({x:pts.length===1?w/2:p+i*step,y:h-p-(v-min)/span*(h-p*2)}));
    ctx.strokeStyle=cum<0?'#ef4056':'#7558ff';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;
    if(coords.length>1){ctx.beginPath();coords.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke()}
    const q=coords[coords.length-1];ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();
  }

  function goalDays(){const a=D(goal.start),b=D(goal.end);return Math.floor((b-a)/86400000)+1;}
  function renderGoal(){
    const list=entries.filter(e=>e.date>=goal.start&&e.date<=goal.end).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt),s=C.summary(list),total=goalDays();
    const g=C.goalClock(iso(),goal.start,goal.end,total),remain=Math.max(0,C.money(goal.amount-s.n)),progress=Math.max(0,Math.min(100,s.n/goal.amount*100));
    $('tabGoal').textContent=`Meta ${euro(goal.amount)}`;$('goalValue').textContent=euro(goal.amount);$('goalRange').textContent=`Del ${full(D(goal.start))} al ${full(D(goal.end))}`;
    $('goalBar').style.width=progress+'%';$('goalProgress').textContent=progress.toFixed(1).replace('.',',')+'% completado';$('goalRemaining').textContent=s.n>=goal.amount?'Meta alcanzada':'Faltan '+euro(remain);
    $('goalNet').textContent=(s.n>0?'+':'')+euro(s.n);$('goalReturned').textContent=euro(s.rt);$('goalStaked').textContent=euro(s.st);
    $('daysLeft').textContent=g.left;$('dateInfo').innerHTML=`Hoy: ${full(g.today)}<br>Meta: ${full(g.end)}`;
    const daily=C.goalDaily(s.n,goal.amount,g.left);$('goalDaily').textContent=s.n>=goal.amount?'0,00 €/día':g.left?`${euro(daily)}/día`:'Plazo finalizado';$('goalDailySub').textContent=s.n>=goal.amount?'Objetivo conseguido.':g.left?`Faltan ${euro(remain)} en ${g.left} días.`:`Faltan ${euro(remain)}.`;
    $('daysPassed').textContent=`Día ${g.elapsed} de ${total}`;
    const byDay=new Map();for(const e of list)byDay.set(e.date,C.money((byDay.get(e.date)||0)+C.net(e)));
    let html='';for(let i=0;i<total;i++){const d=new Date(g.start);d.setUTCDate(g.start.getUTCDate()+i);const di=d.toISOString().slice(0,10),sum=byDay.get(di)||0;html+=`<div class="day ${di===iso()?'today':''} ${d<g.today?'done':''}"><b>${i+1}</b><small>${short(d)}</small>${sum!==0?`<small class="${sum<0?'negative':'positive'}">${sum>0?'+':''}${euro(sum)}</small>`:''}</div>`} $('calendar').innerHTML=html;
  }

  $('tabInvest').onclick=()=>setView(false);$('tabGoal').onclick=()=>setView(true);$('navHome').onclick=()=>setView(false);
  document.querySelectorAll('#periods button').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('#periods button').forEach(x=>x.classList.toggle('active',x===b));renderInvest()});
  $('save').onclick=()=>{
    const stake=Number($('stake').value),returned=Number($('returnedInput').value),date=$('date').value;if(!C.validDate(date)||date>iso()||!(stake>0)||returned<0)return;
    const e=C.normalizeEntry({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date,stake,returned,createdAt:Date.now()},entries.length);if(!e)return;entries=[...entries,e];saveEntries(entries);$('stake').value='';$('returnedInput').value='';updatePreview();renderInvest();
  };
  function updatePreview(){const n=C.money(Number($('returnedInput').value||0)-Number($('stake').value||0));$('preview').textContent=(n>0?'+':'')+euro(n);$('preview').className=n<0?'negative':n>0?'positive':'';}
  $('stake').oninput=updatePreview;$('returnedInput').oninput=updatePreview;
  $('goalEditBtn').onclick=()=>{$('goalEditor').classList.toggle('open');$('goalAmountInput').value=goal.amount;$('goalStartInput').value=goal.start;$('goalEndInput').value=goal.end;};
  $('goalCancel').onclick=()=>$('goalEditor').classList.remove('open');
  $('goalSave').onclick=()=>{const amount=C.money(Number($('goalAmountInput').value)),start=$('goalStartInput').value,end=$('goalEndInput').value;if(!(amount>0)||!C.validDate(start)||!C.validDate(end)||end<start)return;saveGoal({amount,start,end});$('goalEditor').classList.remove('open');renderGoal();};

  const today=iso();$('date').value=today;$('date').max=today;$('dateDisplay').textContent=full(D(today));$('date').onchange=()=>{$('dateDisplay').textContent=full(D($('date').value))};
  window.addEventListener('resize',()=>requestAnimationFrame(()=>drawChart(current())));
  if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
  setView(false);
})();