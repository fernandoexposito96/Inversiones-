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

// 2) Todo elemento estático que app.js consulta con $('id') debe existir exactamente una vez.
// Los IDs del historial se crean deliberadamente en tiempo de ejecución.
const dynamicIds=new Set(['movementHistory','historyCount','historyList','editOverlay','editDate','editStake','editReturned','editCancel','editSave']);
const referenced=[...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];
const missing=referenced.filter(id=>!counts.has(id)&&!dynamicIds.has(id));
assert.deepEqual(missing,[],`IDs estáticos usados por app.js que no existen: ${missing.join(', ')}`);

// 3) Estructura acordada: dos vistas superiores y una única navegación inferior de Inicio.
for(const id of ['tabInvest','tabGoal','investView','goalView','navHome','calendar','goalDaily','daysLeft','chart','save'])assert.equal(counts.get(id),1,`Debe existir exactamente una vez: ${id}`);
assert.equal((html.match(/<nav\b[^>]*class="tabs"[^>]*>/g)||[]).length,1);
const tabsBlock=html.match(/<nav\b[^>]*class="tabs"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
assert.equal((tabsBlock.match(/<button\b/g)||[]).length,2,'Debe haber exactamente 2 pestañas superiores');
const bottomBlock=html.match(/<nav\b[^>]*class="bottom"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
assert.equal((bottomBlock.match(/<button\b/g)||[]).length,1,'La barra inferior debe tener solo Inicio');
assert.match(bottomBlock,/id="navHome"/);

// 4) Filtros de periodo exactos.
const periods=[...html.matchAll(/data-period="([^"]+)"/g)].map(m=>m[1]).sort();
assert.deepEqual(periods,['all','month','today','week']);

// 5) Sin capas antiguas: se permite el nuevo historial editable, pero no la implementación vieja.
for(const forbidden of ['Historial de movimientos','evolution-live.js','RESET_KEY','mi-control.reset.zero'])assert.equal(html.includes(forbidden)||app.includes(forbidden),false,`Resto antiguo detectado: ${forbidden}`);

// 6) El calendario distingue ganancia, pérdida, neutro y vacío y expone estado accesible.
for(const token of ["'loss'","'win'","'neutral'","'empty'"])assert.equal(app.includes(token),true,`Falta estado de calendario ${token}`);
assert.match(app,/role="listitem"/);
assert.match(app,/aria-label=/);

// 7) Guardado reforzado y protección de doble pulsación/ID duplicado.
assert.match(app,/if\(saving\)return/);
assert.match(app,/saveEntries\(next\)/);
assert.match(app,/Number\.isFinite\(stake\)/);
assert.match(app,/Number\.isFinite\(returned\)/);
assert.match(app,/while\(entries\.some\(x=>x\.id===id\)\)/);

// 8) Integridad estricta y copias internas de movimientos y meta.
assert.match(app,/normalizeEntriesStrict/);
assert.match(app,/const BACKUP_KEY=KEY\+'\.shadow'/);
assert.match(app,/const GOAL_BACKUP_KEY=GOAL_KEY\+'\.shadow'/);
assert.match(app,/parseStored\(BACKUP_KEY\)/);
assert.match(app,/parseGoalStored\(GOAL_BACKUP_KEY\)/);
assert.match(app,/localStorage\.setItem\(BACKUP_KEY,payload\)/);
assert.match(app,/localStorage\.setItem\(GOAL_BACKUP_KEY,payload\)/);
assert.match(app,/localStorage\.setItem\(KEY,JSON\.stringify\(recovered\)\)/);
assert.match(app,/localStorage\.setItem\(GOAL_KEY,JSON\.stringify\(recovered\)\)/);

// 9) Sincronización entre pestañas para evitar sobrescrituras con estado viejo.
assert.match(app,/addEventListener\('storage'/);
assert.match(app,/event\.key===KEY/);
assert.match(app,/event\.key===BACKUP_KEY/);
assert.match(app,/event\.key===GOAL_KEY/);
assert.match(app,/event\.key===GOAL_BACKUP_KEY/);

// 10) Historial nuevo: debe poder editar y eliminar, guardando de nuevo los datos.
assert.match(app,/Movimientos guardados/);
assert.match(app,/data-action="edit"/);
assert.match(app,/data-action="delete"/);
assert.match(app,/function saveEditedMovement\(/);
assert.match(app,/function deleteMovement\(/);
assert.match(app,/entries\.map\(x=>x\.id===editingId\?updated:x\)/);
assert.match(app,/entries\.filter\(x=>x\.id!==id\)/);
assert.match(app,/confirm\(/);

// 11) Accesibilidad de navegación, teclado, gráfica y editor.
assert.match(html,/role="tablist"/);
assert.match(html,/role="tab"/);
assert.match(html,/role="tabpanel"/);
assert.match(html,/aria-controls="investView"/);
assert.match(html,/aria-controls="goalView"/);
assert.match(app,/aria-selected/);
assert.match(app,/ArrowLeft/);
assert.match(app,/ArrowRight/);
assert.match(app,/setAttribute\('aria-label'/);
assert.match(app,/aria-modal="true"/);

// 12) Rendimiento visual protegido: DPR acotado y resize agrupado por frame.
assert.match(app,/Math\.min\(window\.devicePixelRatio\|\|1,3\)/);
assert.match(app,/cancelAnimationFrame\(resizeRaf\)/);

// 13) Orden y versionado de scripts para evitar caché vieja (deploy sustituye el token por SHA).
const corePos=html.indexOf('core.js?v=');
const appPos=html.indexOf('app.js?v=');
assert.ok(corePos>=0&&appPos>corePos,'core.js debe cargar antes de app.js y ambos deben estar versionados');

console.log(`OK UI: ${ids.length} IDs estáticos únicos, ${referenced.length} referencias JS, historial editable/eliminable, integridad, sincronización y rendimiento verificados`);