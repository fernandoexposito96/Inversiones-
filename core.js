(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.InversionesCore=api;
  if(root&&root.localStorage&&root.Storage&&typeof api.installStorageGuard==='function'){
    try{api.installStorageGuard(root)}catch(error){console.warn('No se pudo activar el blindaje de almacenamiento',error)}
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const MAX_ENTRY_CENTS=100000000000;
  const MAX_ID_LENGTH=128;
  const ENTRY_KEY='mi-control.entries.v1';
  const GOAL_KEY='mi-control.goal.v1';
  const GUARD_VERSION=2;
  const BACKUP_DEPTH=3;

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
  function fingerprintText(text){
    if(typeof text!=='string')return null;
    let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function fingerprintEntries(items){
    const normalized=normalizeEntriesStrict(items);if(!normalized)return null;
    return fingerprintText(JSON.stringify(normalized));
  }
  function sameEntries(a,b){
    const fa=fingerprintEntries(a),fb=fingerprintEntries(b);
    return fa!==null&&fb!==null&&fa===fb;
  }
  function validateStoredPayload(key,text){
    if(typeof text!=='string')return false;
    try{
      const parsed=JSON.parse(text);
      if(key===ENTRY_KEY)return normalizeEntriesStrict(parsed)!==null;
      if(key===GOAL_KEY)return validateGoal(parsed)!==null;
      return true;
    }catch{return false;}
  }
  function installStorageGuard(root){
    const proto=root?.Storage?.prototype,storage=root?.localStorage;
    if(!proto||!storage||proto.__inversionesGuardV2)return false;
    const originalGet=proto.getItem,originalSet=proto.setItem,originalRemove=proto.removeItem;
    if(typeof originalGet!=='function'||typeof originalSet!=='function')return false;
    const watched=new Set([ENTRY_KEY,GOAL_KEY]),lastSeen=new Map();
    const rawGet=(self,key)=>originalGet.call(self,key);
    const rawSet=(self,key,value)=>originalSet.call(self,key,value);
    const metaKey=key=>`${key}.guard.meta`;
    const backupKey=(key,n)=>`${key}.guard.bak${n}`;
    const writeMeta=(self,key,text)=>{
      const previous=rawGet(self,metaKey(key));let rev=0;
      try{rev=Math.max(0,Number(JSON.parse(previous||'{}').rev)||0)}catch{}
      rawSet(self,metaKey(key),JSON.stringify({v:GUARD_VERSION,hash:fingerprintText(text),rev:rev+1,ts:Date.now()}));
    };
    const rotate=(self,key,current)=>{
      for(let i=BACKUP_DEPTH;i>=2;i--){const older=rawGet(self,backupKey(key,i-1));if(older!==null)rawSet(self,backupKey(key,i),older);}
      if(current!==null&&validateStoredPayload(key,current))rawSet(self,backupKey(key,1),current);
    };
    const recover=(self,key)=>{
      const candidates=[`${key}.shadow`,...Array.from({length:BACKUP_DEPTH},(_,i)=>backupKey(key,i+1))];
      for(const candidateKey of candidates){
        const candidate=rawGet(self,candidateKey);
        if(validateStoredPayload(key,candidate)){
          rawSet(self,key,candidate);writeMeta(self,key,candidate);lastSeen.set(key,fingerprintText(candidate));return candidate;
        }
      }
      return null;
    };
    proto.getItem=function(key){
      const k=String(key),value=originalGet.call(this,k);
      if(this!==storage||!watched.has(k))return value;
      if(validateStoredPayload(k,value)){
        const hash=fingerprintText(value);lastSeen.set(k,hash);
        let meta=null;try{meta=JSON.parse(rawGet(this,metaKey(k))||'null')}catch{}
        if(!meta||meta.v!==GUARD_VERSION||meta.hash!==hash)writeMeta(this,k,value);
        return value;
      }
      const recovered=recover(this,k);return recovered!==null?recovered:value;
    };
    proto.setItem=function(key,value){
      const k=String(key),text=String(value);
      if(this!==storage||!watched.has(k))return originalSet.call(this,k,text);
      if(!validateStoredPayload(k,text))throw new TypeError(`Datos inválidos para ${k}`);
      const current=rawGet(this,k),currentValid=validateStoredPayload(k,current),currentHash=currentValid?fingerprintText(current):null,nextHash=fingerprintText(text),seen=lastSeen.get(k);
      if(currentValid&&seen&&currentHash!==seen&&nextHash!==currentHash)throw new Error(`Conflicto de escritura detectado en ${k}`);
      if(currentValid&&currentHash!==nextHash)rotate(this,k,current);
      originalSet.call(this,k,text);
      const verified=rawGet(this,k);
      if(verified!==text){if(current!==null)rawSet(this,k,current);else if(typeof originalRemove==='function')originalRemove.call(this,k);throw new Error(`Verificación de escritura fallida en ${k}`);}
      writeMeta(this,k,text);lastSeen.set(k,nextHash);
    };
    if(typeof originalRemove==='function'){
      proto.removeItem=function(key){
        const k=String(key);
        if(this===storage&&watched.has(k)){
          const current=rawGet(this,k);if(validateStoredPayload(k,current))rotate(this,k,current);lastSeen.delete(k);
        }
        return originalRemove.call(this,k);
      };
    }
    Object.defineProperty(proto,'__inversionesGuardV2',{value:true,enumerable:false,configurable:false});
    return true;
  }
  return {MAX_ENTRY_CENTS,ENTRY_KEY,GOAL_KEY,GUARD_VERSION,BACKUP_DEPTH,toCents,fromCents,money,validDate,dateObj,normalizeEntry,normalizeEntriesStrict,validateGoal,net,summary,diffDays,goalClock,goalDaily,fingerprintText,fingerprintEntries,sameEntries,validateStoredPayload,installStorageGuard};
});
