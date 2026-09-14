'use strict';
const assert=require('node:assert/strict');
const C=require('./core.js');

const e=(date,stake,returned,id='x')=>C.normalizeEntry({id,date,stake,returned,createdAt:1});

// Fechas válidas e inválidas.
assert.equal(C.validDate('2026-09-07'),true);
assert.equal(C.validDate('2026-02-30'),false);
assert.equal(C.validDate('2028-02-29'),true);
assert.equal(C.validDate('2027-02-29'),false);
assert.equal(C.validDate('07-09-2026'),false);
assert.equal(C.validDate(''),false);
assert.equal(C.validDate(null),false);

// Entradas inválidas nunca deben entrar en los cálculos.
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:0,returned:0}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:-1,returned:0}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:10,returned:-1}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:'abc',returned:1}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:Infinity,returned:1}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:10,returned:Infinity}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:1e20,returned:1}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:10,returned:1e20}),null);
assert.equal(C.normalizeEntry({id:'x'.repeat(129),date:'2026-09-07',stake:10,returned:11}),null);

// Integridad estricta: una lista dañada o IDs duplicados no se aceptan parcialmente.
const strictGood=C.normalizeEntriesStrict([
  {id:'a',date:'2026-09-07',stake:10,returned:12,createdAt:1},
  {id:'b',date:'2026-09-08',stake:5,returned:0,createdAt:2}
]);
assert.equal(strictGood.length,2);
assert.equal(C.normalizeEntriesStrict('mal'),null);
assert.equal(C.normalizeEntriesStrict([{id:'a',date:'2026-09-07',stake:10,returned:12},{id:'a',date:'2026-09-08',stake:5,returned:0}]),null);
assert.equal(C.normalizeEntriesStrict([{id:'a',date:'2026-09-07',stake:10,returned:12},{id:'b',date:'2026-02-30',stake:5,returned:0}]),null);

// Metas: validación centralizada para impedir configuraciones imposibles.
assert.deepEqual(C.validateGoal({amount:3000,start:'2026-09-07',end:'2026-12-06'}),{amount:3000,start:'2026-09-07',end:'2026-12-06'});
assert.equal(C.validateGoal({amount:0,start:'2026-09-07',end:'2026-12-06'}),null);
assert.equal(C.validateGoal({amount:3000,start:'2026-12-07',end:'2026-12-06'}),null);
assert.equal(C.validateGoal({amount:Infinity,start:'2026-09-07',end:'2026-12-06'}),null);
assert.equal(C.validateGoal({amount:1e20,start:'2026-09-07',end:'2026-12-06'}),null);

// Ganancia, pérdida y empate.
const win=e('2026-09-07',30,50,'w');
const loss=e('2026-09-07',100,0,'l');
const draw=e('2026-09-07',25,25,'d');
assert.equal(C.net(win),20);
assert.equal(C.net(loss),-100);
assert.equal(C.net(draw),0);
let s=C.summary([win,loss,draw]);
assert.deepEqual(s,{st:155,rt:75,loss:100,n:-80,wins:1,losses:1});

// Exactitud en céntimos, evitando errores de coma flotante.
s=C.summary([e('2026-09-07',0.1,0.3,'a'),e('2026-09-07',0.2,0,'b')]);
assert.equal(s.st,0.3);
assert.equal(s.rt,0.3);
assert.equal(s.n,0);
assert.equal(s.loss,0.2);
assert.equal(C.money(0.1+0.2),0.3);
assert.equal(C.money(12.345),12.35);
assert.equal(Number.isNaN(C.money(Infinity)),true);

// Varias jugadas del mismo día deben sumar correctamente.
s=C.summary([
  e('2026-09-14',10,0,'d1'),
  e('2026-09-14',20,35,'d2'),
  e('2026-09-14',5,5,'d3')
]);
assert.equal(s.st,35);
assert.equal(s.rt,40);
assert.equal(s.n,5);
assert.equal(s.loss,10);
assert.equal(s.wins,1);
assert.equal(s.losses,1);

// Volumen alto: 100.000 movimientos sin deriva en céntimos ni IDs repetidos.
const bulk=[];
for(let i=0;i<100000;i++)bulk.push(e('2026-09-07',10.01,10.02,'b'+i));
s=C.summary(bulk);
assert.equal(s.st,1001000);
assert.equal(s.rt,1002000);
assert.equal(s.n,1000);
assert.equal(s.wins,100000);
assert.equal(C.normalizeEntriesStrict(bulk).length,100000);

// El resumen falla de forma explícita ante datos corruptos en vez de producir cifras silenciosamente incorrectas.
assert.throws(()=>C.summary(null),/array/);
assert.throws(()=>C.summary([{id:'bad',date:'2026-09-07',stake:-1,returned:0}]),/inválido/);

// Huella determinista para detectar divergencias entre copias internas.
const fpA=C.fingerprintEntries(strictGood);
const fpB=C.fingerprintEntries(JSON.parse(JSON.stringify(strictGood)));
assert.match(fpA,/^[0-9a-f]{8}$/);
assert.equal(fpA,fpB);
assert.equal(C.sameEntries(strictGood,JSON.parse(JSON.stringify(strictGood))),true);
assert.equal(C.sameEntries(strictGood,[...strictGood,{id:'c',date:'2026-09-09',stake:1,returned:2}]),false);
assert.equal(C.fingerprintEntries([{id:'a',date:'mal',stake:1,returned:2}]),null);
assert.equal(C.validateStoredPayload(C.ENTRY_KEY,JSON.stringify(strictGood)),true);
assert.equal(C.validateStoredPayload(C.ENTRY_KEY,'{"rotura":'),false);
assert.equal(C.validateStoredPayload(C.GOAL_KEY,JSON.stringify({amount:3000,start:'2026-09-01',end:'2026-12-06'})),true);

