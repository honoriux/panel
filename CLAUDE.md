# Panel — proyecto

PWA personal de Álvaro para tener centralizadas las tareas (también las periódicas: renovaciones y lo que caduca), el trabajo (pendientes, vacaciones y festivos) y los gastos (Savey). No es un panel para mirar a diario, salvo los gastos: se consulta cuando hace falta y avisa cuando algo se acerca.

Hermana de **SaveyCustom** (`honoriux/savey`, en `D:\Documentos\Scripts\Savey ios app`): misma arquitectura, mismo estilo de código, mismo sistema de sincronización. Antes de escribir código, lee `app.js` de Savey y reutiliza sus piezas (sync con GitHub, merge por registro, service worker, hojas/sheets, toasts) en lugar de reinventarlas. Desde la fase 7, Savey vive dentro de Panel en `app/savey.js`: los cambios de gastos se hacen ahí.

## Arquitectura (no cambiar sin preguntar)
- HTML + CSS + JS vanilla, sin frameworks ni build. La app está en `app/` (`index.html`, `styles.css`, `app.js`, `savey.js`, `sw.js`, `manifest.webmanifest`, `icons/`). `savey.js` se carga antes que `app.js`.
- Repo público `honoriux/panel`. Una GitHub Action (`.github/workflows/pages.yml`) publica solo `app/` en GitHub Pages (`honoriux.github.io/panel/`) en cada push a `main`. Se instala como PWA en iPhone y Windows.
- Git está instalado y autenticado en este equipo: los cambios se publican con commit + push (autor `honoriux <honoriux@users.noreply.github.com>`, configurado solo en este repo).
- Datos en `localStorage` y sincronizados con un **repo privado** de GitHub (`panel-data`, fichero `datos.json`) mediante la API de contents y un token fine-grained que se guarda solo en el dispositivo (clave aparte, nunca en copias).
- Merge como en Savey: cada registro tiene `id` y `u` (última modificación), borrados en `deleted` y gana el más reciente. Reintento ante 409/422. Copia mensual en `copias/AAAA-MM.json`.
- Comprobar que el repo de datos es privado antes de conectar (como hace Savey). Rechazar `savey-data` y cualquier `datos.json` que no sea de Panel.

## Modelo de datos (`datos.json`)
```json
{
  "version": 1,
  "caducidades": [],
  "tareas": [{ "id": "", "u": 0, "titulo": "", "ambito": "personal|trabajo", "fecha": null, "prioridad": "alta|media|baja", "estado": "pendiente|hecha", "notas": "", "creada": "",
               "repite": null, "avisoDias": null, "tipo": null }],
  "listas": [{ "id": "", "u": 0, "nombre": "", "icono": "🛒", "inicio": false, "creada": 0 }],
  "elementos": [{ "id": "", "u": 0, "lista": "", "texto": "", "nota": "", "hecho": false, "creado": 0 }],
  "trabajo": {
    "u": 0,
    "año": 2026,
    "vacacionesTotales": 24,
    "festivos": { "2026": 3 },
    "ausencias": [{ "id": "", "u": 0, "tipo": "vacaciones|asuntos_propios|otro", "nombre": "", "desde": "", "hasta": "", "estado": "por_pedir|pedido|aprobado|disfrutado", "año": 2026, "medio": false }]
  },
  "avisos": { "u": 0, "modo": "diario|hitos|personalizado", "hitos": [7, 1], "entrar": true, "vencidas": "diario|lunes|primer_dia", "hora": 7, "sinFecha": "lunes|diario|nunca" },
  "deleted": {}
}
```
- Tareas y caducidades están **unificadas** en `tareas`. Campos opcionales: `repite` = `null` o `{ "cada": 1, "unidad": "dias|semanas|meses|años" }` (necesita `fecha`); `avisoDias` = días de antelación con que aparece en Inicio y en los avisos (`null` = sin aviso); `tipo` = `vehiculo|documento|seguro|impuesto|garantia|suscripcion|otro` (solo icono).
- Al marcar como hecha una tarea que se repite, se crea la siguiente con id determinista `<idBase>_<nuevaFecha>`.
- `caducidades` queda siempre vacío y solo existe por compatibilidad: al cargar (y al recibir datos de otro dispositivo) cualquier caducidad se convierte en tarea con el mismo `id`.
- Fechas en `AAAA-MM-DD` (día local, sin hora, para evitar desfases UTC). Importes en céntimos, como en Savey.

