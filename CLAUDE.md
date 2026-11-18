# Panel — proyecto

PWA personal de Álvaro para tener centralizado lo pendiente (tareas, renovaciones y lo que caduca), el trabajo (pendientes, vacaciones y festivos) y los gastos (Savey). No es un panel para mirar a diario, salvo los gastos: se consulta cuando hace falta y avisa cuando algo se acerca.

Hermana de **SaveyCustom** (`honoriux/savey`, en `D:\Documentos\Scripts\Savey ios app`): misma arquitectura, mismo estilo de código, mismo sistema de sincronización. Antes de escribir código, lee `app.js` de Savey y reutiliza sus piezas (sync con GitHub, merge por registro, service worker, hojas/sheets, toasts) en lugar de reinventarlas. En la fase 6, Savey se integra dentro de Panel.

## Arquitectura (no cambiar sin preguntar)
- HTML + CSS + JS vanilla, sin frameworks ni build. La app está en `app/` (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/`).
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
  "trabajo": {
    "u": 0,
    "año": 2026,
    "vacacionesTotales": 24,
    "ausencias": [{ "id": "", "u": 0, "tipo": "vacaciones|festivo_local|festivo_autonomico|asuntos_propios|otro", "nombre": "", "desde": "", "hasta": "", "estado": "por_pedir|pedido|aprobado|disfrutado", "año": 2026 }]
  },
  "deleted": {}
}
```
- Tareas y caducidades están **unificadas** en `tareas`. Campos opcionales: `repite` = `null` o `{ "cada": 1, "unidad": "dias|semanas|meses|años" }` (necesita `fecha`); `avisoDias` = días de antelación con que aparece en Inicio y en los avisos (`null` = sin aviso); `tipo` = `vehiculo|documento|seguro|impuesto|garantia|suscripcion|otro` (solo icono).
- Al marcar como hecha una tarea que se repite, se crea la siguiente con id determinista `<idBase>_<nuevaFecha>`.
- `caducidades` queda siempre vacío y solo existe por compatibilidad: al cargar (y al recibir datos de otro dispositivo) cualquier caducidad se convierte en tarea con el mismo `id`.
- Fechas en `AAAA-MM-DD` (día local, sin hora, para evitar desfases UTC). Importes en céntimos, como en Savey.

## Secciones
1. **Inicio**: pendientes vencidos, de hoy, de esta semana, los que ya están dentro de su `avisoDias` y los que no tienen fecha; días libres que quedan del año.
2. **Pendientes**: tareas y renovaciones juntas, con filtro (todas, personal, trabajo, con repetición), fecha opcional, prioridad, repetición, aviso y completadas plegadas.
3. **Trabajo**: tareas de ámbito trabajo, calendario laboral (lista, mes y año) y una **bolsa única de días libres por año**. Solo datos genéricos: nada confidencial de clientes.
   - Total del año = `vacacionesTotales` (22 de vacaciones + 2 de libre disposición = 24) + los festivos locales y autonómicos de **Sevilla** de ese año que caen entre semana y no son fiesta nacional. Para Álvaro no son festivos, sino días libres más que se piden como cualquier otro: en el calendario no se distinguen.
   - Cada ausencia que descuenta (`vacaciones`, `asuntos_propios`) lleva `año`: el año de días al que cuenta, que puede no ser el de su fecha. `otro` no descuenta. Los festivos (`festivo_*`) son solo referencia: suman al total de su año y su `estado` no se usa.
   - Días laborables = lunes a viernes sin fiestas nacionales comunes de España (fijas más Viernes Santo calculado) ni los días de empresa (24 y 31 de diciembre).
   - Una ausencia aprobada cuya fecha ya pasó cuenta como disfrutada (sin cambiar el dato).
4. **Gastos**: hasta la fase 6, resumen de solo lectura de `savey-data` (token de solo lectura; nunca escribe). En la fase 6 pasa a ser Savey entero (ver abajo).

## Avisos (fase 5)
La PWA no puede avisar en segundo plano. Habrá una GitHub Action diaria en `panel-data` (`.github/workflows/avisos.yml` + script Node sin dependencias) que lea `datos.json` y envíe por **WhatsApp con CallMeBot** (`api.callmebot.com/whatsapp.php`; número y `apikey` en Secrets) las tareas vencidas, las de hoy y las que entren en su `avisoDias`. El mensaje lleva solo títulos y fechas, nunca notas: es un servicio de terceros y Álvaro ha aceptado que ese texto pase por sus servidores.

## Integración de Savey (fase 6)
- Una sola app. La pestaña **Gastos** es el **Inicio de Savey** (lo que Álvaro usa a diario: apuntar el gasto con el botón +). Un desplegable dentro de Gastos lleva al resto de pantallas de Savey (línea temporal, ideas, presupuestos, cuentas), siempre dentro de Gastos. Configuración tiene un apartado propio para Savey.
- Los datos siguen separados: Savey en `savey-data` (con su propio token de lectura y escritura) y Panel en `panel-data`. La migración es conectar `savey-data` desde la app nueva.
- La app SaveyCustom actual se mantiene instalada y funcionando hasta que la integrada esté probada.

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
4. ✅ Gastos desde `savey-data` (solo lectura).
5. ✅ Unificar tareas y caducidades.
6. Avisos diarios por WhatsApp (CallMeBot) desde `panel-data`.
7. Integrar Savey dentro de Panel.
