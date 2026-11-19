'use strict';
/* Panel — tareas (incluidas las periódicas y renovaciones), trabajo y resumen de gastos.
   Hermana de SaveyCustom: misma estructura, mismas piezas (hojas, toast, tema, seguimiento de cambios).
   Los datos viven en el dispositivo (localStorage); la sincronización con GitHub llega en la fase 3. */

// Versión de la app = fecha de publicación + nº de publicación de ese día ('panel-AAAA-MM-DD.N').
// Tiene que coincidir siempre con CACHE de sw.js: se cambian las dos juntas en cada publicación.
const APP_VERSION = 'panel-2026-11-19.5';
// '2026-11-19.2' -> '19/11/2026 · 2' (las versiones antiguas, 'v7', se muestran tal cual)
const fmtVersion = v => { const m = String(v).replace('panel-', '').match(/^(\d{4}-\d{2}-\d{2})\.(\d+)$/); return m ? `${fmtDia(m[1])} · ${m[2]}` : String(v).replace('panel-', ''); };
const KEY = 'panel.db.v1';
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Datos ---------------- */
function defaultDB() {
  return {
    version: 1,
    caducidades: [],
    tareas: [],
    trabajo: { u: 0, 'año': new Date().getFullYear(), vacacionesTotales: 24, ausencias: [] }, // 22 de vacaciones + 2 de libre disposición
    deleted: {},
    // Ajustes locales del dispositivo: no se sincronizan
    settings: { theme: 'auto', lastBackup: null },
  };
}
const SETTINGS_DEFAULT = defaultDB().settings;

let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !Array.isArray(db.tareas)) db = defaultDB();
  normalize();
  takeSnap();
}
function normalize() {
  const d = defaultDB();
  db.settings = Object.assign({}, SETTINGS_DEFAULT, db.settings || {});
  db.caducidades = db.caducidades || [];
  db.tareas = db.tareas || [];
  // Tareas y caducidades están unificadas: las caducidades (de copias antiguas u otro dispositivo sin actualizar) pasan a tareas
  migrarCaducidades(db);
  for (const t of db.tareas) { if (t.repite === undefined) t.repite = null; if (t.avisoDias === undefined) t.avisoDias = null; if (t.tipo === undefined) t.tipo = null; }
  db.trabajo = Object.assign(d.trabajo, db.trabajo || {});
  db.trabajo.ausencias = db.trabajo.ausencias || [];
  // Los festivos ya no son fechas sino un número por año (trabajo.festivos). Los antiguos se eliminan
  // marcándolos como borrados, para que la sincronización también los quite del resto de dispositivos.
  for (const a of db.trabajo.ausencias) if (a.tipo === 'festivo_local' || a.tipo === 'festivo_autonomico') db.deleted = { ...(db.deleted || {}), [a.id]: Math.max(Date.now(), (a.u || 0) + 1) };
  db.trabajo.ausencias = db.trabajo.ausencias.filter(a => a.tipo !== 'festivo_local' && a.tipo !== 'festivo_autonomico');
  // Los días pedidos cuentan para un año ("año"); si falta, el de su fecha de inicio
  for (const a of db.trabajo.ausencias) if (!a['año']) a['año'] = +a.desde.slice(0, 4);
  db.deleted = db.deleted || {};
}
// Guarda un cambio hecho en este dispositivo: marca qué registros cambiaron (para sincronizar) y guarda.
function save() { stamp(); saveRaw(); scheduleSync(); }
function saveRaw() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert('No se pudieron guardar los datos: ' + e.message); }
  takeSnap();
}

/* Seguimiento de cambios por registro (como en Savey): cada registro lleva "u" (última modificación)
   y los borrados quedan en db.deleted. Así, cuando llegue la sincronización, no hará falta migrar nada. */
const LISTS = [d => d.caducidades, d => d.tareas, d => d.trabajo.ausencias];
const trabajoCab = () => { const { u, ausencias, ...rest } = db.trabajo; return JSON.stringify(rest); };
let snap = new Map();
const stripU = r => { const { u, ...rest } = r; return JSON.stringify(rest); };
function takeSnap() {
  snap = new Map();
  for (const get of LISTS) for (const r of get(db)) snap.set(r.id, stripU(r));
  snap.set('__trabajo', trabajoCab());
}
function stamp() {
  const now = Date.now(), seen = new Set();
  for (const get of LISTS) for (const r of get(db)) {
    seen.add(r.id);
    if (snap.get(r.id) !== stripU(r)) r.u = now;
  }
  for (const id of snap.keys()) if (id !== '__trabajo' && !seen.has(id)) db.deleted[id] = now;
  if (snap.get('__trabajo') !== trabajoCab()) db.trabajo.u = now;
}

/* ---------------- Utilidades ---------------- */
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const longDate = d => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
const soft = (hex, a = .2) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
const ico = (item, cls = '') => `<span class="ico ${cls}" style="background:${soft(item?.color || '#7a7f8c', .22)}">${item?.icon || '❔'}</span>`;

/* Fechas: siempre "AAAA-MM-DD" de día local, sin hora. Nunca se pasan por new Date('AAAA-MM-DD'),
   que las interpreta en UTC y puede mover el día. */
const hoy = () => dayKey(new Date());
const parseDia = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDia = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
// Días enteros de hoy a la fecha (negativo si ya pasó). Math.round absorbe los cambios de hora.
const diasHasta = s => Math.round((parseDia(s) - parseDia(hoy())) / 864e5);
function textoDias(n) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n < 0) return `hace ${-n} días`;
  if (n <= 60) return `en ${n} días`;
  if (n < 335) { const m = Math.round(n / 30.4); return `en ${m} ${m === 1 ? 'mes' : 'meses'}`; }
  const a = Math.max(1, Math.round(n / 365)); return `en ${a} ${a === 1 ? 'año' : 'años'}`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ---------------- Estado de la interfaz ---------------- */
const UI_KEY = 'panel.ui';
const ui = { tab: 'home' };
try { // recuerda pestaña y filtro de tareas entre recargas
  const saved = JSON.parse(localStorage.getItem(UI_KEY)) || {};
  for (const k of ['tab', 'filtroTareas', 'vistaTrabajo']) if (saved[k]) ui[k] = saved[k];
} catch (e) { }
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, filtroTareas: ui.filtroTareas, vistaTrabajo: ui.vistaTrabajo })); } catch (e) { } }

/* ---------------- Iconos SVG ---------------- */
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  gear: (() => {
    // Engranaje de 8 dientes generado como polígono (el mismo de Savey)
    const pts = []; const N = 8;
    for (let i = 0; i < N * 4; i++) {
      const a = (i / (N * 4)) * Math.PI * 2 - Math.PI / 2 + Math.PI / (N * 4);
      const r = (i % 4 === 0 || i % 4 === 1) ? 10 : 7.6;
      pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
    }
    return `<svg viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M${pts.join('L')}Z M12 8.6a3.4 3.4 0 1 0 0.001 0Z"/></svg>`;
  })(),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  home: svg('<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5h3v5H18V9.5"/>'),
  check: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.5l3 3 5-6"/>'),
  chart: svg('<path d="M3 17l5-6 4 3 6-8 3 3"/><path d="M3 21h18"/>'),
  briefcase: svg('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 12.5h18"/>'),
};

/* ---------------- Pestañas ----------------
   "fab" es lo que hace el botón + en esa pestaña (Gastos no tiene: es solo lectura). */
const TABS = [
  { k: 'home', label: 'Inicio', icon: I.home, title: 'Inicio', view: viewHome, fab: () => openTareaForm(null) },
  { k: 'tareas', label: 'Tareas', icon: I.check, title: 'Tareas', view: viewTareas, fab: () => openTareaForm(null, { ambito: ui.filtroTareas === 'trabajo' ? 'trabajo' : 'personal' }) },
  { k: 'trabajo', label: 'Trabajo', icon: I.briefcase, title: 'Trabajo', view: viewTrabajo, fab: () => pickList('Añadir', [['tarea', '☑️ Tarea de trabajo'], ['aus', '🏖️ Pedir días']], null, v => v === 'tarea' ? openTareaForm(null, { ambito: 'trabajo' }) : openAusForm(null)) },
  { k: 'gastos', label: 'Gastos', icon: I.chart, title: 'Gastos', view: viewGastos, fab: null },
];
const tabOf = k => TABS.find(t => t.k === (k === 'cad' ? 'tareas' : k)) || TABS[0]; // 'cad' era la antigua pestaña Caducidades

/* ---------------- Render principal ---------------- */
function render() {
  const tab = tabOf(ui.tab); ui.tab = tab.k;
  saveUi();
  applyTheme();
  $('#topbar').innerHTML = `<span></span><div class="pagetitle">${tab.title}</div><button class="iconbtn" data-act="settings" aria-label="Configuración">${I.gear}</button>`;
  $('#tabbar').innerHTML = TABS.map(t => `<button class="${t.k === tab.k ? 'on' : ''}" data-act="tab" data-tab="${t.k}">${t.icon}<span>${t.label}</span></button>`).join('');
  $('#fab').hidden = !tab.fab;
  $('#view').innerHTML = tab.view();
  sheets.forEach(s => s.live && s.refresh());
}

/* ---------------- Tareas (incluidas las periódicas: renovaciones, caducidades…) ----------------
   Una caducidad es una tarea con fecha, aviso y repetición. Todo vive en db.tareas:
   - repite: null o { cada: N, unidad: 'dias' | 'semanas' | 'meses' | 'años' } (necesita fecha)
   - avisoDias: días de antelación con que aparece en Inicio (null = solo cuando llega su semana)
   - tipo: icono opcional (vehículo, documento, seguro…) */
