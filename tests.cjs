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

// Volumen alto: 1.000 movimientos sin deriva en céntimos.
const bulk=[];
for(let i=0;i<1000;i++)bulk.push(e('2026-09-07',10.01,10.02,'b'+i));
s=C.summary(bulk);
assert.equal(s.st,10010);
assert.equal(s.rt,10020);
assert.equal(s.n,10);
assert.equal(s.wins,1000);

// Cuenta atrás. La UI usa 91 días inclusivos entre 7 sep y 6 dic.
let g=C.goalClock('2026-09-07','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,0);assert.equal(g.left,91);
g=C.goalClock('2026-09-14','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,7);assert.equal(g.left,84);
g=C.goalClock('2026-12-05','2026-09-07','2026-12-06',91);
assert.equal(g.left,1);
g=C.goalClock('2026-12-06','2026-09-07','2026-12-06',91);
assert.equal(g.left,0);
g=C.goalClock('2026-09-01','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,0);assert.equal(g.left,91);
g=C.goalClock('2026-12-31','2026-09-07','2026-12-06',91);
assert.equal(g.elapsed,91);assert.equal(g.left,0);
assert.throws(()=>C.goalClock('2026-09-07','mal','2026-12-06',91));

// Media diaria: sube con pérdidas, baja con beneficios, nunca baja de cero.
assert.equal(C.goalDaily(0,3000,84),35.71);
assert.equal(C.goalDaily(100,3000,84),34.52);
assert.equal(C.goalDaily(-30,3000,84),36.07);
assert.equal(C.goalDaily(3000,3000,10),0);
assert.equal(C.goalDaily(3500,3000,10),0);
assert.equal(C.goalDaily(2999.99,3000,1),0.01);
assert.equal(C.goalDaily(-500,3000,0),3500);

console.log('OK: fechas, céntimos, pérdidas/ganancias, meta de 91 días y 1000 movimientos verificados');
