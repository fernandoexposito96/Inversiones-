(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.InversionesCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const MAX_ENTRY_CENTS=100000000000;
  const MAX_ID_LENGTH=128;

  function toCents(v){
    const n=Number(v);
    if(!Number.isFinite(n))return NaN;
    const cents=Math.round((n+Number.EPSILON)*100);
    return Number.isSafeInteger(cents)?cents:NaN;
  }
  const fromCents=c=>c/100;
  const money=v=>{const cents=toCents(v);return Number.isFinite(cents)?fromCents(cents):NaN;};
  const safeAdd=(a,b)=>{const value=a+b;if(!Number.isSafeInteger(value))throw new RangeError('Importe acumulado fuera de rango seguro');return value;};

  function validDate(value){
    if(typeof value!=='string'||!DATE_RE.test(value))return false;
    const [y,m,d]=value.split('-').map(Number);
    const dt=new Date(Date.UTC(y,m-1,d,12));
    return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
  }
  function dateObj(value){
    if(!validDate(value))return null;
    const [y,m,d]=value.split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d,12));
  }
  function normalizeId(raw,index){
    const fallback=`legacy-${index}`;
    const value=raw===undefined||raw===null||raw===''?fallback:String(raw).trim();
    if(!value||value.length>MAX_ID_LENGTH)return null;
    return value;
  }
  function normalizeEntry(entry,index=0){
    if(!entry||!validDate(entry.date))return null;
    const stake=Number(entry.stake),returned=Number(entry.returned);
    const stakeCents=toCents(stake),returnedCents=toCents(returned);
    if(!Number.isFinite(stake)||!Number.isFinite(returned)||!Number.isSafeInteger(stakeCents)||!Number.isSafeInteger(returnedCents)||stakeCents<=0||returnedCents<0||stakeCents>MAX_ENTRY_CENTS||returnedCents>MAX_ENTRY_CENTS)return null;
    const id=normalizeId(entry.id,index);if(!id)return null;
    const createdAtRaw=Number(entry.createdAt);
    const createdAt=Number.isSafeInteger(createdAtRaw)&&createdAtRaw>=0?createdAtRaw:0;
    return {id,date:entry.date,stake:fromCents(stakeCents),returned:fromCents(returnedCents),createdAt};
  }
  function normalizeEntriesStrict(raw){
    if(!Array.isArray(raw))return null;
    const out=[],ids=new Set();
    for(let i=0;i<raw.length;i++){
      const entry=normalizeEntry(raw[i],i);
      if(!entry||ids.has(entry.id))return null;
      ids.add(entry.id);out.push(entry);
    }
    return out;
  }
  function validateGoal(raw){
    if(!raw||!validDate(raw.start)||!validDate(raw.end)||raw.end<raw.start)return null;
    const amountCents=toCents(raw.amount);
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>MAX_ENTRY_CENTS)return null;
    return {amount:fromCents(amountCents),start:raw.start,end:raw.end};
  }
  function net(entry){
    const normalized=normalizeEntry(entry,0);
    if(!normalized)return NaN;
    return fromCents(toCents(normalized.returned)-toCents(normalized.stake));
  }
  function summary(items){
    if(!Array.isArray(items))throw new TypeError('La lista de movimientos debe ser un array');
    let st=0,rt=0,loss=0,wins=0,losses=0;
    for(let i=0;i<items.length;i++){
      const e=normalizeEntry(items[i],i);if(!e)throw new TypeError('Movimiento inválido en el resumen');
      const s=toCents(e.stake),r=toCents(e.returned),n=r-s;
      st=safeAdd(st,s);rt=safeAdd(rt,r);
      if(n>0)wins++;
      if(n<0){losses++;loss=safeAdd(loss,-n);}
    }
    return {st:fromCents(st),rt:fromCents(rt),loss:fromCents(loss),n:fromCents(rt-st),wins,losses};
  }
  function dayNumber(d){return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())/86400000;}
  function diffDays(a,b){return Math.round(dayNumber(b)-dayNumber(a));}
  function goalClock(todayIso,startIso,endIso,total){
    const start=dateObj(startIso),end=dateObj(endIso),today=dateObj(todayIso);
    if(!start||!end||!today||!Number.isSafeInteger(total)||total<=0)throw new Error('Fecha de meta inválida');
    const elapsed=Math.max(0,Math.min(total,diffDays(start,today)));
    const left=today<start?total:today>=end?0:Math.max(0,total-elapsed);
    return {start,end,today,elapsed,left};
  }
  function goalDaily(netValue,goal,daysLeft){
    const netCents=toCents(netValue),goalCents=toCents(goal);
    if(!Number.isSafeInteger(netCents)||!Number.isSafeInteger(goalCents)||goalCents<=0||!Number.isSafeInteger(daysLeft))throw new Error('Datos de meta inválidos');
    const remainCents=Math.max(0,goalCents-netCents);
    if(remainCents===0)return 0;
    if(daysLeft<=0)return fromCents(remainCents);
    return fromCents(Math.round(remainCents/daysLeft));
  }
  function fingerprintEntries(items){
    const normalized=normalizeEntriesStrict(items);if(!normalized)return null;
    let hash=2166136261;
    const text=JSON.stringify(normalized);
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function sameEntries(a,b){
    const fa=fingerprintEntries(a),fb=fingerprintEntries(b);
    return fa!==null&&fb!==null&&fa===fb;
  }
  return {MAX_ENTRY_CENTS,toCents,fromCents,money,validDate,dateObj,normalizeEntry,normalizeEntriesStrict,validateGoal,net,summary,diffDays,goalClock,goalDaily,fingerprintEntries,sameEntries};
});