const TIPOS = {
  vehiculo: { n: 'Vehículo', icon: '🚗', color: '#43b5c9' },
  documento: { n: 'Documento', icon: '🪪', color: '#8e6ce0' },
  seguro: { n: 'Seguro', icon: '🛡️', color: '#5b9cf0' },
  impuesto: { n: 'Impuesto', icon: '🧾', color: '#f08a3c' },
  garantia: { n: 'Garantía', icon: '📦', color: '#9c6b4e' },
  suscripcion: { n: 'Suscripción', icon: '📺', color: '#7c84e8' },
  otro: { n: 'Otro', icon: '📄', color: '#7a7f8c' },
};
const UNIDADES = { dias: ['día', 'días'], semanas: ['semana', 'semanas'], meses: ['mes', 'meses'], 'años': ['año', 'años'] };
const CADA_UNO = { dias: 'Cada día', semanas: 'Cada semana', meses: 'Cada mes', 'años': 'Cada año' };
const AVISOS = [1, 3, 7, 15, 30, 45, 60, 90];
const PRIORIDADES = { alta: { n: 'Alta', color: 'var(--accent)' }, media: { n: 'Media', color: 'var(--warn)' }, baja: { n: 'Baja', color: 'var(--muted)' } };
const ORDEN_PRIO = { alta: 0, media: 1, baja: 2 };
const AMBITOS = { personal: 'Personal', trabajo: 'Trabajo' };
const FILTROS = [['todas', 'Todas'], ['personal', 'Personal'], ['trabajo', 'Trabajo'], ['repite', 'Periódicas']];
const tarea = id => db.tareas.find(t => t.id === id);
// Domingo de esta semana (la semana empieza en lunes)
const finSemana = () => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7); return dayKey(d); };
const porTarea = (a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || ORDEN_PRIO[a.prioridad] - ORDEN_PRIO[b.prioridad] || (a.creada || '').localeCompare(b.creada || '');
const cumpleFiltro = (t, f) => !f || f === 'todas' || (f === 'repite' ? !!t.repite : t.ambito === f);
const pendientes = filtro => db.tareas.filter(t => t.estado !== 'hecha' && cumpleFiltro(t, filtro)).sort(porTarea);
const textoRepite = r => !r ? '' : r.cada === 1 ? CADA_UNO[r.unidad] : `Cada ${r.cada} ${UNIDADES[r.unidad]?.[1] || ''}`;
// Ya dentro de su ventana de aviso (o vencida)
const enAviso = t => t.estado !== 'hecha' && !!t.fecha && t.avisoDias != null && diasHasta(t.fecha) <= t.avisoDias;

// Siguiente fecha de una repetición. En meses y años, si el día no existe (31, 29 de febrero) se usa el último del mes.
function sumarRepeticion(fecha, r) {
  const [y, m, d] = fecha.split('-').map(Number), n = Math.max(1, r.cada | 0);
  if (r.unidad === 'dias' || r.unidad === 'semanas') return dayKey(new Date(y, m - 1, d + n * (r.unidad === 'semanas' ? 7 : 1)));
  const meses = (m - 1) + (r.unidad === 'meses' ? n : n * 12), ny = y + Math.floor(meses / 12), nm = meses % 12;
  return dayKey(new Date(ny, nm, Math.min(d, new Date(ny, nm + 1, 0).getDate())));
}
// Marca una tarea como hecha; si se repite, crea la siguiente (la primera fecha que no haya pasado).
// Id determinista (como los recurrentes de Savey): si dos dispositivos la completan a la vez, no se duplica.
function completar(t) {
  t.estado = 'hecha';
  if (!t.repite || !t.fecha) return null;
  let fecha = sumarRepeticion(t.fecha, t.repite);
  for (let g = 0; fecha < hoy() && g < 1000; g++) fecha = sumarRepeticion(fecha, t.repite);
  const id = `${t.id.split('_')[0]}_${fecha}`;
  if (!tarea(id) && !db.deleted[id]) db.tareas.push({ ...t, id, fecha, estado: 'pendiente', creada: hoy(), u: undefined });
  return fecha;
}
function toggleTarea(t) {
  if (t.estado === 'hecha') { t.estado = 'pendiente'; save(); render(); return toast('Pendiente otra vez'); }
  const next = completar(t);
  save(); render(); toast(next ? `Hecha · la siguiente, el ${fmtDia(next)}` : 'Hecha');
}
// Convierte las caducidades antiguas en tareas (mismo id, para que la sincronización no las duplique)
function migrarCaducidades(d) {
  for (const c of d.caducidades || []) {
    if (d.tareas.some(t => t.id === c.id)) continue;
    const años = ({ anual: 1, bienal: 2, 'cada_n_años': c.cadaN || 0 })[c.repite] || 0;
    d.tareas.push({ id: c.id, u: c.u, titulo: c.nombre || '', ambito: 'personal', fecha: c.fecha || null, prioridad: 'media', estado: c.hecho ? 'hecha' : 'pendiente', notas: c.notas || '', creada: '',
      repite: años ? { cada: años, unidad: 'años' } : null, avisoDias: c.avisoDias ?? 30, tipo: c.tipo || null });
  }
  d.caducidades = [];
}

function tareaRow(t, conAmbito = false) {
  const hecha = t.estado === 'hecha', n = t.fecha ? diasHasta(t.fecha) : null, conAviso = !hecha && t.fecha && t.avisoDias != null;
  const fechaTxt = t.fecha ? (conAviso ? fmtDia(t.fecha) : `<span class="${!hecha && n < 0 ? 'red' : ''}">${fmtDia(t.fecha)} · ${n < 0 ? 'vencida ' : ''}${textoDias(n)}</span>`) : '';
  const sub = [fechaTxt, t.repite ? '🔁 ' + textoRepite(t.repite) : '', conAmbito ? AMBITOS[t.ambito] : '', t.notas ? esc(t.notas) : ''].filter(Boolean).join(' · ');
  const tag = conAviso ? `<span class="tag ${enAviso(t) ? 'red' : ''}">${n < 0 ? 'vencida ' : ''}${textoDias(n)}</span>` : '';
  const ic = TIPOS[t.tipo] ? `<span class="tico">${TIPOS[t.tipo].icon}</span>` : '';
  return `<div class="row ${hecha ? 'done' : ''}"><button class="check ${hecha ? 'on' : ''}" data-act="toggleTarea" data-id="${t.id}" aria-label="${hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}"></button>
    <button class="rowmain" data-act="editTarea" data-id="${t.id}"><div class="main"><div class="name"><span class="dot" style="background:${PRIORIDADES[t.prioridad]?.color}"></span>${ic}${esc(t.titulo)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${tag}</button></div>`;
}
function gruposTareas(list, conAmbito) {
  const h = hoy(), fs = finSemana();
  const g = [['Vencidas', t => t.fecha && t.fecha < h], ['Hoy', t => t.fecha === h], ['Esta semana', t => t.fecha && t.fecha > h && t.fecha <= fs],
    ['Se acerca', t => t.fecha && t.fecha > fs && enAviso(t)], ['Más adelante', t => t.fecha && t.fecha > fs && !enAviso(t)], ['Sin fecha', t => !t.fecha]];
  return g.map(([titulo, f]) => { const l = list.filter(f); return l.length ? `<div class="grp">${titulo}</div>${l.map(t => tareaRow(t, conAmbito)).join('')}` : ''; }).join('');
}
function viewTareas() {
  const filtro = FILTROS.some(([k]) => k === ui.filtroTareas) ? ui.filtroTareas : 'todas';
  const seg = `<div class="seg" style="margin:6px 0 4px">${FILTROS.map(([k, l]) => `<button class="${filtro === k ? 'on' : ''}" data-act="filtroTareas" data-f="${k}">${l}</button>`).join('')}</div>`;
  const pend = pendientes(filtro);
  const hechas = db.tareas.filter(t => t.estado === 'hecha' && cumpleFiltro(t, filtro)).sort((a, b) => (b.u || 0) - (a.u || 0));
  const vacio = filtro === 'repite' ? 'No tienes tareas periódicas.<br>ITV, DNI, seguros, garantías, recibos… ponles fecha y repetición.' : `No tienes tareas pendientes${filtro !== 'todas' ? ' de ' + AMBITOS[filtro].toLowerCase() : ''}.`;
  return `${seg}${pend.length ? gruposTareas(pend, filtro === 'todas' || filtro === 'repite') : `<div class="empty-state">${vacio}<br>Pulsa <b>+</b> para añadir.</div>`}
    ${hechas.length ? `<button class="fold" data-act="toggleCompletadas">${ui.verCompletadas ? '▾' : '▸'} Completadas (${hechas.length})</button>${ui.verCompletadas ? hechas.map(t => tareaRow(t, filtro === 'todas')).join('') : ''}` : ''}`;
}

function viewHome() {
  // Tareas vencidas, de hoy o de esta semana (hasta el domingo), las que ya están dentro de su aviso
  // y los que no tienen fecha, que hay que tener en mente. El resto aparecerá cuando le llegue el momento.
  const fs = finSemana(), lista = pendientes().filter(t => !t.fecha || t.fecha <= fs || enAviso(t));
  const avisos = lista.filter(enAviso).length;
  const pend = `<h2 class="sec">Tareas${avisos ? ` <span class="tag red" style="vertical-align:middle">${plural(avisos, 'con aviso', 'con aviso')}</span>` : ''}</h2>
    ${lista.length ? gruposTareas(lista, true) : `<div class="empty-state" style="padding:24px 10px">Nada vencido, para esta semana ni sin fecha.<br>Pulsa <b>+</b> para añadir algo.</div>`}`;
  // Días libres del año en curso, y también los del año anterior si aún quedan por gastar
  const y = new Date().getFullYear(), conDatos = a => db.trabajo.ausencias.some(x => añoDe(x) === a || x.desde.startsWith(String(a)));
  const dias = [y - 1, y].filter(a => a === y ? (conDatos(a) || db.trabajo.vacacionesTotales) : conDatos(a) && contadorDias(a).restantes > 0);
  const libres = dias.length ? `<h2 class="sec">Días libres</h2>${dias.map(a => tarjetaDias(a, true)).join('')}` : '';
  return `${backupBanner()}${pend}${libres}`;
}

function openTareaForm(existing, preset = {}) {
  const isEdit = !!existing;
  const f = existing ? { ...existing, repite: existing.repite ? { ...existing.repite } : null }
    : { titulo: '', ambito: 'personal', fecha: null, prioridad: 'media', notas: '', repite: null, avisoDias: null, tipo: null, ...preset };
  let cadaTxt = String(f.repite?.cada || 1);
  const seg = (key, opts) => `<div class="seg lg" style="margin:4px 0">${Object.entries(opts).map(([k, l]) => `<button class="${f[key] === k ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${k}">${l}</button>`).join('')}</div>`;
  const opt = (v, l, cur) => `<option value="${v}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${l}</option>`;
  openSheet({
    cls: 'full',
    render: () => {
      const t = TIPOS[f.tipo], avisos = f.avisoDias == null || AVISOS.includes(f.avisoDias) ? AVISOS : [...AVISOS, f.avisoDias].sort((a, b) => a - b);
      return `${head(isEdit ? 'Editar tarea' : 'Crear tarea')}
      <div class="field"><label>Tarea</label><input data-input="titulo" value="${esc(f.titulo)}" placeholder="Ej. Llamar al banco o renovar la ITV"></div>
      <div class="field"><label>Ámbito</label>${seg('ambito', AMBITOS)}</div>
      <div class="frow"><span>Fecha</span><span class="v ${f.fecha ? '' : 'ph'}">${f.fecha ? `${fmtDia(f.fecha)} <span class="muted">· ${textoDias(diasHasta(f.fecha))}</span>` : 'Sin fecha ›'}</span><input type="date" data-valor="${f.fecha || ''}" data-on="fecha"></div>
      ${f.fecha ? `<button class="link" data-act="sinFecha">Quitar fecha</button>
        <div class="frow"><span>Se repite</span><span class="v">${f.repite ? textoRepite(f.repite) : 'No'} ›</span><select class="overlay" data-on="unidad">${opt('', 'No se repite', f.repite?.unidad)}${Object.entries(UNIDADES).map(([k, [, pl]]) => opt(k, 'Cada X ' + pl, f.repite?.unidad)).join('')}</select></div>
        ${f.repite ? `<div class="field"><label>Cada cuántos ${UNIDADES[f.repite.unidad][1]}</label><input data-input="cada" inputmode="numeric" value="${esc(cadaTxt)}"></div>` : ''}
        <div class="frow"><span>Avisar</span><span class="v">${f.avisoDias == null ? 'Solo la semana que toca' : f.avisoDias + ' días antes'} ›</span><select class="overlay" data-on="aviso">${opt('', 'Solo la semana que toca', f.avisoDias)}${avisos.map(n => opt(n, n + ' días antes', f.avisoDias)).join('')}</select></div>`
        : '<div class="small" style="padding:6px 0">Ponle fecha si quieres que se repita o que te avise con antelación.</div>'}
      <div class="field"><label>Prioridad</label>${seg('prioridad', Object.fromEntries(Object.entries(PRIORIDADES).map(([k, v]) => [k, v.n])))}</div>
      <div class="frow"><span>Icono</span><span class="v ${t ? '' : 'ph'}">${t ? `${t.icon} ${t.n}` : 'Ninguno'} ›</span><select class="overlay" data-on="tipo">${opt('', 'Ninguno', f.tipo)}${Object.entries(TIPOS).map(([k, v]) => opt(k, v.icon + ' ' + v.n, f.tipo)).join('')}</select></div>
      <textarea class="note" rows="2" placeholder="Notas..." data-input="notas">${esc(f.notas)}</textarea>
      ${isEdit ? (existing.estado === 'hecha' ? '<button class="btn ghost" style="width:100%" data-act="toggle">Volver a marcar como pendiente</button>'
        : `<button class="btn green" style="width:100%" data-act="toggle">✓ Marcar como hecha</button>${existing.repite ? '<div class="small" style="text-align:center;margin-top:6px">Se creará la siguiente con la nueva fecha.</div>' : ''}`) : ''}
      <div class="form-foot">${isEdit ? '<button class="btn ghost" data-act="del">Eliminar</button>' : ''}<button class="btn navy" data-act="save">${isEdit ? 'Guardar' : 'Crear tarea'}</button></div>`;
    },
    actions: {
      titulo: t => f.titulo = t.value, notas: t => f.notas = t.value, cada: t => cadaTxt = t.value,
      set: (t, s) => { f[t.dataset.k] = t.dataset.v; s.refresh(); },
      fecha: (t, s) => {
        f.fecha = t.value || null;
        if (!f.fecha) { f.repite = null; f.avisoDias = null; } // sin fecha no hay repetición ni aviso
        fechaEnSitio(t, s, t.value, 'Sin fecha ›');
      },
      sinFecha: (t, s) => { f.fecha = null; f.repite = null; f.avisoDias = null; s.refresh(); },
      unidad: (t, s) => { f.repite = t.value ? { cada: parseInt(cadaTxt, 10) || 1, unidad: t.value } : null; s.refresh(); },
      aviso: (t, s) => { f.avisoDias = t.value === '' ? null : +t.value; s.refresh(); },
      tipo: (t, s) => { f.tipo = t.value || null; s.refresh(); },
      save: (t, s) => {
        if (!f.titulo.trim()) return toast('Escribe la tarea');
        let repite = null;
        if (f.fecha && f.repite) {
          const cada = parseInt(cadaTxt, 10);
          if (!(cada >= 1 && cada <= 99)) return toast('Indica cada cuántos ' + UNIDADES[f.repite.unidad][1]);
          repite = { cada, unidad: f.repite.unidad };
        }
        const d = { titulo: f.titulo.trim(), ambito: f.ambito, fecha: f.fecha || null, prioridad: f.prioridad, notas: f.notas.trim(), repite, avisoDias: f.fecha ? f.avisoDias : null, tipo: f.tipo || null };
        if (isEdit) Object.assign(existing, d);
        else db.tareas.push({ id: uid(), ...d, estado: 'pendiente', creada: hoy() });
        save(); s.close(); render(); toast(isEdit ? 'Tarea guardada' : 'Tarea creada');
      },
      toggle: (t, s) => { s.close(); toggleTarea(existing); },
      del: (t, s) => {
        if (!confirm(`¿Eliminar la tarea «${existing.titulo}»?`)) return;
        db.tareas = db.tareas.filter(x => x.id !== existing.id);
        save(); s.close(); render(); toast('Tarea eliminada');
      },
    },
    // Cursor en «Tarea» solo al crear una nueva (no en cada redibujado: en iPhone sacaría el teclado una y otra vez)
    onRender: s => { if (!isEdit && !s.enfocado) { s.enfocado = true; setTimeout(() => s.el.querySelector('[data-input=titulo]')?.focus(), 300); } },
  });
}

/* ---------------- Trabajo: días libres y no laborables ----------------
   Una sola bolsa de días libres por año: vacaciones + libre disposición (vacacionesTotales, igual cada año)
   más los festivos locales y autonómicos que la empresa da ese año como días a pedir (trabajo.festivos[año]).
   Para la empresa los festivos son una cantidad de días, no fechas: se gastan el día que se quiera.
   Cada día pedido cuenta para un año ("año" de la ausencia), que puede no ser el de su fecha
   (por ejemplo, días de enero de 2027 que son de las vacaciones de 2026). Un día suelto puede ser medio día ("medio"). */
const TIPOS_AUS = {
  vacaciones: { n: 'Vacaciones', icon: '🏖️', color: '#e8659b' },
  asuntos_propios: { n: 'Libre disposición', icon: '🗓️', color: '#5b9cf0' },
  otro: { n: 'Otro (no descuenta)', icon: '📄', color: '#7a7f8c' },
};
const ESTADOS = { por_pedir: 'Por pedir', pedido: 'Pedido', aprobado: 'Aprobado', disfrutado: 'Disfrutado' };
const descuenta = a => a.tipo === 'vacaciones' || a.tipo === 'asuntos_propios';
const añoDe = a => a['año'] || +a.desde.slice(0, 4);
const aus = id => db.trabajo.ausencias.find(a => a.id === id);
// Aprobada y ya pasada cuenta sola como disfrutada (sin tocar el dato guardado)
const estadoReal = a => a.estado === 'aprobado' && a.hasta < hoy() ? 'disfrutado' : a.estado;

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher), para el Viernes Santo
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
// Días no laborables fijos de un año que caen entre semana: fiestas nacionales comunes a toda España (no se piden)
// y los días que da la empresa (24 y 31 de diciembre). No cuentan como días libres.
const NACIONALES = [['01-01', 'Año Nuevo'], ['01-06', 'Epifanía del Señor'], ['05-01', 'Fiesta del Trabajo'], ['08-15', 'Asunción de la Virgen'], ['10-12', 'Fiesta Nacional de España'], ['11-01', 'Todos los Santos'], ['12-06', 'Día de la Constitución'], ['12-08', 'Inmaculada Concepción'], ['12-25', 'Navidad']];
const EMPRESA = [['12-24', 'Nochebuena'], ['12-31', 'Nochevieja']];
const _noLab = {};
function noLaborables(y) {
  if (_noLab[y]) return _noLab[y];
  const vs = pascua(y); vs.setDate(vs.getDate() - 2);
  const l = [...NACIONALES.map(([md, n]) => [`${y}-${md}`, n, 'nacional']), [dayKey(vs), 'Viernes Santo', 'nacional'], ...EMPRESA.map(([md, n]) => [`${y}-${md}`, n, 'empresa'])]
    .filter(([f]) => { const d = parseDia(f).getDay(); return d !== 0 && d !== 6; }).sort((a, b) => a[0].localeCompare(b[0]));
  return _noLab[y] = l;
}
const esNoLaborable = f => noLaborables(+f.slice(0, 4)).some(([x]) => x === f);
// Festivos de Sevilla que la empresa da como días a pedir (locales + autonómicos que no son fiesta nacional),
// calculados para cualquier año con las reglas fijas de Sevilla y Andalucía:
// - Locales: miércoles de Feria (Domingo de Resurrección + 17) y Corpus Christi (+ 60).
// - Autonómicos: Jueves Santo, Día de Andalucía (28/2; si cae en domingo pasa al lunes, si cae en sábado se pierde)
//   y el lunes siguiente a cada fiesta nacional que caiga en domingo (Andalucía siempre las traslada).
// Comprobado con el BOJA y el calendario de la empresa: 2026 y 2027 dan 5 (2028, por ejemplo, 4).
function festivosSevilla(y) {
  const p = pascua(y), mas = n => { const d = new Date(p); d.setDate(d.getDate() + n); return dayKey(d); };
  const l = [[mas(-3), 'Jueves Santo', 'autonómico'], [mas(17), 'Miércoles de Feria', 'local'], [mas(60), 'Corpus Christi', 'local']];
  const and = new Date(y, 1, 28);
  if (and.getDay() === 0) l.push([dayKey(new Date(y, 2, 1)), 'Día de Andalucía (traslado)', 'autonómico']);
  else if (and.getDay() !== 6) l.push([dayKey(and), 'Día de Andalucía', 'autonómico']);
  for (const [md, n] of NACIONALES) {
    const d = parseDia(`${y}-${md}`);
    if (d.getDay() === 0) { d.setDate(d.getDate() + 1); l.push([dayKey(d), `${n} (traslado)`, 'autonómico']); }
  }
  return l.sort((a, b) => a[0].localeCompare(b[0]));
}
// Excepciones al cálculo: 2026 fue el año del cambio de sede de Madrid a Sevilla y la empresa dio 1 local + 2 autonómicos.
const FESTIVOS_DEFECTO = { 2026: 3 };
const festivosCalculo = y => FESTIVOS_DEFECTO[y] ?? festivosSevilla(y).length;
// Lo que se usa: el número puesto a mano en la app para ese año o, si no hay, el calculado
const festivosAño = y => db.trabajo.festivos?.[y] ?? festivosCalculo(y);

