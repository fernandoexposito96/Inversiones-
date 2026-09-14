'use strict';
(function(){
  const C=window.InversionesCore;
  if(!C)throw new Error('No se ha cargado core.js');

  const KEY='mi-control.entries.v1';
  const BACKUP_KEY=KEY+'.shadow';
  const GOAL_KEY='mi-control.goal.v1';
  const GOAL_BACKUP_KEY=GOAL_KEY+'.shadow';
  const DEFAULT_GOAL={amount:3000,start:'2026-09-01',end:'2026-12-06'};
  const TZ='Europe/Madrid';
  const $=id=>document.getElementById(id);
  const euro=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const pct=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(Number(v||0))+'%';
  const sp=()=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const iso=()=>{const p=sp();return `${p.year}-${p.month}-${p.day}`};
  const D=s=>C.dateObj(s);
  const full=d=>d instanceof Date&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(d):'Seleccionar fecha';
  const short=d=>new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',day:'numeric',month:'short'}).format(d);
  let saving=false,goalMode=false,resizeRaf=0,editingId=null;

  function parseStored(key){
    const text=localStorage.getItem(key);
    if(text===null)return null;
    const normalized=C.normalizeEntriesStrict(JSON.parse(text));
    if(!normalized)throw new Error(`Formato inválido en ${key}`);
    return normalized;
  }
  function readEntries(){
    try{const primary=parseStored(KEY);if(primary!==null)return primary;}catch(error){console.warn('Datos principales dañados; se intentará recuperar la copia interna',error)}
    try{const recovered=parseStored(BACKUP_KEY);if(recovered!==null){localStorage.setItem(KEY,JSON.stringify(recovered));return recovered;}}catch(backupError){console.error('No se pudieron recuperar los movimientos',backupError)}
    return [];
  }
  function saveEntries(list){
    try{
      const normalized=C.normalizeEntriesStrict(list);if(!normalized)throw new Error('Lista de movimientos inválida');
      const payload=JSON.stringify(normalized);localStorage.setItem(KEY,payload);
      try{localStorage.setItem(BACKUP_KEY,payload)}catch(error){console.warn('No se pudo actualizar la copia interna',error)}
      return true;
    }catch(error){console.error('No se pudieron guardar los movimientos',error);return false}
  }
  function parseGoalStored(key){
    const text=localStorage.getItem(key);if(text===null)return null;
    const parsed=C.validateGoal(JSON.parse(text));if(!parsed)throw new Error(`Meta inválida en ${key}`);return parsed;
  }
  function migrateLegacyGoal(g){
    if(!g)return g;
    if(g.amount===3000&&g.start==='2026-09-07'&&g.end==='2026-12-06'){
      const migrated={...g,start:'2026-09-01'};
      const payload=JSON.stringify(migrated);
      try{localStorage.setItem(GOAL_KEY,payload);localStorage.setItem(GOAL_BACKUP_KEY,payload)}catch(error){console.warn('No se pudo persistir la migración de la meta',error)}
      return migrated;
    }
    return g;
  }
  function loadGoal(){
    try{const primary=parseGoalStored(GOAL_KEY);if(primary)return migrateLegacyGoal(primary);}catch(error){console.warn('Meta principal dañada; se intentará recuperar la copia interna',error)}
    try{const recovered=parseGoalStored(GOAL_BACKUP_KEY);if(recovered){const migrated=migrateLegacyGoal(recovered);localStorage.setItem(GOAL_KEY,JSON.stringify(migrated));return migrated;}}catch(error){console.error('No se pudo recuperar la meta',error)}
    return {...DEFAULT_GOAL};
  }
  function saveGoal(g){
    const valid=C.validateGoal(g);if(!valid)return false;
    try{
      const payload=JSON.stringify(valid);localStorage.setItem(GOAL_KEY,payload);
      try{localStorage.setItem(GOAL_BACKUP_KEY,payload)}catch(error){console.warn('No se pudo actualizar la copia interna de la meta',error)}
      goal=valid;return true;
    }catch(error){console.error('No se pudo guardar la meta',error);return false}
  }

  let entries=readEntries(),goal=loadGoal(),period='week';

  function ensureHistoryUI(){
    if($('movementHistory'))return;
    const style=document.createElement('style');
    style.textContent=`
      .historyCard{margin-top:14px}.historyTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.historyTop h2{margin:0;font-size:20px}.historyCount{font-size:10px;font-weight:900;color:#7657ff;background:#f1edff;padding:7px 10px;border-radius:999px}.historyEmpty{text-align:center;color:#8b94a8;font-size:12px;padding:18px 4px}.historyList{display:grid;gap:9px}.historyRow{display:grid;grid-template-columns:1.1fr repeat(3,1fr) auto;gap:8px;align-items:center;padding:11px;border:1px solid #e7ebf3;border-radius:15px;background:#fbfcff}.historyRow span{font-size:9px;color:#8a94aa;display:block}.historyRow strong{display:block;font-size:13px;margin-top:3px}.historyActions{display:flex;gap:6px}.historyActions button{border:0;border-radius:10px;padding:8px 9px;font-size:10px;font-weight:900}.historyEdit{background:#eeeaff;color:#684bff}.historyDelete{background:#fff0f2;color:#d72e47}.historyNet.positive{color:#17b878}.historyNet.negative{color:#ef4056}.editOverlay{position:fixed;inset:0;background:rgba(16,26,55,.42);display:none;align-items:flex-end;justify-content:center;z-index:100;padding:12px}.editOverlay.open{display:flex}.editSheet{width:min(520px,100%);background:#fff;border-radius:24px;padding:18px;box-shadow:0 24px 70px rgba(16,26,55,.24)}.editSheet h2{margin:0 0 14px}.editGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.editGrid label{font-size:10px;font-weight:800;color:#5d6780;display:block;margin-bottom:5px}.editGrid input{width:100%;height:48px;border:1px solid #dfe4ef;border-radius:12px;padding:0 11px}.editGrid .full{grid-column:1/-1}.editBtns{display:flex;gap:8px;margin-top:14px}.editBtns button{flex:1;height:48px;border-radius:12px;font-weight:900}.editCancel{background:#fff;border:1px solid #e1e5ef;color:#59637c}.editSave{border:0;background:linear-gradient(100deg,#35c6f4,#4c6fff,#7756ff);color:#fff}@media(max-width:620px){.historyRow{grid-template-columns:1fr 1fr}.historyActions{grid-column:1/-1}.historyActions button{flex:1}.editGrid{grid-template-columns:1fr}.editGrid .full{grid-column:auto}}
    `;
    document.head.appendChild(style);
    const card=document.createElement('section');card.id='movementHistory';card.className='card historyCard';card.innerHTML=`<div class="historyTop"><h2>Movimientos guardados</h2><span id="historyCount" class="historyCount">0</span></div><div id="historyList" class="historyList"></div>`;
    const totals=$('allNet')?.closest('.card');if(totals)totals.insertAdjacentElement('afterend',card);else $('investView')?.appendChild(card);
    const overlay=document.createElement('div');overlay.id='editOverlay';overlay.className='editOverlay';overlay.innerHTML=`<div class="editSheet" role="dialog" aria-modal="true" aria-labelledby="editTitle"><h2 id="editTitle">Editar movimiento</h2><div class="editGrid"><div class="full"><label for="editDate">Fecha</label><input id="editDate" type="date"></div><div><label for="editStake">Apostado (€)</label><input id="editStake" type="number" min="0" step="0.01" inputmode="decimal"></div><div><label for="editReturned">Ganado / Cobrado (€)</label><input id="editReturned" type="number" min="0" step="0.01" inputmode="decimal"></div></div><div class="editBtns"><button id="editCancel" class="editCancel" type="button">Cancelar</button><button id="editSave" class="editSave" type="button">Guardar cambios</button></div></div>`;document.body.appendChild(overlay);
    $('editCancel').onclick=closeEditor;$('editOverlay').addEventListener('click',e=>{if(e.target===$('editOverlay'))closeEditor()});$('editSave').onclick=saveEditedMovement;
    $('historyList').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.dataset.id;if(b.dataset.action==='edit')openEditor(id);if(b.dataset.action==='delete')deleteMovement(id)});
  }
  function renderHistory(){
    ensureHistoryUI();
    const ordered=[...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);$('historyCount').textContent=`${ordered.length} ${ordered.length===1?'movimiento':'movimientos'}`;
    if(!ordered.length){$('historyList').innerHTML='<div class="historyEmpty">Todavía no hay movimientos guardados.</div>';return;}
    $('historyList').innerHTML=ordered.map(e=>{const n=C.net(e),cls=n<0?'negative':n>0?'positive':'';return `<article class="historyRow"><div><span>Fecha</span><strong>${full(D(e.date))}</strong></div><div><span>Apostado</span><strong>${euro(e.stake)}</strong></div><div><span>Cobrado</span><strong>${euro(e.returned)}</strong></div><div><span>Resultado</span><strong class="historyNet ${cls}">${n>0?'+':''}${euro(n)}</strong></div><div class="historyActions"><button class="historyEdit" data-action="edit" data-id="${e.id}" type="button">Editar</button><button class="historyDelete" data-action="delete" data-id="${e.id}" type="button">Eliminar</button></div></article>`}).join('');
  }
  function openEditor(id){
    const e=entries.find(x=>x.id===id);if(!e)return;editingId=id;$('editDate').value=e.date;$('editDate').max=iso();$('editStake').value=e.stake;$('editReturned').value=e.returned;$('editOverlay').classList.add('open');setTimeout(()=>$('editStake').focus(),30);
  }
  function closeEditor(){editingId=null;$('editOverlay')?.classList.remove('open');}
  function saveEditedMovement(){
    if(!editingId)return;const old=entries.find(x=>x.id===editingId);if(!old)return closeEditor();
    const date=$('editDate').value,stake=Number($('editStake').value),returned=Number($('editReturned').value);
    if(!C.validDate(date)||date>iso()||!Number.isFinite(stake)||!Number.isFinite(returned)||!(stake>0)||returned<0){alert('Revisa la fecha y las cantidades.');return;}
    const updated=C.normalizeEntry({...old,date,stake,returned},0);if(!updated)return;
    const next=entries.map(x=>x.id===editingId?updated:x);if(!saveEntries(next)){alert('No se ha podido guardar el cambio.');return;}
    entries=next;closeEditor();renderInvest();renderGoal();
  }
  function deleteMovement(id){
    const e=entries.find(x=>x.id===id);if(!e)return;const n=C.net(e);if(!confirm(`¿Eliminar el movimiento del ${full(D(e.date))} (${n>0?'+':''}${euro(n)})?`))return;
    const next=entries.filter(x=>x.id!==id);if(!saveEntries(next)){alert('No se ha podido eliminar el movimiento.');return;}entries=next;renderInvest();renderGoal();
  }

  function setView(nextGoalMode){
    goalMode=Boolean(nextGoalMode);
    $('investView').classList.toggle('active',!goalMode);$('goalView').classList.toggle('active',goalMode);
    $('tabInvest').classList.toggle('active',!goalMode);$('tabGoal').classList.toggle('active',goalMode);
    $('tabInvest').setAttribute('aria-selected',String(!goalMode));$('tabGoal').setAttribute('aria-selected',String(goalMode));
    $('tabInvest').tabIndex=goalMode?-1:0;$('tabGoal').tabIndex=goalMode?0:-1;
    if(goalMode)renderGoal();else renderInvest();window.scrollTo({top:0,behavior:'smooth'});
  }

  function current(){
    const today=iso(),now=D(today);
    return entries.filter(e=>{
      const d=D(e.date);if(!d)return false;if(period==='all')return true;if(period==='today')return e.date===today;
      if(period==='month')return d.getUTCFullYear()===now.getUTCFullYear()&&d.getUTCMonth()===now.getUTCMonth();
      const start=new Date(now);start.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));const end=new Date(start);end.setUTCDate(start.getUTCDate()+7);return d>=start&&d<end;
    }).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);
  }
  function setPeriod(next){period=next;document.querySelectorAll('#periods button').forEach(x=>x.classList.toggle('active',x.dataset.period===period));renderInvest();}

  function renderInvest(){
    const a=current(),s=C.summary(a),all=C.summary(entries);
    $('staked').textContent=euro(s.st);$('returned').textContent=euro(s.rt);$('loss').textContent=euro(s.loss);$('net').textContent=(s.n>0?'+':'')+euro(s.n);
    $('movesMeta').textContent=`${a.length} movimientos`;$('winsMeta').textContent=`${s.wins} aciertos`;$('lossesMeta').textContent=`${s.losses} fallos`;$('roiMeta').textContent=s.st?pct(s.n/s.st*100):'0,0%';
    $('chartTotal').textContent=(s.n>0?'+':'')+euro(s.n);$('statMoves').textContent=a.length;const resolved=s.wins+s.losses;$('statHit').textContent=resolved?pct(s.wins/resolved*100):'0%';
    const activeDays=new Set(a.map(e=>e.date)).size;$('statAvg').textContent=activeDays?euro(s.n/activeDays):euro(0);$('periodLabel').textContent={today:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo'}[period];
    $('allStaked').textContent=euro(all.st);$('allReturned').textContent=euro(all.rt);$('allLoss').textContent=euro(all.loss);$('allNet').textContent=(all.n>0?'+':'')+euro(all.n);
    $('net').className=s.n<0?'negative':s.n>0?'positive':'';$('allNet').className=all.n<0?'negative':all.n>0?'positive':'';
    $('chart').setAttribute('aria-label',`Evolución ${$('periodLabel').textContent}: ${a.length} movimientos, resultado ${(s.n>0?'+':'')+euro(s.n)}`);drawChart(a);renderHistory();
  }

  function drawChart(a){
    const c=$('chart'),ctx=c?.getContext?.('2d');if(!c||!ctx)return;const r=c.getBoundingClientRect();if(!r.width)return;
    const dpr=Math.min(window.devicePixelRatio||1,3),w=r.width,h=210,p=28;c.width=Math.max(1,Math.round(w*dpr));c.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(69,112,180,.16)';ctx.lineWidth=1;for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}
    let cum=0;const pts=a.map(e=>cum=C.money(cum+C.net(e)));if(!pts.length)pts.push(0);const min=Math.min(0,...pts),max=Math.max(0,...pts),span=Math.max(1,max-min),step=(w-p*2)/Math.max(1,pts.length-1);
    const coords=pts.map((v,i)=>({x:pts.length===1?w/2:p+i*step,y:h-p-(v-min)/span*(h-p*2)}));ctx.strokeStyle=cum<0?'#ef4056':cum>0?'#17b878':'#7558ff';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;
    if(coords.length>1){ctx.beginPath();coords.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke()}const q=coords[coords.length-1];ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();
  }

  function goalDays(){const a=D(goal.start),b=D(goal.end);return Math.floor((b-a)/86400000)+1;}
  function renderGoal(){
    const list=entries.filter(e=>e.date>=goal.start&&e.date<=goal.end).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt),s=C.summary(list),total=goalDays();
    const g=C.goalClock(iso(),goal.start,goal.end,total),remain=Math.max(0,C.money(goal.amount-s.n)),progress=Math.max(0,Math.min(100,s.n/goal.amount*100));
    $('tabGoal').textContent=`Meta ${euro(goal.amount)}`;$('goalValue').textContent=euro(goal.amount);$('goalRange').textContent=`Del ${full(D(goal.start))} al ${full(D(goal.end))}`;$('goalBar').style.width=progress+'%';
    $('goalProgress').textContent=progress.toFixed(1).replace('.',',')+'% completado';$('goalRemaining').textContent=s.n>=goal.amount?'Meta alcanzada':'Faltan '+euro(remain);$('goalNet').textContent=(s.n>0?'+':'')+euro(s.n);$('goalReturned').textContent=euro(s.rt);$('goalStaked').textContent=euro(s.st);$('goalNet').className=s.n<0?'negative':s.n>0?'positive':'';
    $('daysLeft').textContent=g.left;$('dateInfo').innerHTML=`Hoy: ${full(g.today)}<br>Meta: ${full(g.end)}`;const daily=C.goalDaily(s.n,goal.amount,g.left);$('goalDaily').textContent=s.n>=goal.amount?'0,00 €/día':g.left?`${euro(daily)}/día`:'Plazo finalizado';$('goalDailySub').textContent=s.n>=goal.amount?'Objetivo conseguido.':g.left?`Faltan ${euro(remain)} en ${g.left} días.`:`Faltan ${euro(remain)}.`;$('daysPassed').textContent=`Día ${g.elapsed} de ${total}`;
    const byDay=new Map();
    for(const e of list){
      const bucket=byDay.get(e.date)||{stake:0,returned:0};
      bucket.stake=C.money(bucket.stake+e.stake);bucket.returned=C.money(bucket.returned+e.returned);byDay.set(e.date,bucket);
    }
    let html='';
    for(let i=0;i<total;i++){
      const d=new Date(g.start);d.setUTCDate(g.start.getUTCDate()+i);const di=d.toISOString().slice(0,10),day=byDay.get(di),hasActivity=Boolean(day),sum=hasActivity?C.money(day.returned-day.stake):0;const state=hasActivity?(sum<0?'loss':sum>0?'win':'neutral'):'empty';const status=state==='loss'?'pérdida':state==='win'?'ganancia':state==='neutral'?'resultado neutro':'sin movimientos';const style=state==='loss'?'background:#ef4056;border-color:#ef4056;color:#fff':state==='win'?'background:#17b878;border-color:#17b878;color:#fff':'background:#fff;border-color:#e1e6f0;color:#101a37';const result=hasActivity?`<small style="color:${state==='loss'||state==='win'?'#fff':'#7c879f'};font-weight:900">${sum>0?'+':''}${euro(sum)}</small>`:'';const aria=`Día ${i+1}, ${short(d)}, ${status}${hasActivity?`, ${sum>0?'+':''}${euro(sum)}`:''}`;html+=`<div class="day ${di===iso()?'today':''}" data-state="${state}" data-date="${di}" role="listitem" aria-label="${aria}" title="${aria}" style="${style}"><b>${i+1}</b><small style="color:${state==='loss'||state==='win'?'rgba(255,255,255,.85)':'#8b94a8'}">${short(d)}</small>${result}</div>`;
    }
    $('calendar').setAttribute('role','list');$('calendar').innerHTML=html;
  }

  function syncFromStorage(){
    entries=readEntries();goal=loadGoal();renderInvest();renderGoal();
  }

  $('tabInvest').onclick=()=>setView(false);$('tabGoal').onclick=()=>setView(true);$('navHome').onclick=()=>setView(false);
  const tabs=[$('tabInvest'),$('tabGoal')];tabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let next=index;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;setView(next===1);tabs[next].focus();}));
  document.querySelectorAll('#periods button').forEach(b=>b.onclick=()=>setPeriod(b.dataset.period));
  $('save').onclick=()=>{
    if(saving)return;const stake=Number($('stake').value),returned=Number($('returnedInput').value),date=$('date').value;
    if(!C.validDate(date)||date>iso()||!Number.isFinite(stake)||!Number.isFinite(returned)||!(stake>0)||returned<0){alert('Revisa la fecha y las cantidades antes de guardar.');return}
    let id=globalThis.crypto?.randomUUID?.()||`m-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;while(entries.some(x=>x.id===id))id=`m-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
    const e=C.normalizeEntry({id,date,stake,returned,createdAt:Date.now()},entries.length);if(!e)return;saving=true;$('save').disabled=true;$('save').style.opacity='.65';const next=[...entries,e];
    if(saveEntries(next)){
      entries=next;$('stake').value='';$('returnedInput').value='';updatePreview();
      if(!current().some(x=>x.id===e.id)){
        const d=D(date),now=D(iso());period=d&&now&&d.getUTCFullYear()===now.getUTCFullYear()&&d.getUTCMonth()===now.getUTCMonth()?'month':'all';
        document.querySelectorAll('#periods button').forEach(x=>x.classList.toggle('active',x.dataset.period===period));
      }
      renderInvest();renderGoal();
    }else alert('No se ha podido guardar el movimiento. Tus datos anteriores siguen intactos.');
    setTimeout(()=>{saving=false;$('save').disabled=false;$('save').style.opacity=''},350);
  };
  function updatePreview(){const stake=Number($('stake').value||0),returned=Number($('returnedInput').value||0),n=C.money(returned-stake);$('preview').textContent=(n>0?'+':'')+euro(n);$('preview').className=n<0?'negative':n>0?'positive':'';}
  $('stake').oninput=updatePreview;$('returnedInput').oninput=updatePreview;
  $('goalEditBtn').onclick=()=>{$('goalEditor').classList.toggle('open');$('goalAmountInput').value=goal.amount;$('goalStartInput').value=goal.start;$('goalEndInput').value=goal.end;};$('goalCancel').onclick=()=>$('goalEditor').classList.remove('open');
  $('goalSave').onclick=()=>{const proposed={amount:Number($('goalAmountInput').value),start:$('goalStartInput').value,end:$('goalEndInput').value};if(!C.validateGoal(proposed)){alert('Revisa el importe y las fechas de la meta.');return}if(!saveGoal(proposed)){alert('No se ha podido guardar la meta.');return}$('goalEditor').classList.remove('open');renderGoal();};

  for(const [id,label] of [['stake','Cantidad apostada en euros'],['returnedInput','Cantidad ganada o cobrada en euros'],['goalAmountInput','Objetivo de la meta en euros'],['goalStartInput','Fecha de inicio de la meta'],['goalEndInput','Fecha final de la meta']])$(id)?.setAttribute('aria-label',label);
  const today=iso();$('date').value=today;$('date').max=today;$('dateDisplay').textContent=full(D(today));$('date').onchange=()=>{$('dateDisplay').textContent=full(D($('date').value))};
  window.addEventListener('resize',()=>{if(resizeRaf)cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;drawChart(current())})});
  window.addEventListener('storage',event=>{if([KEY,BACKUP_KEY,GOAL_KEY,GOAL_BACKUP_KEY].includes(event.key))syncFromStorage();});
  window.addEventListener('focus',syncFromStorage);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncFromStorage();});
  if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});ensureHistoryUI();renderInvest();renderGoal();
})();