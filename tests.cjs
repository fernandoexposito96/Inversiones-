'use strict';
const assert=require('node:assert/strict');
const C=require('./core.js');

const e=(date,stake,returned,id='x')=>C.normalizeEntry({id,date,stake,returned,createdAt:1});

assert.equal(C.validDate('2026-09-07'),true);
assert.equal(C.validDate('2026-02-30'),false);
assert.equal(C.validDate('2028-02-29'),true);
assert.equal(C.validDate('2027-02-29'),false);
assert.equal(C.validDate('07-09-2026'),false);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:0,returned:0}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:10,returned:-1}),null);
assert.equal(C.normalizeEntry({date:'2026-09-07',stake:'abc',returned:1}),null);

const win=e('2026-09-07',30,50,'w');
const loss=e('2026-09-07',100,0,'l');
const draw=e('2026-09-07',25,25,'d');
assert.equal(C.net(win),20);
assert.equal(C.net(loss),-100);
assert.equal(C.net(draw),0);
let s=C.summary([win,loss,draw]);
assert.deepEqual(s,{st:155,rt:75,loss:100,n:-80,wins:1,losses:1});

s=C.summary([e('2026-09-07',0.1,0.3,'a'),e('2026-09-07',0.2,0,'b')]);
assert.equal(s.st,0.3);
assert.equal(s.rt,0.3);
assert.equal(s.n,0);
assert.equal(s.loss,0.2);

const bulk=[];
for(let i=0;i<1000;i++)bulk.push(e('2026-09-07',10.01,10.02,'b'+i));
s=C.summary(bulk);
assert.equal(s.st,10010);
assert.equal(s.rt,10020);
assert.equal(s.n,10);
assert.equal(s.wins,1000);

let g=C.goalClock('2026-09-07','2026-09-07','2026-12-06',90);
assert.equal(g.elapsed,0);assert.equal(g.left,90);
g=C.goalClock('2026-09-08','2026-09-07','2026-12-06',90);
assert.equal(g.elapsed,1);assert.equal(g.left,89);
g=C.goalClock('2026-12-05','2026-09-07','2026-12-06',90);
assert.equal(g.left,1);
g=C.goalClock('2026-12-06','2026-09-07','2026-12-06',90);
assert.equal(g.left,0);
g=C.goalClock('2026-09-01','2026-09-07','2026-12-06',90);
assert.equal(g.elapsed,0);assert.equal(g.left,90);
g=C.goalClock('2026-12-31','2026-09-07','2026-12-06',90);
assert.equal(g.elapsed,90);assert.equal(g.left,0);

assert.equal(C.goalDaily(0,3000,90),33.33);
assert.equal(C.goalDaily(100,3000,90),32.22);
assert.equal(C.goalDaily(-30,3000,90),33.67);
assert.equal(C.goalDaily(3000,3000,10),0);
assert.equal(C.goalDaily(2999.99,3000,1),0.01);
assert.equal(C.goalDaily(-500,3000,0),3500);

console.log('OK: cálculos, céntimos, fechas, meta y 1000 movimientos verificados');