// Días laborables de un periodo: de lunes a viernes, sin fiestas nacionales ni días de empresa.
function diasLaborables(desde, hasta) {
  if (!desde || !hasta || hasta < desde) return 0;
  let n = 0;
  for (let d = parseDia(desde), g = 0; dayKey(d) <= hasta && g < 800; d.setDate(d.getDate() + 1), g++) {
    if (d.getDay() !== 0 && d.getDay() !== 6 && !esNoLaborable(dayKey(d))) n++;
  }
  return n;
}
// Días que gasta una petición (medio día = 0,5)
const diasDe = a => diasLaborables(a.desde, a.hasta) * (a.medio ? .5 : 1);
function contadorDias(y = db.trabajo['año']) {
  const fest = festivosAño(y), base = db.trabajo.vacacionesTotales || 0;
  const l = db.trabajo.ausencias.filter(a => descuenta(a) && añoDe(a) === y);
  const suma = est => l.filter(a => est.includes(estadoReal(a))).reduce((s, a) => s + diasDe(a), 0);
  const total = base + fest, disfrutados = suma(['disfrutado']), pedidos = suma(['pedido', 'aprobado']), planificados = suma(['por_pedir']);
  return { base, fest, total, disfrutados, pedidos, planificados, restantes: total - disfrutados - pedidos };
}
const rangoTxt = a => a.desde === a.hasta ? `${DAYS[parseDia(a.desde).getDay()]}, ${fmtDia(a.desde)}` : `${fmtDia(a.desde).slice(0, 5)} – ${fmtDia(a.hasta)}`;
const num = n => String(n).replace('.', ',');
const plural = (n, s, p) => `${num(n)} ${n === 1 ? s : p}`;
const diasTxt = n => n === .5 ? 'medio día' : plural(n, 'día', 'días');
// Selector de estado dentro de una fila de la vista principal (cambia sin abrir el formulario)
const estadoChip = a => { const e = estadoReal(a); return `<label class="tag chip st-${e}">${ESTADOS[e]} ▾<select data-change="estadoAus" data-id="${a.id}">${Object.entries(ESTADOS).map(([k, l]) => `<option value="${k}" ${k === e ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`; };
function ausRow(a) {
  const t = TIPOS_AUS[a.tipo] || TIPOS_AUS.otro;
  const sub = [rangoTxt(a), descuenta(a) ? diasTxt(diasDe(a)) : 'no descuenta', añoDe(a) !== +a.desde.slice(0, 4) ? `<b>de ${añoDe(a)}</b>` : ''].filter(Boolean).join(' · ');
  return `<div class="row ${estadoReal(a) === 'disfrutado' ? 'done' : ''}"><button class="rowmain" data-act="editAus" data-id="${a.id}">${ico(t)}
    <div class="main"><div class="name">${esc(a.nombre || t.n)}</div><div class="sub">${sub}</div></div></button>${estadoChip(a)}</div>`;
}
function tarjetaDias(y, compacta = false) {
  const c = contadorDias(y), pct = v => c.total ? Math.min(100, v / c.total * 100) : 0;
  return `<div class="bcard" ${compacta ? `data-act="verDias" data-y="${y}" role="button" style="cursor:pointer"` : ''}>
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="serif" style="font-size:19px">Días libres ${y}</span>${compacta ? '<span class="small">›</span>' : `<button class="small" data-act="editTotales" style="color:var(--accent)">Editar</button>`}</div>
      <div class="bar"><div style="width:${pct(c.disfrutados)}%"></div><div class="b2" style="width:${pct(c.pedidos)}%"></div></div>
      <div class="stats4"><div><b>${num(c.total)}</b><span>Totales</span></div><div><b class="green">${num(c.disfrutados)}</b><span>Disfrutados</span></div><div><b style="color:var(--warn)">${num(c.pedidos)}</b><span>Pedidos</span></div><div><b class="${c.restantes < 0 ? 'red' : ''}">${num(c.restantes)}</b><span>Restantes</span></div></div>
      ${compacta ? '' : `<div class="small" style="margin-top:8px">${num(c.base)} de vacaciones y libre disposición + ${plural(c.fest, 'festivo', 'festivos')} de la empresa.</div>`}
      ${c.planificados ? `<div class="small" style="margin-top:4px">Además tienes ${plural(c.planificados, 'día planificado', 'días planificados')} sin pedir.</div>` : ''}
    </div>`;
}

function viewTrabajo() {
  const vista = ui.vistaTrabajo || 'lista';
  const seg = `<div class="seg" style="margin:6px 0 10px">${[['lista', 'Lista'], ['mes', 'Mes'], ['año', 'Año']].map(([k, l]) => `<button class="${vista === k ? 'on' : ''}" data-act="vistaTrabajo" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (vista === 'mes') return seg + viewMes();
  if (vista === 'año') return seg + viewAñoCal();
  const y = db.trabajo['año'];
  const tareas = pendientes('trabajo');
  const ausencias = db.trabajo.ausencias.filter(a => añoDe(a) === y).sort((a, b) => a.desde.localeCompare(b.desde));
  const noLab = noLaborables(y);
  return `${seg}<div class="accrow"><button class="accsel" data-act="pickAño"><span>${y}</span>${I.down}</button></div>
    ${tarjetaDias(y)}
    <h2 class="sec">Tareas de trabajo</h2>
    ${tareas.length ? tareas.map(t => tareaRow(t)).join('') : '<div class="small" style="padding:4px 2px 8px">No tienes tareas de trabajo pendientes.</div>'}
    <h2 class="sec">Días pedidos</h2>
    <div class="small" style="margin:-4px 0 6px">Los que cuentan para ${y}, aunque caigan en otro año</div>
    ${ausencias.map(ausRow).join('')}
    <button class="addcard" data-act="newAus" style="margin-top:10px">+ Pedir días</button>
    <button class="fold" data-act="toggleNoLab">${ui.verNoLab ? '▾' : '▸'} No laborables de ${y} (${noLab.length}): no se piden</button>
    ${ui.verNoLab ? noLab.map(([f, n, k]) => `<div class="row done"><span class="ico" style="background:var(--line)">${k === 'empresa' ? '🏢' : '📅'}</span><div class="main"><div class="name">${n}</div><div class="sub">${DAYS[parseDia(f).getDay()]}, ${fmtDia(f)} · ${k === 'empresa' ? 'Lo da la empresa' : 'Fiesta nacional'}</div></div></div>`).join('') : ''}`;
}

function openAusForm(existing, preset = {}) {
  const isEdit = !!existing, y0 = db.trabajo['año'];
  const f = existing ? { ...existing, 'año': añoDe(existing), medio: !!existing.medio } : { tipo: 'vacaciones', nombre: '', desde: '', hasta: '', estado: 'por_pedir', 'año': y0, medio: false, ...preset };
  if (!TIPOS_AUS[f.tipo]) f.tipo = 'vacaciones';
  const dateRow = (k, label) => `<div class="frow"><span>${label}</span><span class="v ${f[k] ? '' : 'ph'}">${f[k] ? `${DAYS[parseDia(f[k]).getDay()]}, ${fmtDia(f[k])}` : 'Seleccionar ›'}</span><input type="date" data-valor="${f[k] || ''}" data-on="${k}"></div>`;
  // Medio día solo tiene sentido si es un único día
  const unDia = () => f.desde && (!f.hasta || f.hasta === f.desde);
  openSheet({
    cls: 'full',
    render: () => {
      const t = TIPOS_AUS[f.tipo], n = diasLaborables(f.desde, f.hasta || f.desde) * (unDia() && f.medio ? .5 : 1);
      const años = [...new Set([y0 - 1, y0, y0 + 1, f['año']])].sort();
      return `${head(isEdit ? 'Editar' : 'Pedir días')}
      <div class="frow"><span>Tipo</span><span class="v">${ico(t)} ${t.n} ›</span><select class="overlay" data-on="tipo">${Object.entries(TIPOS_AUS).map(([k, v]) => `<option value="${k}" ${k === f.tipo ? 'selected' : ''}>${v.icon} ${v.n}</option>`).join('')}</select></div>
      <div class="field"><label>Nombre (opcional)</label><input data-input="nombre" value="${esc(f.nombre)}" placeholder="Ej. Navidad en casa"></div>
      ${dateRow('desde', 'Desde')}
      ${dateRow('hasta', 'Hasta')}
      ${unDia() ? `<button class="set-row" data-act="medio"><span class="t">Medio día</span><span class="switch ${f.medio ? 'on' : ''}"></span></button>` : ''}
      ${f.desde ? `<div class="small" style="padding:8px 0">${f.hasta && f.hasta < f.desde ? '<span class="red">La fecha final es anterior a la inicial.</span>'
        : `${f.hasta ? '' : 'Sin «Hasta», será solo ese día: '}${n === .5 ? 'medio día laborable' : plural(n, 'día laborable', 'días laborables')} (sin fines de semana, fiestas nacionales ni 24 y 31 de diciembre).`}</div>` : ''}
      <div class="frow"><span>Cuenta para</span><span class="v">Días de ${f['año']} ›</span><select class="overlay" data-on="año">${años.map(a => `<option value="${a}" ${a === f['año'] ? 'selected' : ''}>Días de ${a}</option>`).join('')}</select></div>
      <div class="frow"><span>Estado</span><span class="v">${ESTADOS[f.estado]} ›</span><select class="overlay" data-on="estado">${Object.entries(ESTADOS).map(([k, l]) => `<option value="${k}" ${k === f.estado ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="form-foot">${isEdit ? '<button class="btn ghost" data-act="del">Eliminar</button>' : ''}<button class="btn navy" data-act="save">Guardar</button></div>`;
    },
    actions: {
      nombre: t => f.nombre = t.value,
      tipo: (t, s) => { f.tipo = t.value; s.refresh(); },
      estado: (t, s) => { f.estado = t.value; s.refresh(); },
      'año': (t, s) => { f['año'] = +t.value; s.refresh(); },
      medio: (t, s) => { f.medio = !f.medio; s.refresh(); },
      // «Hasta» no se rellena solo: si se guarda vacío, es un único día. Si queda antes de «Desde», se vacía.
      // Restablecer cualquiera de los dos los vacía ambos.
      desde: (t, s) => {
        f.desde = t.value; fechaEnSitio(t, s);
        if (f.hasta && (!f.desde || f.hasta < f.desde)) { f.hasta = ''; const h = s.el.querySelector('[data-on=hasta]'); if (h) fechaEnSitio(h, s, ''); }
      },
      hasta: (t, s) => {
        f.hasta = t.value; fechaEnSitio(t, s);
        if (!f.hasta && f.desde) { f.desde = ''; const d = s.el.querySelector('[data-on=desde]'); if (d) fechaEnSitio(d, s, ''); }
      },
      save: (t, s) => {
        if (!f.desde) return toast('Elige la fecha');
        const hasta = f.hasta || f.desde;
        if (hasta < f.desde) return toast('La fecha final es anterior a la inicial');
        const d = { tipo: f.tipo, nombre: f.nombre.trim(), desde: f.desde, hasta, estado: f.estado, 'año': f['año'], medio: hasta === f.desde && !!f.medio };
        if (isEdit) Object.assign(existing, d);
        else db.trabajo.ausencias.push({ id: uid(), ...d });
        save(); s.close(); render(); toast(isEdit ? 'Guardado' : 'Añadido');
      },
      del: (t, s) => {
        if (!confirm(`¿Eliminar «${existing.nombre || TIPOS_AUS[existing.tipo]?.n}»?`)) return;
        db.trabajo.ausencias = db.trabajo.ausencias.filter(a => a.id !== existing.id);
        save(); s.close(); render(); toast('Eliminado');
      },
    },
  });
}
// Días libres: vacaciones + libre disposición (igual todos los años) y festivos de la empresa del año que se está viendo.
// Si el número de festivos coincide con el calculado, no se guarda a mano: así sigue calculándose solo.
function openTotales() {
  const y = db.trabajo['año'], calc = festivosCalculo(y), lista = festivosSevilla(y);
  let v = String(db.trabajo.vacacionesTotales ?? ''), fv = String(festivosAño(y));
  openSheet({
    cls: 'full',
    render: () => `${head('Días libres', String(y))}
      <div class="field"><label>Vacaciones + libre disposición (cada año)</label><input data-input="v" inputmode="numeric" value="${esc(v)}" placeholder="Ej. 24"></div>
      <div class="field"><label>Festivos locales y autonómicos que da la empresa en ${y}</label><input data-input="fv" inputmode="numeric" value="${esc(fv)}" placeholder="Ej. 5"></div>
      <p class="small">${FESTIVOS_DEFECTO[y] != null ? `En ${y} la empresa dio ${calc} por el cambio de sede (en Sevilla serían ${lista.length}).` : `Calculados para Sevilla en ${y}: <b>${lista.length}</b>. Cámbialo solo si tu empresa da otro número (lo ves en su resumen de vacaciones).`}</p>
      ${lista.map(([f, n, k]) => `<div class="row"><div class="main"><div class="name">${esc(n)}</div><div class="sub">${DAYS[parseDia(f).getDay()]}, ${fmtDia(f)} · ${k}</div></div></div>`).join('')}
      <p class="small">Las fiestas nacionales y el 24 y 31 de diciembre no cuentan: no se piden.</p>
      <div class="form-foot"><button class="btn navy" data-act="save">Guardar</button></div>`,
    actions: {
      v: t => v = t.value, fv: t => fv = t.value,
      save: (t, s) => {
        const n = parseInt(v, 10), nf = parseInt(fv, 10);
        if (!(n >= 0 && n <= 99) || !(nf >= 0 && nf <= 20)) return toast('Número no válido');
        db.trabajo.vacacionesTotales = n;
        const fest = { ...(db.trabajo.festivos || {}) };
        if (nf === calc) delete fest[y]; else fest[y] = nf;
        db.trabajo.festivos = fest;
        save(); s.close(); render();
      },
    },
  });
}

/* ---------------- Calendario laboral (mes y año) ----------------
   Cada día se clasifica por orden: no laborable nacional o de empresa > fin de semana > días pedidos (según su estado)
   > laborable. Los festivos de Sevilla no se distinguen: son días libres más de la bolsa, que se piden como cualquier otro. */
const MONTHS_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesNombre = m => MONTHS_L[m][0].toUpperCase() + MONTHS_L[m].slice(1);
const CLASE_ESTADO = { disfrutado: 'ok', aprobado: 'ok', pedido: 'pend', por_pedir: 'plan' };
const LEYENDA = [['fin', 'Fin de semana'], ['nac', 'Fiesta nacional o de empresa'], ['ok','Aprobado o disfrutado'], ['pend', 'Pedido, sin aprobar'], ['plan', 'Planificado, sin pedir'], ['ok medio', 'Medio día']];
function infoDia(f) {
  const d = parseDia(f), finde = d.getDay() === 0 || d.getDay() === 6;
  const nl = noLaborables(d.getFullYear()).find(([x]) => x === f);
  const pedidos = db.trabajo.ausencias.filter(a => a.desde <= f && a.hasta >= f);
  let cls = '', medio = false;
  if (nl) cls = 'nac';
  else if (finde) cls = 'fin';
  else if (pedidos.length) { cls = CLASE_ESTADO[estadoReal(pedidos[0])] || 'ok'; medio = !!pedidos[0].medio; }
  return { f, d, finde, nl, pedidos, cls: cls + (medio ? ' medio' : ''), medio };
}
// En la vista mensual, los huecos de la primera y la última semana se rellenan con los días del mes anterior
// y del siguiente, en tono apagado (como el calendario de Windows). En la anual se dejan en blanco.
function gridMes(y, m, mini = false) {
  const first = new Date(y, m, 1), pad = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), h = hoy();
  const resto = (7 - (pad + n) % 7) % 7;
  const celda = (d, otro) => {
    const info = infoDia(dayKey(d));
    return `<${mini ? 'div' : 'button'} class="d ${info.cls} ${info.f === h ? 'hoy' : ''} ${otro ? 'otro' : ''}" ${mini ? '' : `data-act="dia" data-f="${info.f}"`}>${d.getDate()}</${mini ? 'div' : 'button'}>`;
  };
  let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<div class="h">${x}</div>`).join('');
  for (let i = pad; i > 0; i--) cells += mini ? '<div></div>' : celda(new Date(y, m, 1 - i), true);
  for (let i = 1; i <= n; i++) cells += celda(new Date(y, m, i), false);
  for (let i = 1; i <= resto; i++) cells += mini ? '' : celda(new Date(y, m + 1, i), true);
  return `<div class="cal ${mini ? 'mini' : ''}">${cells}</div>`;
}
const leyenda = () => `<div class="leyenda">${LEYENDA.map(([c, l]) => `<span><i class="d ${c}"></i>${l}</span>`).join('')}<span><i class="d hoy"></i>Hoy</span></div>`;
function calCursor() {
  if (ui.calY == null) { const t = new Date(); ui.calY = t.getFullYear(); ui.calM = t.getMonth(); }
  return { y: ui.calY, m: ui.calM };
}
function viewMes() {
  const { y, m } = calCursor();
  // Resumen del mes: días laborables libres (pedidos o planificados) que caen en él
  let ok = 0, pend = 0, plan = 0;
  for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) {
    const info = infoDia(dayKey(new Date(y, m, i))), c = info.cls.split(' ')[0], v = info.medio ? .5 : 1;
    if (c === 'ok') ok += v; else if (c === 'pend') pend += v; else if (c === 'plan') plan += v;
  }
  const resumen = [ok && plural(ok, 'día libre', 'días libres'), pend && `${num(pend)} sin aprobar`, plan && plural(plan, 'planificado', 'planificados')].filter(Boolean).join(' · ');
  return `<div class="calnav"><button class="iconbtn" data-act="calPrev" aria-label="Mes anterior">${I.left}</button>
      <button class="serif" data-act="calHoy" style="font-size:21px">${mesNombre(m)} <span class="red">${y}</span></button>
      <button class="iconbtn" data-act="calNext" aria-label="Mes siguiente">${I.right}</button></div>
    ${gridMes(y, m)}
    <div class="small" style="text-align:center;margin:8px 0 4px">${resumen || 'Sin días libres este mes'}</div>
    ${leyenda()}`;
}
function viewAñoCal() {
  const { y } = calCursor();
  return `<div class="calnav"><button class="iconbtn" data-act="calPrevY" aria-label="Año anterior">${I.left}</button>
      <button class="serif" data-act="calHoy" style="font-size:21px">${y}</button>
      <button class="iconbtn" data-act="calNextY" aria-label="Año siguiente">${I.right}</button></div>
    <div class="year">${MONTHS_L.map((_, m) => `<button class="mes" data-act="abrirMes" data-m="${m}"><div class="mt">${mesNombre(m)}</div>${gridMes(y, m, true)}</button>`).join('')}</div>
    ${leyenda()}`;
}
function openDia(f) {
  const info = infoDia(f);
  const lineas = [];
  if (info.nl) lineas.push(`<div class="row"><i class="d nac sw"></i><div class="main"><div class="name">${info.nl[1]}</div><div class="sub">${info.nl[2] === 'empresa' ? 'Lo da la empresa' : 'Fiesta nacional'} · no se pide</div></div></div>`);
  else if (info.finde) lineas.push(`<div class="row"><i class="d fin sw"></i><div class="main"><div class="name">Fin de semana</div></div></div>`);
  for (const a of info.pedidos) {
    const e = estadoReal(a);
    lineas.push(`<button class="row" data-act="edit" data-id="${a.id}"><i class="d ${CLASE_ESTADO[e]}${a.medio ? ' medio' : ''} sw"></i><div class="main"><div class="name">${esc(a.nombre || TIPOS_AUS[a.tipo]?.n)}</div><div class="sub">${rangoTxt(a)}${a.medio ? ' · medio día' : ''} · ${ESTADOS[e]}${descuenta(a) ? ` · días de ${añoDe(a)}` : ''}</div></div><span class="chev">›</span></button>`);
  }
  if (!lineas.length) lineas.push(`<div class="row"><i class="d sw"></i><div class="main"><div class="name">Día laborable</div></div></div>`);
  const puedePedir = !info.nl && !info.finde && !info.pedidos.length;
  openSheet({
    render: () => `${head(longDate(info.d), fmtDia(f))}${lineas.join('')}
      <div class="form-foot">${puedePedir ? '<button class="btn navy" data-act="pedir">Pedir este día</button>' : ''}</div>`,
    actions: {
      edit: (t, s) => { s.close(); const a = aus(t.dataset.id); if (a) openAusForm(a); },
      pedir: (t, s) => { s.close(); openAusForm(null, { desde: f, hasta: f }); },
    },
  });
}

/* ---------------- Hojas (sheets) — igual que en Savey ---------------- */
const sheets = [];
function openSheet({ render, actions = {}, cls = '', onRender }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="backdrop"></div><div class="sheet ${cls}"></div>`;
  document.body.appendChild(wrap);
  const s = { wrap, el: wrap.querySelector('.sheet'), actions, render, onRender, live: cls === 'full' };
  s.refresh = () => {
    const st = s.el.scrollTop; s.el.innerHTML = s.render(s); s.el.scrollTop = st;
    // Las fechas se ponen como propiedad y no como atributo value: así su valor «inicial» queda vacío y el botón
    // «Restablecer» del selector del iPhone (que vuelve al valor inicial) deja el campo vacío de verdad.
    s.el.querySelectorAll('input[type=date][data-valor]').forEach(i => { i.value = i.dataset.valor; });
    s.onRender?.(s);
  };
  s.close = () => closeSheet(s);
  wrap.querySelector('.backdrop').addEventListener('click', () => closeSheet(s));
  const handle = ev => {
    const t = ev.target.closest(ev.type === 'click' ? '[data-act]' : '[data-on]');
    if (!t || !s.el.contains(t)) return;
    const name = ev.type === 'click' ? t.dataset.act : t.dataset.on;
    if (name === 'close') return closeSheet(s);
    s.actions[name]?.(t, s, ev);
  };
  s.el.addEventListener('click', handle);
  s.el.addEventListener('change', handle);
  s.el.addEventListener('input', ev => {
    const t = ev.target.closest('[data-input]'); if (t) return s.actions[t.dataset.input]?.(t, s, ev);
    // Algunos selectores de fecha (como «Restablecer» en iPhone) solo avisan con "input": se trata igual que "change"
    const d = ev.target.closest('input[type=date][data-on]'); if (d) s.actions[d.dataset.on]?.(d, s, ev);
  });
  /* Redibujado diferido. En iPhone, al abrir el selector de un campo de fecha vacío Safari pone ya la fecha de hoy
     (y lanza "change"): si la hoja se redibujase en ese momento, el selector se cerraría solo. s.later() deja el
     redibujado para cuando el campo pierde el foco y no se está tocando la hoja (para no perder el toque en Guardar). */
  s.needsRefresh = false; s.pointer = false;
  const tryRefresh = () => setTimeout(() => {
    const a = document.activeElement;
    if (!s.needsRefresh || s.pointer || (a && s.el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    s.needsRefresh = false; if (sheets.includes(s)) s.refresh();
  }, 60);
  s.later = () => { s.needsRefresh = true; };
  s.el.addEventListener('focusout', tryRefresh);
  s.el.addEventListener('pointerdown', () => { s.pointer = true; });
  s.el.addEventListener('click', () => { s.pointer = false; tryRefresh(); });
  s.onUp = () => { if (s.pointer) setTimeout(() => { s.pointer = false; tryRefresh(); }, 300); };
  window.addEventListener('pointerup', s.onUp);
  sheets.push(s);
  s.refresh();
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return s;
}
function closeSheet(s = sheets[sheets.length - 1]) {
  if (!s) return;
  sheets.splice(sheets.indexOf(s), 1);
  if (s.onUp) window.removeEventListener('pointerup', s.onUp);
  s.wrap.classList.remove('open');
  setTimeout(() => s.wrap.remove(), 280);
}
// Cambio en un campo de fecha de una hoja: actualiza solo el texto visible de su fila y deja el resto para después
// Si el valor queda vacío (botón «Restablecer» del selector), muestra el texto de campo vacío.
function fechaEnSitio(input, s, valor = input.value, vacio = 'Seleccionar ›') {
  if (input.value !== valor) input.value = valor;
  const v = input.closest('.frow')?.querySelector('.v');
  if (v) {
    v.classList.toggle('ph', !valor);
    v.textContent = valor ? `${DAYS[parseDia(valor).getDay()]}, ${fmtDia(valor)}` : vacio;
  }
  s.later();
  // «Restablecer» en iPhone vacía el campo pero deja el calendario abierto: quitarle el foco lo cierra
  if (!valor && document.activeElement === input) setTimeout(() => input.blur(), 50);
}
const head = (title, sub = '', right = '') => `<div class="grab"></div><div class="shead"><button class="iconbtn" data-act="close">${I.close}</button><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div>${right}</div></div>`;

function pickList(title, items, current, onPick) {
  openSheet({
    render: () => `${head(title)}<div class="picklist">${items.map(([v, l]) => `<button class="${v === current ? 'on' : ''}" data-act="pick" data-v="${esc(v)}">${l}</button>`).join('')}</div>`,
    actions: { pick: (t, s) => { s.close(); onPick(t.dataset.v); } },
  });
}

/* ---------------- Configuración ---------------- */
// Versión publicada en la web (null mientras se comprueba, '' si no se puede). "?fresh" hace que el service worker no la sirva de caché.
let nuevaVersion = null;
async function comprobarVersion() {
  try {
    navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => { }); // que descargue ya la nueva si la hay
    const txt = await (await fetch('sw.js?fresh=1', { cache: 'no-store' })).text();
    nuevaVersion = txt.match(/const CACHE = '([^']+)'/)?.[1] || '';
  } catch (e) { nuevaVersion = ''; }
}
function openSettings() {
  const st = db.settings;
  nuevaVersion = null;
  comprobarVersion().then(() => sheets.forEach(x => x.live && x.refresh()));
  const sel = (key, opts) => `<select data-on="set" data-k="${key}">${Object.entries(opts).map(([k, l]) => `<option value="${k}" ${st[key] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  openSheet({
    cls: 'full',
    render: () => `${head('Configuración')}
      <div class="set-h">Apariencia</div>
      <div class="set-row"><span class="ic">☾</span><span class="t">Modo oscuro</span><span class="v">${{ light: 'Claro', dark: 'Oscuro', auto: 'Automático' }[st.theme]} ${I.down.replace('<svg', '<svg width="12" height="12"')}</span>${sel('theme', { auto: 'Automático', light: 'Claro', dark: 'Oscuro' })}</div>
      <div class="set-h">Sincronización</div>
      <button class="set-row" data-act="syncSetup"><span class="ic">⇅</span><span class="t">${sync?.token ? 'GitHub: ' + esc(sync.owner + '/' + sync.repo) : 'Sincronizar entre dispositivos'}<div class="small">${esc(syncStatus())}</div></span>›</button>
      ${sync?.token ? `<button class="set-row" data-act="syncNow"><span class="ic">⟳</span><span class="t">Sincronizar ahora</span></button>
        <button class="set-row" data-act="monthly"><span class="ic">🗓</span><span class="t">Copias mensuales en GitHub<div class="small">${sync.lastSnapshot ? 'Última: ' + esc(sync.lastSnapshot) : 'Se hará en la próxima sincronización'}</div></span>›</button>` : ''}
      <button class="set-row" data-act="gastosSetup"><span class="ic">€</span><span class="t">${gastosCfg?.token ? 'Gastos: ' + esc(gastosCfg.owner + '/' + gastosCfg.repo) : 'Conectar gastos de Savey'}<div class="small">${gastosCfg?.token ? 'Solo lectura' + (gastos ? ' · actualizado ' + haceTxt(gastos.actualizado) : '') : 'Desactivado'}</div></span>›</button>
      <div class="set-h">Datos</div>
      <button class="set-row" data-act="backup"><span class="ic">☁︎</span><span class="t">Exportar copia de seguridad<div class="small">Descarga un archivo con todo${st.lastBackup ? ' · última: ' + longDate(new Date(st.lastBackup)) : ''}</div></span>›</button>
      <button class="set-row" data-act="restore"><span class="ic">⤓</span><span class="t">Restaurar copia de seguridad</span>›</button>
      <button class="set-row" data-act="reset"><span class="ic">⟲</span><span class="t">Restablecer datos</span>›</button>
      <div class="set-h">Acerca de</div>
      <div class="set-row"><span class="ic">ⓘ</span><span class="t">Versión de la app<div class="small">${nuevaVersion === null ? 'Comprobando si hay una más nueva…' : nuevaVersion && nuevaVersion !== APP_VERSION
        ? `<span class="red">Hay una versión nueva (${esc(fmtVersion(nuevaVersion))}). Cierra la app del todo y vuelve a abrirla.</span>` : nuevaVersion ? 'Es la última publicada' : 'Sin conexión: no se puede comprobar'}</div></span><span class="v">${fmtVersion(APP_VERSION)}</span></div>
`,
    actions: {
      set: (t, s) => { st[t.dataset.k] = t.value; save(); s.refresh(); render(); },
      syncSetup: () => openSyncSetup(),
      syncNow: (t, s) => { const p = syncNow(); s.refresh(); p.then(() => toast(sync?.lastError ? 'Error al sincronizar' : 'Sincronizado')); },
      monthly: () => openMonthlyBackups(),
      backup: (t, s) => exportBackup().then(() => s.refresh()),
      restore: () => pickFile('.json,application/json', restoreBackup),
      reset: (t, s) => {
        if (!confirm(sync?.token ? 'Se borrarán TODOS los datos, también en GitHub y en el resto de dispositivos sincronizados. ¿Seguro?' : 'Se borrarán TODOS los datos de este dispositivo. ¿Seguro?')) return;
        if (!confirm('Última confirmación: ¿has hecho una copia de seguridad? Esta acción no se puede deshacer.')) return;
        db = { ...defaultDB(), settings: db.settings }; save(); s.close(); render(); toast('Datos restablecidos');
      },
    },
  });
}

/* ---------------- Copias de seguridad (como en Savey) ---------------- */
function pickFile(accept, cb) {
  const inp = $('#filepick'); inp.value = ''; inp.accept = accept;
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(String(r.result), f.name); r.readAsText(f, 'utf-8'); };
  inp.click();
}
async function shareOrDownload(text, name, mime) {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return true;
}
const backupJson = () => JSON.stringify({ app: 'panel', exportedAt: new Date().toISOString(), ...db }, null, 1);
async function exportBackup() {
  const ok = await shareOrDownload(backupJson(), `panel-${hoy()}.json`, 'application/json');
  if (ok) { db.settings.lastBackup = new Date().toISOString(); save(); render(); toast('Copia de seguridad creada'); }
}
function restoreBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return alert('El archivo no es una copia válida.'); }
  if (data.app !== 'panel' || !Array.isArray(data.tareas)) return alert('El archivo no es una copia de Panel.');
  data.caducidades = data.caducidades || [];
  if (!confirm(`La copia tiene ${data.tareas.length + data.caducidades.length} tareas. Se REEMPLAZARÁN los datos actuales. ¿Continuar?`)) return;
  delete data.app; delete data.exportedAt;
  const settings = db.settings;
  db = data; normalize(); db.settings = { ...db.settings, theme: settings.theme }; save();
  sheets.slice().forEach(closeSheet); render(); toast('Copia restaurada');
}
function backupBanner() {
  if (!db.tareas.length && !db.trabajo.ausencias.length) return '';
  if (sync?.token) {
    // Con sincronización, GitHub ya guarda una copia de todo (y su historial): solo avisar si lleva días sin sincronizar
    const ls = sync.lastSync ? new Date(sync.lastSync) : null;
    if (ls && Date.now() - ls.getTime() < 7 * 864e5) return '';
    if (!ls && !sync.lastError) return '';
    return `<button class="banner" data-act="settings">⚠️ <span>${ls ? 'No se sincroniza con GitHub desde el ' + longDate(ls).toLowerCase() + '.' : 'No se ha podido sincronizar con GitHub.'}${sync.lastError ? ' ' + esc(sync.lastError) + '.' : ''} <b>Toca para revisarlo.</b></span></button>`;
  }
  const lb = db.settings.lastBackup ? new Date(db.settings.lastBackup) : null;
  if (lb && Date.now() - lb.getTime() < 30 * 864e5) return '';
  return `<button class="banner" data-act="backup">💾 <span>${lb ? 'Hace más de un mes de tu última copia de seguridad.' : 'Aún no has hecho ninguna copia de seguridad.'} <b>Toca para hacerla ahora.</b></span></button>`;
}

