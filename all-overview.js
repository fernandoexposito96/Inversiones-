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
      return raw
        .filter(e=>e&&typeof e.date==='string'&&Number.isFinite(Number(e.stake))&&Number.isFinite(Number(e.returned)))
        .map(e=>({...e,stake:Number(e.stake),returned:Number(e.returned)}));
    }catch{return []}
  }

  function ensureUI(){
    if($('allOverview'))return;
    const style=document.createElement('style');
    style.textContent=`
      #allOverview{display:none;margin:-2px 0 14px;background:#fff;border:1px solid #e3e8f2;border-radius:22px;box-shadow:0 14px 34px rgba(36,52,91,.08);padding:14px;overflow:hidden}
      #allOverview.visible{display:block}
      .allOverviewHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:0 2px}
      .allOverviewTitle{display:flex;align-items:center;gap:9px;min-width:0}
      .allOverviewTitleIcon{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#e9e4ff,#f7f4ff);color:#684bff;font-weight:950}
      .allOverviewTitle h3{margin:0;font-size:16px;letter-spacing:-.02em}
      .allOverviewOps{font-size:10px;color:#6f7891;font-weight:800;white-space:nowrap}
      .allOverviewGrid{display:grid;grid-template-columns:minmax(0,1fr) 1px minmax(0,1fr);gap:12px;align-items:stretch}
      .allOverviewDivider{background:#edf0f5;border-radius:999px}
      .allOverviewSide{min-width:0;display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:center}
      .allOverviewRing{--p:0;--ring:#17b878;width:96px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--ring) calc(var(--p)*1%),#edf1f7 0);position:relative;box-shadow:0 8px 20px rgba(36,52,91,.06)}
      .allOverviewRing:after{content:"";position:absolute;inset:10px;background:#fff;border-radius:50%;box-shadow:inset 0 0 0 1px #eef1f6}
      .allOverviewRingInner{position:relative;z-index:1;text-align:center;line-height:1.02;min-width:0;padding:0 4px}
      .allOverviewRingInner strong{display:block;font-size:23px;letter-spacing:-.045em;color:#101a37;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .allOverviewRingInner span{display:block;margin-top:5px;font-size:8px;color:#7c879f;font-weight:850}
      .allOverviewText{min-width:0}
      .allOverviewText h4{margin:0 0 3px;font-size:14px;letter-spacing:-.02em;white-space:nowrap}
      .allOverviewText>span{font-size:9px;color:#7c879f;display:block}
      .allOverviewMini{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}
      .allOverviewMini div{min-width:0;border-radius:10px;padding:7px 5px;text-align:center;background:#f8faff;border:1px solid #eef1f6}
      .allOverviewMini span{display:block;font-size:7.5px;color:#7c879f;white-space:nowrap}
      .allOverviewMini strong{display:block;margin-top:3px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .allOverviewMini .good{background:#effbf6;border-color:#d9f4e8;color:#129e68}
      .allOverviewMini .bad{background:#fff2f4;border-color:#ffe0e5;color:#e83c52}
      .allOverviewBalance.loss .allOverviewRing{--ring:#ef4056}.allOverviewBalance.win .allOverviewRing{--ring:#17b878}.allOverviewBalance.neutral .allOverviewRing{--ring:#7756ff}
      .allOverviewBalance.loss .allOverviewRingInner strong{color:#ef4056}.allOverviewBalance.win .allOverviewRingInner strong{color:#17b878}.allOverviewBalance.neutral .allOverviewRingInner strong{color:#7756ff}
      .allOverviewState{display:inline-flex!important;width:max-content;max-width:100%;margin-top:5px;padding:4px 7px;border-radius:999px;font-size:8px!important;font-weight:900!important;background:#f3f0ff;color:#684bff!important;white-space:nowrap}
      .allOverviewBalance.loss .allOverviewState{background:#fff0f2;color:#e83c52!important}.allOverviewBalance.win .allOverviewState{background:#ecfbf4;color:#129e68!important}
      @media(max-width:560px){
        #allOverview{padding:12px}
        .allOverviewHeader{margin-bottom:10px}
        .allOverviewGrid{gap:8px}
        .allOverviewSide{grid-template-columns:78px minmax(0,1fr);gap:7px}
        .allOverviewRing{width:78px}.allOverviewRing:after{inset:8px}.allOverviewRingInner strong{font-size:19px}.allOverviewRingInner span{font-size:7.5px}
        .allOverviewText h4{font-size:12px}.allOverviewText>span{font-size:8px}.allOverviewMini{gap:4px;margin-top:7px}.allOverviewMini div{padding:6px 3px}.allOverviewMini strong{font-size:10px}.allOverviewMini span{font-size:7px}
      }
      @media(max-width:390px){
        #allOverview{padding:11px 10px}
        .allOverviewTitle h3{font-size:15px}.allOverviewOps{font-size:9px}
        .allOverviewGrid{grid-template-columns:minmax(0,1fr) 1px minmax(0,1fr);gap:6px}
        .allOverviewSide{grid-template-columns:70px minmax(0,1fr);gap:5px}
        .allOverviewRing{width:70px}.allOverviewRingInner strong{font-size:17px}
        .allOverviewText h4{font-size:11px}.allOverviewText>span{font-size:7px}.allOverviewState{font-size:7px!important;padding:3px 5px}
        .allOverviewMini strong{font-size:9px}.allOverviewMini span{font-size:6.5px}
      }
      @media(max-width:345px){
        .allOverviewGrid{grid-template-columns:1fr;gap:10px}.allOverviewDivider{height:1px;width:100%}.allOverviewSide{grid-template-columns:82px 1fr}.allOverviewRing{width:82px}
      }
    `;
    document.head.appendChild(style);

    const section=document.createElement('section');
    section.id='allOverview';
    section.setAttribute('aria-label','Resumen total de aciertos y balance');
    section.innerHTML=`
      <div class="allOverviewHeader">
        <div class="allOverviewTitle"><div class="allOverviewTitleIcon" aria-hidden="true">▥</div><h3>Resumen total</h3></div>
        <span id="allOverviewOps" class="allOverviewOps">0 operaciones</span>
      </div>
      <div class="allOverviewGrid">
        <div class="allOverviewSide">
          <div id="hitRing" class="allOverviewRing"><div class="allOverviewRingInner"><strong id="hitPct">0%</strong><span id="hitCount">0 de 0</span></div></div>
          <div class="allOverviewText"><h4>Aciertos</h4><span>Tus resultados</span><div class="allOverviewMini"><div class="good"><span>Aciertos</span><strong id="hitWins">0</strong></div><div class="bad"><span>Fallos</span><strong id="hitLosses">0</strong></div></div></div>
        </div>
        <div class="allOverviewDivider" aria-hidden="true"></div>
        <div id="balanceSide" class="allOverviewSide allOverviewBalance neutral">
          <div id="balanceRing" class="allOverviewRing"><div class="allOverviewRingInner"><strong id="balancePct">0%</strong><span>Balance neto</span></div></div>
          <div class="allOverviewText"><h4>Balance neto</h4><span id="balanceSubtitle">Sin cambios</span><span id="balanceState" class="allOverviewState">Neutro</span><div class="allOverviewMini"><div class="good"><span>Ganado</span><strong id="balanceWon">0,00 €</strong></div><div class="bad"><span>Perdido</span><strong id="balanceLost">0,00 €</strong></div></div><span id="balanceAmount" style="display:block;margin-top:6px;font-weight:900;font-size:12px;color:#101a37"></span></div>
        </div>
      </div>`;
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

    $('allOverviewOps').textContent=`${entries.length} ${entries.length===1?'operación':'operaciones'}`;
    $('hitRing').style.setProperty('--p',String(Math.max(0,Math.min(100,hit))));
    $('hitPct').textContent=pct(hit);
    $('hitCount').textContent=`${wins} de ${resolved}`;
    $('hitWins').textContent=wins;
    $('hitLosses').textContent=losses;

    const balance=$('balanceSide');
    balance.classList.remove('win','loss','neutral');balance.classList.add(state);
    $('balanceRing').style.setProperty('--p',String(balanceFill));
    $('balancePct').textContent=(roi>0?'+':'')+pct(roi);
    $('balanceAmount').textContent=(net>0?'+':'')+euro(net);
    $('balanceAmount').className=state==='win'?'positive':state==='loss'?'negative':'';
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
