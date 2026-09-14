'use strict';
(function(){
  const KEY='mi-control.entries.v1';
  const $=id=>document.getElementById(id);
  const euro=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const pct=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(Number(v||0))+'%';

  function readEntries(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'[]');
      if(!Array.isArray(raw))return [];
      return raw.filter(e=>e&&typeof e.date==='string'&&Number.isFinite(Number(e.stake))&&Number.isFinite(Number(e.returned))).map(e=>({...e,stake:Number(e.stake),returned:Number(e.returned)}));
    }catch{return []}
  }

  function ensureUI(){
    if($('allOverview'))return;
    const style=document.createElement('style');
    style.textContent=`
      #allOverview{display:none;margin:-2px 0 14px;background:#fff;border:1px solid #e3e8f2;border-radius:22px;box-shadow:0 14px 34px rgba(36,52,91,.08);padding:14px}
      #allOverview.visible{display:block}
      .allOverviewGrid{display:grid;grid-template-columns:1fr 1px 1fr;gap:12px;align-items:stretch}
      .allOverviewDivider{background:#edf0f5;border-radius:999px}
      .allOverviewSide{display:grid;grid-template-columns:104px 1fr;gap:12px;align-items:center;min-width:0}
      .allOverviewRing{--p:0;--ring:#17b878;width:104px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--ring) calc(var(--p)*1%),#edf1f7 0);position:relative;box-shadow:0 8px 20px rgba(36,52,91,.07)}
      .allOverviewRing:after{content:"";position:absolute;inset:11px;background:#fff;border-radius:50%;box-shadow:inset 0 0 0 1px #eef1f6}
      .allOverviewRingInner{position:relative;z-index:1;text-align:center;line-height:1.08}
      .allOverviewRingInner strong{display:block;font-size:25px;letter-spacing:-.04em;color:#101a37}
      .allOverviewRingInner span{display:block;margin-top:5px;font-size:9px;color:#7c879f;font-weight:800}
      .allOverviewText h3{margin:0 0 4px;font-size:15px;letter-spacing:-.02em}
      .allOverviewText>span{font-size:9px;color:#7c879f}
      .allOverviewMini{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
      .allOverviewMini div{border-radius:11px;padding:8px 6px;text-align:center;background:#f8faff;border:1px solid #eef1f6}
      .allOverviewMini span{display:block;font-size:8px;color:#7c879f}
      .allOverviewMini strong{display:block;margin-top:3px;font-size:13px}
      .allOverviewMini .good{background:#effbf6;border-color:#d9f4e8;color:#129e68}
      .allOverviewMini .bad{background:#fff2f4;border-color:#ffe0e5;color:#e83c52}
      .allOverviewBalance.loss .allOverviewRing{--ring:#ef4056}.allOverviewBalance.win .allOverviewRing{--ring:#17b878}.allOverviewBalance.neutral .allOverviewRing{--ring:#7756ff}
      .allOverviewBalance.loss .allOverviewRingInner strong{color:#ef4056}.allOverviewBalance.win .allOverviewRingInner strong{color:#17b878}.allOverviewBalance.neutral .allOverviewRingInner strong{color:#7756ff}
      .allOverviewState{display:inline-flex!important;margin-top:5px;padding:4px 7px;border-radius:999px;font-size:8px!important;font-weight:900!important;background:#f3f0ff;color:#684bff!important}
      .allOverviewBalance.loss .allOverviewState{background:#fff0f2;color:#e83c52!important}.allOverviewBalance.win .allOverviewState{background:#ecfbf4;color:#129e68!important}
      @media(max-width:560px){#allOverview{padding:12px}.allOverviewGrid{gap:9px}.allOverviewSide{grid-template-columns:82px 1fr;gap:8px}.allOverviewRing{width:82px}.allOverviewRing:after{inset:9px}.allOverviewRingInner strong{font-size:20px}.allOverviewText h3{font-size:13px}.allOverviewMini{gap:5px}.allOverviewMini div{padding:6px 4px}.allOverviewMini strong{font-size:11px}}
      @media(max-width:390px){.allOverviewSide{grid-template-columns:72px 1fr}.allOverviewRing{width:72px}.allOverviewRingInner strong{font-size:18px}.allOverviewText h3{font-size:12px}.allOverviewText>span{font-size:8px}}
    `;
    document.head.appendChild(style);
    const section=document.createElement('section');
    section.id='allOverview';
    section.setAttribute('aria-label','Resumen completo de aciertos y balance');
    section.innerHTML=`<div class="allOverviewGrid"><div class="allOverviewSide"><div id="hitRing" class="allOverviewRing"><div class="allOverviewRingInner"><strong id="hitPct">0%</strong><span id="hitCount">0 de 0</span></div></div><div class="allOverviewText"><h3>Aciertos</h3><span>Tus resultados</span><div class="allOverviewMini"><div class="good"><span>Aciertos</span><strong id="hitWins">0</strong></div><div class="bad"><span>Fallos</span><strong id="hitLosses">0</strong></div></div></div></div><div class="allOverviewDivider" aria-hidden="true"></div><div id="balanceSide" class="allOverviewSide allOverviewBalance neutral"><div id="balanceRing" class="allOverviewRing"><div class="allOverviewRingInner"><strong id="balanceAmount">0,00 €</strong><span id="balancePct">0%</span></div></div><div class="allOverviewText"><h3>Balance neto</h3><span id="balanceSubtitle">Sin cambios</span><span id="balanceState" class="allOverviewState">Neutro</span><div class="allOverviewMini"><div class="good"><span>Ganado</span><strong id="balanceWon">0,00 €</strong></div><div class="bad"><span>Perdido</span><strong id="balanceLost">0,00 €</strong></div></div></div></div></div>`;
    const periods=$('periods');
    if(periods)periods.insertAdjacentElement('afterend',section);
  }

  function render(){
    ensureUI();
    const box=$('allOverview');
    if(!box)return;
    const allActive=document.querySelector('#periods button[data-period="all"]')?.classList.contains('active');
    box.classList.toggle('visible',Boolean(allActive));
    if(!allActive)return;

    const entries=readEntries();
    let wins=0,losses=0,staked=0,returned=0;
    for(const e of entries){
      const net=e.returned-e.stake;
      staked+=e.stake;returned+=e.returned;
      if(net>0)wins++;else if(net<0)losses++;
    }
    const resolved=wins+losses;
    const hit=resolved?wins/resolved*100:0;
    const net=returned-staked;
    const lost=entries.reduce((sum,e)=>sum+Math.max(0,e.stake-e.returned),0);
    const roi=staked?net/staked*100:0;
    const balanceFill=Math.min(100,Math.abs(roi));
    const state=net>0?'win':net<0?'loss':'neutral';

    $('hitRing').style.setProperty('--p',String(Math.max(0,Math.min(100,hit))));
    $('hitPct').textContent=pct(hit);
    $('hitCount').textContent=`${wins} de ${resolved}`;
    $('hitWins').textContent=wins;
    $('hitLosses').textContent=losses;

    const balance=$('balanceSide');
    balance.classList.remove('win','loss','neutral');balance.classList.add(state);
    $('balanceRing').style.setProperty('--p',String(balanceFill));
    $('balanceAmount').textContent=(net>0?'+':'')+euro(net);
    $('balancePct').textContent=(roi>0?'+':'')+pct(roi);
    $('balanceWon').textContent=euro(returned);
    $('balanceLost').textContent=euro(lost);
    $('balanceSubtitle').textContent=state==='win'?'Ganancia neta':state==='loss'?'Pérdida neta':'Sin cambios';
    $('balanceState').textContent=state==='win'?'Ganando':state==='loss'?'Perdiendo':'Neutro';
  }

  function schedule(){requestAnimationFrame(()=>requestAnimationFrame(render));}
  document.addEventListener('click',e=>{if(e.target.closest('#periods button'))schedule()});
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key===KEY+'.shadow')schedule()});
  window.addEventListener('focus',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
