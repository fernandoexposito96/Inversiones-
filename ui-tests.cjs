'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');

// 1) Ningún id HTML puede estar duplicado.
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const counts=new Map();
for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
const duplicated=[...counts].filter(([,n])=>n!==1);
assert.deepEqual(duplicated,[],`IDs duplicados: ${JSON.stringify(duplicated)}`);

// 2) Todo elemento que app.js consulta con $('id') debe existir exactamente una vez.
const referenced=[...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];
const missing=referenced.filter(id=>!counts.has(id));
assert.deepEqual(missing,[],`IDs usados por app.js que no existen: ${missing.join(', ')}`);

// 3) Estructura acordada: dos vistas superiores y una única navegación inferior de Inicio.
for(const id of ['tabInvest','tabGoal','investView','goalView','navHome','calendar','goalDaily','daysLeft','chart','save']){
  assert.equal(counts.get(id),1,`Debe existir exactamente una vez: ${id}`);
}
assert.equal((html.match(/<nav class="tabs">/g)||[]).length,1);
const tabsBlock=html.match(/<nav class="tabs">([\s\S]*?)<\/nav>/)?.[1]||'';
assert.equal((tabsBlock.match(/<button\b/g)||[]).length,2,'Debe haber exactamente 2 pestañas superiores');
const bottomBlock=html.match(/<nav class="bottom">([\s\S]*?)<\/nav>/)?.[1]||'';
assert.equal((bottomBlock.match(/<button\b/g)||[]).length,1,'La barra inferior debe tener solo Inicio');
assert.match(bottomBlock,/id="navHome"/);

// 4) Filtros de periodo exactos.
const periods=[...html.matchAll(/data-period="([^"]+)"/g)].map(m=>m[1]).sort();
assert.deepEqual(periods,['all','month','today','week']);

// 5) Sin capas/elementos antiguos que ya se eliminaron.
for(const forbidden of ['Historial de movimientos','id="historyList"','evolution-live.js']){
  assert.equal(html.includes(forbidden)||app.includes(forbidden),false,`Resto antiguo detectado: ${forbidden}`);
}

// 6) El calendario debe distinguir ganancia, pérdida, neutro y vacío.
for(const token of ["'loss'","'win'","'neutral'","'empty'"]){
  assert.equal(app.includes(token),true,`Falta estado de calendario ${token}`);
}

// 7) Guardado reforzado y protección de doble pulsación.
assert.match(app,/if\(saving\)return/);
assert.match(app,/saveEntries\(next\)/);
assert.match(app,/Number\.isFinite\(stake\)/);
assert.match(app,/Number\.isFinite\(returned\)/);

// 8) Orden y versionado de scripts para evitar caché vieja.
const corePos=html.indexOf('core.js?v=');
const appPos=html.indexOf('app.js?v=');
assert.ok(corePos>=0&&appPos>corePos,'core.js debe cargar antes de app.js y ambos deben estar versionados');

console.log(`OK UI: ${ids.length} IDs únicos, ${referenced.length} referencias JS resueltas, 2 vistas y 1 navegación inferior verificadas`);