// Cuenta atrás inclusiva mientras queda plazo: el 14 sep muestra 84 días.
let g=C.goalClock('2026-09-07','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,0);assert.equal(g.left,91);
g=C.goalClock('2026-09-14','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,7);assert.equal(g.left,84);
g=C.goalClock('2026-12-05','2026-09-07','2026-12-06',91);
assert.equal(g.left,2);
g=C.goalClock('2026-12-06','2026-09-07','2026-12-06',91);
assert.equal(g.left,0);
g=C.goalClock('2026-09-01','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,0);assert.equal(g.left,91);
g=C.goalClock('2026-12-31','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,91);assert.equal(g.left,0);
assert.throws(()=>C.goalClock('2026-09-07','mal','2026-12-06',91));
assert.throws(()=>C.goalClock('2026-09-07','2026-09-07','2026-12-06',0));
assert.throws(()=>C.goalClock('2026-09-07','2026-09-07','2026-12-06',91.5));

// Media diaria: sube con pérdidas, baja con beneficios, nunca baja de cero.
assert.equal(C.goalDaily(0,3000,84),35.71);
assert.equal(C.goalDaily(100,3000,84),34.52);
assert.equal(C.goalDaily(-30,3000,84),36.07);
assert.equal(C.goalDaily(3000,3000,10),0);
assert.equal(C.goalDaily(3500,3000,10),0);
assert.equal(C.goalDaily(2999.99,3000,1),0.01);
assert.equal(C.goalDaily(-500,3000,0),3500);
assert.throws(()=>C.goalDaily(Infinity,3000,10));

// Fuzz determinista: miles de combinaciones comparadas contra aritmética entera de referencia.
let seed=123456789,refStake=0,refReturned=0;
const fuzz=[];
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let i=0;i<5000;i++){
  const stakeCents=1+(rand()%250000),returnedCents=rand()%400000;
  refStake+=stakeCents;refReturned+=returnedCents;
  fuzz.push(e('2026-09-14',stakeCents/100,returnedCents/100,'f'+i));
}
const fuzzSummary=C.summary(fuzz);
assert.equal(C.toCents(fuzzSummary.st),refStake);
assert.equal(C.toCents(fuzzSummary.rt),refReturned);
assert.equal(C.toCents(fuzzSummary.n),refReturned-refStake);

// Almacenamiento tolerante a fallos: backups rotativos, recuperación, checksum y conflictos.
class MockStorage{
  constructor(){this.map=new Map();}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){this.map.set(String(k),String(v));}
  removeItem(k){this.map.delete(String(k));}
}
const mockRoot={Storage:MockStorage,localStorage:new MockStorage()};
assert.equal(C.installStorageGuard(mockRoot),true);
assert.equal(C.installStorageGuard(mockRoot),false);
const store=mockRoot.localStorage;
const p1=JSON.stringify([{id:'s1',date:'2026-09-14',stake:10,returned:12,createdAt:1}]);
const p2=JSON.stringify([{id:'s1',date:'2026-09-14',stake:10,returned:12,createdAt:1},{id:'s2',date:'2026-09-14',stake:5,returned:1,createdAt:2}]);
const p3=JSON.stringify([{id:'s3',date:'2026-09-14',stake:20,returned:30,createdAt:3}]);
store.setItem(C.ENTRY_KEY,p1);
assert.equal(store.getItem(C.ENTRY_KEY),p1);
store.setItem(C.ENTRY_KEY+'.shadow',p1);
store.setItem(C.ENTRY_KEY,p2);
assert.equal(store.getItem(C.ENTRY_KEY+'.guard.bak1'),p1);
const meta=JSON.parse(store.getItem(C.ENTRY_KEY+'.guard.meta'));
assert.equal(meta.v,C.GUARD_VERSION);assert.equal(meta.hash,C.fingerprintText(p2));assert.ok(meta.rev>=2);
assert.throws(()=>store.setItem(C.ENTRY_KEY,'{"broken":'),/inválidos/);
// Corrupción directa simulada: el guard debe recuperar una copia válida automáticamente.
store.map.set(C.ENTRY_KEY,'{"broken":');
assert.equal(store.getItem(C.ENTRY_KEY),p1);
assert.equal(store.map.get(C.ENTRY_KEY),p1);
// Lectura seguida de cambio externo: una escritura obsoleta debe bloquearse.
store.getItem(C.ENTRY_KEY);
store.map.set(C.ENTRY_KEY,p3);
assert.throws(()=>store.setItem(C.ENTRY_KEY,p2),/Conflicto de escritura/);
// Si se elimina el principal, queda una copia rotativa recuperable.
store.map.set(C.ENTRY_KEY,p1);store.getItem(C.ENTRY_KEY);store.removeItem(C.ENTRY_KEY);
assert.equal(C.validateStoredPayload(C.ENTRY_KEY,store.getItem(C.ENTRY_KEY+'.guard.bak1')),true);

console.log('OK: céntimos seguros, 100.000 movimientos, fuzz, corrupción, recuperación rotativa, checksum y conflictos verificados');