## Secciones
Orden de las pestañas, de izquierda a derecha: Tareas, Listas, Inicio, Gastos, Trabajo (al abrir la app se muestra Inicio).
1. **Inicio**: tareas vencidas, de hoy, de esta semana, las que ya están dentro de su `avisoDias` y las que no tienen fecha; las listas con «Mostrar en Inicio» que tienen algo apuntado; días libres que quedan del año.
2. **Tareas** (en la interfaz siempre «tarea», nunca «pendiente»): todas juntas, también las periódicas (renovaciones), con filtro (todas, personal, trabajo, periódicas; deslizar a los lados cambia de filtro), fecha opcional, prioridad, repetición, aviso y completadas plegadas.
3. **Listas**: cosas sueltas que no son tareas (compra, AliExpress, regalos, amigo invisible…). Varias listas con nombre, icono y «Mostrar en Inicio» (sale en Inicio, entre Tareas y Días libres, mientras tenga algo sin tachar). Dentro: campo arriba para apuntar seguido con Intro, nota opcional, lo tachado plegado al final y «Quitar tachados». Deslizar a la derecha dentro de una lista vuelve al resumen. Sin fecha, prioridad ni aviso, y no van en el WhatsApp. `listas` y `elementos` se sincronizan registro a registro como las tareas; borrar una lista borra sus elementos.
4. **Trabajo**: tareas de ámbito trabajo, calendario laboral (lista, mes y año) y una **bolsa única de días libres por año**. Solo datos genéricos: nada confidencial de clientes.
   - Total del año = `vacacionesTotales` (22 de vacaciones + 2 de libre disposición = 24) + `trabajo.festivos[año]`: el **número** de festivos locales y autonómicos que da la empresa ese año (si no se ha puesto a mano, se calcula con `festivosSevilla(año)`: miércoles de Feria = Pascua + 17, Corpus = Pascua + 60, Jueves Santo, Día de Andalucía si no cae en sábado (domingo → lunes) y el lunes siguiente a cada fiesta nacional en domingo; comprobado con el BOJA 2026 y 2027. Excepción en `FESTIVOS_DEFECTO`: 2026 → 3, por el cambio de Madrid a Sevilla). Para la empresa son una cantidad de días, no fechas: se gastan el día que se quiera y en el calendario no se distinguen.
   - Cada ausencia que descuenta (`vacaciones`, `asuntos_propios`) lleva `año`: el año de días al que cuenta, que puede no ser el de su fecha. `otro` no descuenta. `medio: true` (solo en un único día) cuenta 0,5, como la casilla «Medio día» de la app de la empresa.
   - Los antiguos `festivo_local` / `festivo_autonomico` como fechas se eliminan al cargar (marcados en `deleted`).
   - Días laborables = lunes a viernes sin fiestas nacionales comunes de España (fijas más Viernes Santo calculado) ni los días de empresa (24 y 31 de diciembre).
   - Una ausencia aprobada cuya fecha ya pasó cuenta como disfrutada (sin cambiar el dato).
5. **Gastos**: Savey entero (ver «Savey dentro de Panel»).

## Avisos por WhatsApp
La PWA no puede avisar en segundo plano. Una GitHub Action diaria en `panel-data` (no en este repo) lee `datos.json` y envía por **WhatsApp con CallMeBot** (`api.callmebot.com/whatsapp.php`; Secrets `CALLMEBOT_PHONE` y `CALLMEBOT_APIKEY`) un único mensaje con las tareas de hoy, las vencidas y las que están dentro de su `avisoDias`, solo si hay algo. El mensaje lleva solo títulos y fechas, nunca notas: es un servicio de terceros y Álvaro ha aceptado que ese texto pase por sus servidores.
- Ficheros en `panel-data`: `.github/workflows/avisos.yml`, `scripts/avisos.mjs` (lee, decide la hora y envía) y `scripts/avisos-logica.mjs` (qué sale en el mensaje; sin dependencias, se puede probar en el navegador).
- Hora: `avisos.hora` (0–23, hora de España, por defecto 7). El cron corre cada hora (minuto 7) y el script solo sigue si en España ya es esa hora o más tarde y hoy aún no consta un aviso bueno: así cubre retrasos y ejecuciones saltadas de GitHub, y si falla lo reintenta cada hora ese día. `workflow_dispatch` = prueba (envía ya, aunque no haya nada).
- Estado: cada intento que toca se guarda en `avisos-estado.json` de `panel-data` (`{ programado: { fecha, hora, ok, detalle, intentos }, prueba: {…} }`) con el `GITHUB_TOKEN` de la Action. La app lo lee al sincronizar (solo lectura, guardado aparte en `panel.avisos.estado`) y muestra el banner ⚠️ en Inicio si el último falló o si, 2 horas después de la hora, no consta el aviso del día; el resultado se ve también en Configuración → Avisos por WhatsApp.
- `avisos.modo` (Configuración → Avisos por WhatsApp): `diario` (vencidas y dentro de aviso, cada día), `hitos` (al entrar en su aviso, a 7 y a 1 día; vencidas el día siguiente y cada lunes) o `personalizado` (`hitos` = días antes, `entrar`, `vencidas`). Las de hoy salen siempre. Las tareas sin fecha van en una sección aparte al final según `avisos.sinFecha` (por defecto `lunes`; también `diario` o `nunca`), en cualquier modo. La app y `avisos-logica.mjs` deben aplicar las mismas reglas.