/* ---------------- Acciones de la vista principal ---------------- */
const mainActions = {
  tab: t => { ui.tab = t.dataset.tab; render(); window.scrollTo(0, 0); if (ui.tab === 'gastos') cargarGastos(); },
  gastosSetup: () => openGastosSetup(),
  gastosRefresh: () => cargarGastos(true),
  settings: () => openSettings(),
  backup: () => exportBackup(),
  filtroTareas: t => { ui.filtroTareas = t.dataset.f; render(); },
  toggleCompletadas: () => { ui.verCompletadas = !ui.verCompletadas; render(); },
  toggleTarea: t => { const x = tarea(t.dataset.id); if (x) toggleTarea(x); },
  editTarea: t => { const x = tarea(t.dataset.id); if (x) openTareaForm(x); },
  editAus: t => { const a = aus(t.dataset.id); if (a) openAusForm(a); },
  newAus: () => openAusForm(null),
  toggleNoLab: () => { ui.verNoLab = !ui.verNoLab; render(); },
  vistaTrabajo: t => { ui.vistaTrabajo = t.dataset.v; render(); },
  calPrev: () => { calCursor(); if (--ui.calM < 0) { ui.calM = 11; ui.calY--; } render(); },
  calNext: () => { calCursor(); if (++ui.calM > 11) { ui.calM = 0; ui.calY++; } render(); },
  calPrevY: () => { calCursor(); ui.calY--; render(); },
  calNextY: () => { calCursor(); ui.calY++; render(); },
  calHoy: () => { const d = new Date(); ui.calY = d.getFullYear(); ui.calM = d.getMonth(); render(); },
  abrirMes: t => { ui.calM = +t.dataset.m; ui.vistaTrabajo = 'mes'; render(); window.scrollTo(0, 0); },
  dia: t => openDia(t.dataset.f),
  verDias: t => { if (db.trabajo['año'] !== +t.dataset.y) { db.trabajo['año'] = +t.dataset.y; save(); } ui.tab = 'trabajo'; render(); window.scrollTo(0, 0); },
  editTotales: () => openTotales(),
  pickAño: () => {
    const y = new Date().getFullYear(), cur = db.trabajo['año'];
    const años = [...new Set([y - 1, y, y + 1, cur])].sort();
    pickList('Año', años.map(a => [String(a), String(a)]), String(cur), v => { db.trabajo['año'] = +v; save(); render(); });
  },
};
const changeActions = {
  estadoAus: t => { const a = aus(t.dataset.id); if (!a) return; a.estado = t.value; save(); render(); toast(ESTADOS[t.value]); },
};
document.addEventListener('click', ev => {
  if (ev.target.closest('.sheet-wrap')) return;
  if (ev.target.closest('#fab')) return tabOf(ui.tab).fab?.();
  const t = ev.target.closest('[data-act]');
  if (t) mainActions[t.dataset.act]?.(t, ev);
});
document.addEventListener('change', ev => {
  if (ev.target.closest('.sheet-wrap')) return;
  const t = ev.target.closest('[data-change]');
  if (t) changeActions[t.dataset.change]?.(t, ev);
});

function applyTheme() {
  const th = db.settings.theme;
  if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  const dark = th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#17181c' : '#f3eeeb';
}

/* ---------------- Sincronización con un repositorio privado de GitHub (copiado y adaptado de Savey) ----------------
   La configuración (con el token) se guarda aparte y nunca entra en las copias de seguridad.
   Nunca se escribe en el repositorio de Savey: se rechaza "savey-data" y cualquier datos.json que no sea de Panel. */
const SYNC_KEY = 'panel.sync';
const SYNC_FILE = 'datos.json';
const BACKUP_DIR = 'copias';
let sync = null;
try { sync = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { }
let syncing = false, syncAgain = false, syncTimer = null;
const saveSyncCfg = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) { } };
const deviceName = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Windows/.test(navigator.userAgent) ? 'Windows' : 'navegador';

const b64enc = s => {
  const bytes = new TextEncoder().encode(s); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64dec = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));

// Lo que se sube a GitHub: los datos, sin los ajustes locales del dispositivo
const syncPayload = d => ({ version: 1, caducidades: d.caducidades, tareas: d.tareas, trabajo: d.trabajo, deleted: d.deleted || {} });
const esDePanel = d => d && Array.isArray(d.caducidades) && Array.isArray(d.tareas) && d.trabajo && Array.isArray(d.trabajo.ausencias);
// Representación ordenada por id, para comparar contenidos sin que importe el orden
function canon(d) {
  const p = syncPayload(d), byId = l => [...(l || [])].sort((a, b) => a.id < b.id ? -1 : 1);
  const { ausencias, ...cab } = p.trabajo || {};
  return JSON.stringify({ c: byId(p.caducidades), t: byId(p.tareas), w: cab, a: byId(ausencias), d: Object.keys(p.deleted).sort().map(k => [k, p.deleted[k]]) });
}
// Combina registro a registro: gana la versión modificada más recientemente; los borrados se respetan.
// La cabecera de Trabajo (año, días totales) gana entera según su "u".
function mergeData(L, R) {
  const del = { ...(R.deleted || {}) };
  for (const [id, t] of Object.entries(L.deleted || {})) del[id] = Math.max(del[id] || 0, t);
  const dead = r => del[r.id] && del[r.id] >= (r.u || 0);
  const mergeList = (ll = [], rl = []) => {
    const rm = new Map(rl.map(r => [r.id, r])), seen = new Set(), res = [];
    for (const l of ll) {
      const r = rm.get(l.id); seen.add(l.id);
      const pick = r && (r.u || 0) > (l.u || 0) ? r : l;
      if (!dead(pick)) res.push(pick);
    }
    for (const r of rl) if (!seen.has(r.id) && !dead(r)) res.push(r);
    return res;
  };
  const Lt = L.trabajo || {}, Rt = R.trabajo || {};
  const { ausencias: _a, ...cab } = (Rt.u || 0) > (Lt.u || 0) ? Rt : Lt;
  return { ...L, caducidades: mergeList(L.caducidades, R.caducidades), tareas: mergeList(L.tareas, R.tareas), trabajo: { ...cab, ausencias: mergeList(Lt.ausencias, Rt.ausencias) }, deleted: del };
}