## Savey dentro de Panel (fase 7)
- Una sola app. La pestaña **Gastos** es el **Inicio de Savey** (lo que Álvaro usa a diario: apuntar el gasto con el botón +). Arriba, el mes (‹ ›, tocarlo vuelve al actual, deslizar cambia de mes) y el menú **☰**, que lleva al resto de pantallas de Savey (Inicio, Línea temporal, Ideas, Cuentas) más Recurrente, Editar cuentas y Categorías, siempre dentro de Gastos. Presupuestos se quitó (no se usaba); sus datos se conservan en `savey-data` para SaveyCustom. Configuración tiene un apartado propio, **Savey**.
- `app/savey.js` es el código de SaveyCustom dentro de un cierre (`const Savey = (() => { … })()`), para que sus nombres (`db`, `ui`, `render`, `sync`…) no choquen con los de Panel. Usa las hojas (`openSheet`/`closeSheet`, con la clase `.sv`), `toast` y el tema de Panel; Panel le pide `Savey.view()`, `Savey.top()` (barra de arriba), `Savey.nuevo()` (botón +), `Savey.swipe()`, `Savey.actions` (en Gastos, las acciones de la vista son las de Savey salvo la barra de pestañas y la rueda) y los ganchos `alVolver`/`alOcultar`/`sincronizar`.
- Estilos de Savey al final de `styles.css`; los que en Panel tienen el mismo nombre y otro aspecto (`.bar`, `.bcard`, `.brow`, `.accsel`) van bajo `.sv`.
- Los datos siguen separados: Savey en `savey-data` (claves del dispositivo `panel.savey.db`, `panel.savey.sync`, `panel.savey.ui`; su propio token de **lectura y escritura**) y Panel en `panel-data`. No conecta si el repositorio es público, si es `panel-data` o si su `datos.json` no es de Savey. Al conectar sin movimientos en el dispositivo, usa directamente los de GitHub. Sus copias de seguridad y el CSV son los mismos que los de SaveyCustom.
- Cuentas: `personal` (en la interfaz «Es mi dinero»; si falta, `true`). Una transferencia entre dos cuentas personales no es ingreso ni gasto; de una personal a una que no lo es cuenta como gasto, y de una que no lo es a una personal, como ingreso (`tipoEfectivo`). En Inicio, Ideas y sus detalles se agrupan por la otra cuenta (`acc:<id>:expense|income`, «→ Préstamo» / «← Préstamo»). El valor neto suma todas las cuentas, también las que no son tuyas: un préstamo recibido deja esa cuenta en negativo y no cambia el valor neto. SaveyCustom no conoce `personal`: las cuentas se editan desde Panel.
- Los recurrentes generan sus movimientos con id determinista (`<idRecurrente>_<fecha>`): SaveyCustom y Panel pueden funcionar a la vez sobre `savey-data` sin duplicar nada.
- La app SaveyCustom actual se mantiene instalada y funcionando hasta que Álvaro dé por buena la integrada.

## Reglas de trabajo
- Responder siempre en español.
- Primero el plan, luego un cambio cada vez. Explica cada cambio en una frase.
- Todo en español de España: euros, fechas `dd/mm/aaaa`, semana empezando en lunes.
- Estilo visual coherente con Savey (mismas variables CSS y modo claro/oscuro/auto).
- Prueba en el navegador en ancho móvil y escritorio antes de dar algo por bueno. Antes de probar en `localhost`, guarda una copia de su `localStorage` y restáurala al terminar.
- La app solo envía datos a la API de GitHub. La única excepción es la Action de avisos (fase 5) con CallMeBot.
- `.gitignore`: nada de datos ni tokens en el repo de la app. La app es pública en Pages y los datos solo viven en los repos privados.
- En cada cambio publicado, cambia `CACHE` en `sw.js` y `APP_VERSION` en `app.js` (siempre iguales) a `panel-AAAA-MM-DD.N`: fecha de publicación y nº de publicación de ese día (1, 2…). La versión se ve en Configuración → Acerca de como `dd/mm/aaaa · N`.
- En iPhone, nunca redibujar una hoja mientras un campo de fecha tiene el foco (Safari pone hoy al abrir el selector y lo cierra): usar `fechaEnSitio` + `s.later()`.

## Fases
1. ✅ Esqueleto PWA + Caducidades + Inicio.
2. ✅ Tareas y Trabajo (con calendario laboral).
3. ✅ Sync con `panel-data`.
4. ✅ Gastos desde `savey-data` (solo lectura; sustituido en la fase 7).
5. ✅ Unificar tareas y caducidades.
6. ✅ Avisos diarios por WhatsApp (CallMeBot) desde `panel-data`.
7. ✅ Integrar Savey dentro de Panel (pendiente: conectar `savey-data` en cada dispositivo y retirar SaveyCustom cuando esté probada).