async function gh(path, opts = {}, cfg = sync) {
  return fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`, {
    ...opts, cache: 'no-store',
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
}
function ghError(res) {
  if (res.status === 401) return 'El token no es válido o ha caducado';
  if (res.status === 403) return 'El token no tiene permiso de escritura en el repositorio';
  if (res.status === 404) return 'No se encuentra el repositorio (revisa usuario, nombre y permisos del token)';
  return 'Error de GitHub ' + res.status;
}
async function getFile(path, cfg = sync) {
  const r = await gh(`/contents/${path}`, {}, cfg);
  if (r.status === 404) return { sha: null, text: null };
  if (!r.ok) throw new Error(ghError(r));
  const j = await r.json();
  let b64 = j.content;
  if (!b64 || j.encoding === 'none') { // archivos de más de 1 MB
    const b = await gh(`/git/blobs/${j.sha}`, {}, cfg);
    if (!b.ok) throw new Error(ghError(b));
    b64 = (await b.json()).content;
  }
  return { sha: j.sha, text: b64dec(b64) };
}
async function pullRemote(cfg = sync) {
  const { sha, text } = await getFile(SYNC_FILE, cfg);
  if (text === null) return { sha, data: null };
  const data = JSON.parse(text);
  if (!esDePanel(data)) throw new Error('El datos.json del repositorio no es de Panel. Revisa que el repositorio sea panel-data');
  return { sha, data };
}

/* Copia mensual: la primera sincronización de cada mes guarda en copias/AAAA-MM.json
   una copia completa (como la de "Copia de seguridad"). Nunca se sobrescribe. */
async function monthlySnapshot() {
  const d = new Date(), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (sync.lastSnapshot === key) return;
  const res = await gh(`/contents/${BACKUP_DIR}/${key}.json`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Copia mensual ${key} (desde ${deviceName})`, content: b64enc(backupJson()) }),
  });
  // 422 = ya existe (la hizo otro dispositivo este mes): también vale
  if (res.ok || res.status === 422) sync.lastSnapshot = key;
  else throw new Error('No se pudo guardar la copia mensual: ' + ghError(res));
}
function openMonthlyBackups() {
  let files = null, error = null;
  const monthName = n => { const m = n.match(/^(\d{4})-(\d{2})/); return m ? `${mesNombre(+m[2] - 1)} ${m[1]}` : n; };
  const s = openSheet({
    cls: 'full',
    render: () => `${head('Copias mensuales', 'En GitHub · ' + esc(sync.repo) + '/' + BACKUP_DIR)}
      <p class="small">Cada mes, la primera vez que se sincroniza, se guarda una copia completa. Restaurar una copia reemplaza los datos actuales en todos tus dispositivos.</p>
      ${error ? `<div class="empty-state">⚠️ ${esc(error)}</div>` : files === null ? '<div class="empty-state">Cargando…</div>' : !files.length ? '<div class="empty-state">Aún no hay copias mensuales.</div>' :
        files.map(f => `<button class="row" data-act="restore" data-path="${esc(f.path)}"><span class="ico" style="background:var(--line)">🗓️</span><div class="main"><div class="name">${esc(monthName(f.name))}</div><div class="sub">${Math.max(1, Math.round(f.size / 1024))} KB</div></div><span class="chev">›</span></button>`).join('')}`,
    actions: {
      restore: async t => {
        try {
          toast('Descargando copia…');
          const { text } = await getFile(t.dataset.path);
          if (text === null) throw new Error('La copia ya no existe');
          restoreBackup(text);
        } catch (e) { alert(e.message || String(e)); }
      },
    },
  });
  gh(`/contents/${BACKUP_DIR}`).then(async r => {
    if (r.status === 404) files = [];
    else if (!r.ok) error = ghError(r);
    else files = (await r.json()).filter(f => f.type === 'file' && f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name));
  }).catch(e => error = e.message).finally(() => sheets.includes(s) && s.refresh());
}
function applyRemote(newDb) {
  const changed = canon(newDb) !== canon(db);
  db = { ...newDb, settings: db.settings }; normalize(); saveRaw();
  return changed;
}
function scheduleSync(delay = 1500) {
  if (!sync?.token) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, delay);
}
async function syncNow() {
  clearTimeout(syncTimer); syncTimer = null;
  if (!sync?.token || !navigator.onLine) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true; let changed = false;
  try {
    for (let attempt = 0; ; attempt++) {
      const { sha, data } = await pullRemote();
      if (data) changed = applyRemote(mergeData(db, data)) || changed;
      if (data && canon(data) === canon(db)) break; // la nube ya está al día
      const res = await gh(`/contents/${SYNC_FILE}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `Cambios desde ${deviceName}`, content: b64enc(JSON.stringify(syncPayload(db))), ...(sha ? { sha } : {}) }),
      });
      if (res.ok) break;
      if ((res.status === 409 || res.status === 422) && attempt < 3) continue; // otro dispositivo subió algo a la vez: reintentar
      throw new Error(ghError(res));
    }
    sync.lastSync = new Date().toISOString(); sync.lastError = null;
    await monthlySnapshot();
  } catch (e) {
    sync.lastError = e.message || String(e);
  } finally {
    syncing = false; saveSyncCfg();
    if (changed) render(); else sheets.forEach(s => s.live && s.refresh());
    if (syncAgain) { syncAgain = false; scheduleSync(300); }
  }
}
function syncStatus() {
  if (!sync?.token) return 'Desactivada';
  if (syncing) return 'Sincronizando…';
  if (sync.lastError) return '⚠️ ' + sync.lastError;
  if (!sync.lastSync) return 'Pendiente';
  const m = Math.round((Date.now() - new Date(sync.lastSync)) / 60000);
  return 'Sincronizado ' + (m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : longDate(new Date(sync.lastSync)));
}
function openSyncSetup() {
  const f = { owner: sync?.owner || '', repo: sync?.repo || 'panel-data', token: sync?.token || '' };
  let busy = false;
  openSheet({
    cls: 'full',
    render: () => `${head('Sincronización')}
      <p class="small">Tus datos se guardan en un repositorio <b>privado</b> de tu cuenta de GitHub, y todos los dispositivos conectados ven lo mismo. Cada cambio queda en el historial del repositorio, así que también sirve de copia de seguridad.</p>
      <div class="field"><label>Usuario de GitHub</label><input data-input="owner" value="${esc(f.owner)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field"><label>Repositorio privado</label><input data-input="repo" value="${esc(f.repo)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field"><label>Token</label><input data-input="token" type="password" value="${esc(f.token)}" placeholder="github_pat_…" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <p class="small">El token se guarda solo en este dispositivo y no se incluye en las copias de seguridad. Usa uno distinto del de Savey, con acceso solo a este repositorio.</p>
      <div class="form-foot">${sync?.token ? '<button class="btn ghost" data-act="off">Desconectar</button>' : ''}<button class="btn navy" data-act="connect">${busy ? 'Conectando…' : sync?.token ? 'Guardar' : 'Conectar'}</button></div>`,
    actions: {
      owner: t => f.owner = t.value.trim(), repo: t => f.repo = t.value.trim(), token: t => f.token = t.value.trim(),
      off: (t, s) => {
        if (!confirm('¿Desconectar este dispositivo? Los datos se quedan aquí y en GitHub, pero dejarán de sincronizarse.')) return;
        sync = null; localStorage.removeItem(SYNC_KEY); s.close(); render();
      },
      connect: async (t, s) => {
        if (busy) return;
        if (!f.owner || !f.repo || !f.token) return toast('Rellena los tres campos');
        if (/^savey/i.test(f.repo)) return alert('Ese es el repositorio de Savey. Panel usa su propio repositorio (panel-data) y nunca escribe en el de Savey.');
        const cfg = { owner: f.owner, repo: f.repo, token: f.token };
        busy = true; s.refresh();
        try {
          const r = await gh('', {}, cfg);
          if (!r.ok) throw new Error(ghError(r));
          const info = await r.json();
          if (!info.private) throw new Error('El repositorio es PÚBLICO. Hazlo privado (Settings → General → Change visibility) antes de guardar tus datos en él.');
          const { data } = await pullRemote(cfg);
          const n = d => d.caducidades.length + d.tareas.length + d.trabajo.ausencias.length;
          if (data && n(data)) {
            const replace = confirm(`En GitHub ya hay datos (${data.tareas.length + data.caducidades.length} tareas y ${data.trabajo.ausencias.length} días y festivos).\n\nAceptar: usar los de GitHub y descartar los de este dispositivo (${n(db)} registros). Recomendado si este no es tu dispositivo principal.\n\nCancelar: combinar ambos.`);
            if (replace) { db = { ...data, settings: db.settings }; normalize(); saveRaw(); }
          }
          sync = { ...cfg, lastSync: null, lastError: null }; saveSyncCfg();
          busy = false; s.close();
          await syncNow(); render();
          toast(sync.lastError ? 'Error al sincronizar' : 'Sincronización activada');
        } catch (e) {
          busy = false; s.refresh(); alert(e.message || String(e));
        }
      },
    },
  });
}

/* ---------------- Gastos: resumen de Savey (solo lectura) ----------------
   Lee datos.json del repositorio privado de Savey (savey-data) con su propio token de solo lectura.
   Nunca escribe en él: aquí solo hay peticiones GET. Se guarda en el dispositivo el último resumen calculado
   (no los movimientos) para poder verlo sin conexión. Ni el token ni el resumen entran en copias ni en la sincronización. */
const GASTOS_KEY = 'panel.gastos', GASTOS_CACHE = 'panel.gastos.resumen';
let gastosCfg = null, gastos = null, gastosCargando = false, gastosError = null;
try { gastosCfg = JSON.parse(localStorage.getItem(GASTOS_KEY)); } catch (e) { }
try { gastos = JSON.parse(localStorage.getItem(GASTOS_CACHE)); } catch (e) { }
const eur = c => `${c < 0 ? '−' : ''}${(Math.abs(c) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const mesActual = () => dayKey(new Date()).slice(0, 7);
const esDeSavey = d => d && Array.isArray(d.transactions) && Array.isArray(d.categories);

// Calcula el resumen del mes en curso a partir de los datos de Savey (importes en céntimos, como en Savey)
function resumirSavey(s) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const enMes = t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; };
  const catS = id => s.categories.find(c => c.id === id) || {};
  let inc = 0, exp = 0; const porCat = {};
  for (const t of s.transactions) {
    if (!enMes(t)) continue;
    if (t.type === 'income') inc += t.amount;
    else if (t.type === 'expense') { exp += t.amount; porCat[t.cat] = (porCat[t.cat] || 0) + t.amount; }
  }
  const b = s.budgets || {}, modo = b.mode || 'none';
  const presupuesto = modo === 'income' ? inc : modo === 'fixed' ? (b.general || 0) : null;
  const top = Object.entries(porCat).sort((a, b2) => b2[1] - a[1]).slice(0, 5).map(([id, total]) => {
    const c = catS(id); return { nombre: c.name || '¿?', icon: c.icon || '❔', color: c.color || '#7a7f8c', total, limite: (b.cats || {})[id] || null };
  });
  const rec = (s.recurring || []).filter(r => r.next).map(r => {
    const c = catS(r.cat), tr = r.type === 'transfer';
    return { nombre: tr ? 'Transferencia' : c.name || '¿?', icon: tr ? '🔁' : c.icon || '❔', color: tr ? '#5b8def' : c.color || '#7a7f8c', tipo: r.type, importe: r.amount, fecha: dayKey(new Date(r.next)), nota: r.note || '' };
  }).sort((a, b2) => a.fecha.localeCompare(b2.fecha)).slice(0, 5);
  return { mes: mesActual(), inc, exp, presupuesto, modo, top, nCats: Object.keys(porCat).length, rec, actualizado: new Date().toISOString() };
}
async function leerSavey(cfg) {
  try {
    const { text } = await getFile('datos.json', cfg);
    if (text === null) throw new Error('El repositorio de Savey aún no tiene datos.json (activa la sincronización en Savey)');
    const s = JSON.parse(text);
    if (!esDeSavey(s)) throw new Error('El datos.json de ese repositorio no es de Savey');
    return s;
  } catch (e) { throw new Error(String(e.message || e).replace('permiso de escritura', 'permiso de lectura')); }
}
async function cargarGastos(force = false) {
  if (!gastosCfg?.token || gastosCargando || !navigator.onLine) return;
  if (!force && gastos?.mes === mesActual() && Date.now() - new Date(gastos.actualizado) < 5 * 60000) return;
  gastosCargando = true; gastosError = null; if (ui.tab === 'gastos') render();
  try {
    gastos = resumirSavey(await leerSavey(gastosCfg));
    try { localStorage.setItem(GASTOS_CACHE, JSON.stringify(gastos)); } catch (e) { }
  } catch (e) { gastosError = e.message || String(e); }
  finally { gastosCargando = false; if (ui.tab === 'gastos') render(); }
}
const haceTxt = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `el ${fmtDia(dayKey(new Date(iso)))}`; };

function viewGastos() {
  if (!gastosCfg?.token) return `<div class="empty-state">Aquí verás el resumen de gastos de Savey: lo gastado este mes frente al presupuesto, las categorías principales y los próximos recurrentes.<br><br>Panel solo lee los datos de Savey; nunca los modifica.</div>
    <button class="btn navy" style="width:100%" data-act="gastosSetup">Conectar con Savey</button>`;
  const estado = gastosCargando ? 'Actualizando…' : gastosError ? `⚠️ ${esc(gastosError)}` : gastos ? `Actualizado ${haceTxt(gastos.actualizado)}` : '';
  const cab = `<div class="accrow"><span class="serif" style="font-size:21px">${mesNombre(new Date().getMonth())} <span class="red">${new Date().getFullYear()}</span></span>
    <button class="small" data-act="gastosRefresh" style="color:var(--accent)">⟳ Actualizar</button></div>
    <div class="small" style="margin:-8px 0 10px">${estado}</div>`;
  if (!gastos) return cab + (gastosCargando ? '<div class="empty-state">Cargando datos de Savey…</div>' : '');
  const g = gastos, viejo = g.mes !== mesActual();
  const pct = g.presupuesto ? g.exp / g.presupuesto : 0, queda = (g.presupuesto || 0) - g.exp;
  const hoyD = new Date(), diasMes = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0).getDate();
  const tarjeta = `<div class="bcard">
      <div class="small">Gastado este mes</div>
      <div class="serif" style="font-size:30px;margin:2px 0 4px">${eur(g.exp)}</div>
      ${g.presupuesto !== null ? `<div class="bar ${pct > 1 ? 'over' : pct > .85 ? 'warn' : ''}" style="position:relative"><div style="width:${Math.min(pct, 1) * 100}%"></div><span class="ritmo" style="left:${hoyD.getDate() / diasMes * 100}%"></span></div>
        <div class="brow"><span>de ${eur(g.presupuesto)} ${g.modo === 'income' ? '(según ingresos)' : ''}</span><span class="${queda < 0 ? 'red' : 'green'}">${queda < 0 ? 'Te pasas ' + eur(-queda) : 'Quedan ' + eur(queda)}</span></div>
        <div class="small" style="margin-top:4px">La rayita marca el día del mes (${hoyD.getDate()} de ${diasMes}).</div>`
      : '<div class="small">No tienes presupuesto general en Savey.</div>'}
      <div class="small" style="margin-top:8px">Ingresos del mes: <b class="green">${eur(g.inc)}</b></div>
    </div>`;
  const top = g.top.length ? g.top.map(c => `<div class="row">${ico(c)}<div class="main"><div class="name">${esc(c.nombre)} <span class="muted">(${g.exp ? Math.round(c.total / g.exp * 100) : 0}%)</span></div>
      ${c.limite ? `<div class="bar ${c.total > c.limite ? 'over' : c.total > c.limite * .85 ? 'warn' : ''}" style="margin:5px 0 0;height:5px"><div style="width:${Math.min(c.total / c.limite, 1) * 100}%"></div></div><div class="sub">${eur(c.total)} de ${eur(c.limite)}</div>` : ''}</div>
      <div class="amt">${eur(c.total)}</div></div>`).join('') : '<div class="small" style="padding:4px 2px 8px">Sin gastos este mes.</div>';
  const rec = g.rec.length ? g.rec.map(r => { const n = diasHasta(r.fecha); return `<div class="row">${ico(r)}<div class="main"><div class="name">${esc(r.nombre)}</div><div class="sub">${fmtDia(r.fecha)} · ${n < 0 ? 'pendiente de apuntar' : textoDias(n)}${r.nota ? ' · ' + esc(r.nota) : ''}</div></div>
      <div class="amt ${r.tipo === 'income' ? 'green' : ''}">${r.tipo === 'income' ? '+' : ''}${eur(r.importe)}</div></div>`; }).join('') : '<div class="small" style="padding:4px 2px 8px">No tienes recurrentes en Savey.</div>';
  return `${cab}${viejo ? `<div class="banner">Este resumen es de ${mesNombre(+g.mes.slice(5) - 1).toLowerCase()}. Actualiza para ver el mes en curso.</div>` : ''}
    ${tarjeta}
    <h2 class="sec">Categorías principales${g.nCats > 5 ? ` <span class="small">(5 de ${g.nCats})</span>` : ''}</h2>${top}
    <h2 class="sec">Próximos recurrentes</h2>${rec}
    <p class="small" style="margin-top:18px">Solo lectura: Panel nunca modifica tus datos de Savey.</p>`;
}
function openGastosSetup() {
  const f = { owner: gastosCfg?.owner || sync?.owner || '', repo: gastosCfg?.repo || 'savey-data', token: gastosCfg?.token || '' };
  let busy = false;
  openSheet({
    cls: 'full',
    render: () => `${head('Gastos de Savey')}
      <p class="small">Panel lee el <b>datos.json</b> del repositorio privado de Savey para mostrar el resumen de gastos. <b>Nunca escribe en él.</b></p>
      <div class="field"><label>Usuario de GitHub</label><input data-input="owner" value="${esc(f.owner)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field"><label>Repositorio de Savey</label><input data-input="repo" value="${esc(f.repo)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field"><label>Token de solo lectura</label><input data-input="token" type="password" value="${esc(f.token)}" placeholder="github_pat_…" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <p class="small">Crea un token nuevo con acceso solo a savey-data y permiso <b>Contents: Read-only</b>. No uses el de Savey ni el de panel-data. Se guarda solo en este dispositivo.</p>
      <div class="form-foot">${gastosCfg?.token ? '<button class="btn ghost" data-act="off">Desconectar</button>' : ''}<button class="btn navy" data-act="connect">${busy ? 'Conectando…' : gastosCfg?.token ? 'Guardar' : 'Conectar'}</button></div>`,
    actions: {
      owner: t => f.owner = t.value.trim(), repo: t => f.repo = t.value.trim(), token: t => f.token = t.value.trim(),
      off: (t, s) => {
        if (!confirm('¿Desconectar los gastos de Savey en este dispositivo? Se borra el token y el último resumen guardado aquí.')) return;
        gastosCfg = null; gastos = null; gastosError = null; localStorage.removeItem(GASTOS_KEY); localStorage.removeItem(GASTOS_CACHE); s.close(); render();
      },
      connect: async (t, s) => {
        if (busy) return;
        if (!f.owner || !f.repo || !f.token) return toast('Rellena los tres campos');
        const cfg = { owner: f.owner, repo: f.repo, token: f.token };
        busy = true; s.refresh();
        try {
          const r = await gh('', {}, cfg);
          if (!r.ok) throw new Error(ghError(r).replace('permiso de escritura', 'permiso de lectura'));
          if (!(await r.json()).private) throw new Error('Ese repositorio es PÚBLICO. Tus datos de Savey deberían estar en un repositorio privado.');
          const datos = await leerSavey(cfg);
          gastosCfg = cfg; try { localStorage.setItem(GASTOS_KEY, JSON.stringify(cfg)); } catch (e) { }
          gastos = resumirSavey(datos); gastosError = null; try { localStorage.setItem(GASTOS_CACHE, JSON.stringify(gastos)); } catch (e) { }
          busy = false; s.close(); ui.tab = 'gastos'; render(); toast('Gastos de Savey conectados');
        } catch (e) { busy = false; s.refresh(); alert(e.message || String(e)); }
      },
    },
  });
}

/* ---------------- Arranque ---------------- */
load();
render();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (syncTimer) syncNow(); return; } // sube lo pendiente antes de que iOS congele la app
  render(); // al volver a la app, recalcula los días restantes
  syncNow();
  if (ui.tab === 'gastos') cargarGastos();
});
window.addEventListener('online', () => syncNow());
syncNow();
if (ui.tab === 'gastos') cargarGastos();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
