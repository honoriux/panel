# Panel — proyecto

PWA personal de Álvaro para tener centralizado lo que caduca, tareas y recordatorios, el trabajo (pendientes, vacaciones y festivos) y un resumen de gastos sacado de Savey. No es un panel para mirar a diario: se consulta cuando hace falta y avisa cuando algo se acerca.

Hermana de **SaveyCustom** (`honoriux/savey`): misma arquitectura, mismo estilo de código, mismo sistema de sincronización. Antes de escribir código, lee `app.js` de Savey y reutiliza sus piezas (sync con GitHub, merge por registro, service worker, hojas/sheets, toasts) en lugar de reinventarlas.

## Arquitectura (no cambiar sin preguntar)
- HTML + CSS + JS vanilla, sin frameworks ni build. Ficheros: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/`.
- Se publica en GitHub Pages (`honoriux.github.io/panel/`) y se instala como PWA en iPhone y Windows.
- Datos en `localStorage` y sincronizados con un **repo privado** de GitHub (`panel-data`, fichero `datos.json`) mediante la API de contents y un token fine-grained que se guarda solo en el dispositivo (clave aparte, nunca en copias).
- Merge como en Savey: cada registro tiene `id` y `u` (última modificación), borrados en `deleted` y gana el más reciente. Reintento ante 409/422. Copia mensual en `copias/AAAA-MM.json`.
- Comprobar que el repo de datos es privado antes de conectar (como hace Savey).

## Modelo de datos (`datos.json`)
```json
{
  "version": 1,
  "caducidades": [{ "id": "", "u": 0, "nombre": "ITV coche", "tipo": "vehiculo|documento|seguro|impuesto|garantia|suscripcion|otro", "fecha": "2027-03-14", "avisoDias": 30, "repite": "nunca|anual|bienal|cada_n_años", "cadaN": null, "notas": "", "hecho": false }],
  "tareas": [{ "id": "", "u": 0, "titulo": "", "ambito": "personal|trabajo", "fecha": null, "prioridad": "alta|media|baja", "estado": "pendiente|hecha", "notas": "", "creada": "" }],
  "trabajo": {
    "u": 0,
    "año": 2026,
    "vacacionesTotales": 0,
    "ausencias": [{ "id": "", "u": 0, "tipo": "vacaciones|festivo_local|festivo_autonomico|asuntos_propios|otro", "nombre": "", "desde": "", "hasta": "", "estado": "por_pedir|pedido|aprobado|disfrutado", "año": 2026 }]
  },
  "deleted": {}
}
```
Fechas en `AAAA-MM-DD` (día local, sin hora, para evitar desfases UTC). Importes en céntimos, como en Savey.

## Secciones
1. **Inicio**: lo que vence en los próximos 60 días (ordenado por días restantes, en rojo si ya está dentro de `avisoDias`), tareas con fecha vencida o para esta semana y festivos por pedir.
2. **Caducidades**: lista, alta, edición y «Hecho / renovado». Si se repite, al marcarla se crea la siguiente fecha automáticamente.
3. **Tareas**: personal y trabajo, con filtro, fecha opcional, prioridad y completadas plegadas.
4. **Trabajo**: tareas de ámbito trabajo y una **bolsa única de días libres por año**. Solo datos genéricos: nada confidencial de clientes.
   - Total del año = `vacacionesTotales` (22 de vacaciones + 2 de libre disposición = 24) + los festivos locales y autonómicos de **Sevilla** de ese año que caen entre semana y no son fiesta nacional (la empresa los da como días a pedir). Da igual de qué parte se descuente cada día.
   - Cada ausencia que descuenta (`vacaciones`, `asuntos_propios`) lleva `año`: el año de días al que cuenta, que puede no ser el de su fecha (días de enero de 2027 que son de 2026). `otro` no descuenta. Los festivos (`festivo_*`) son solo referencia: suman al total de su año y su `estado` no se usa.
   - Días laborables = lunes a viernes sin fiestas nacionales comunes de España (fijas más Viernes Santo calculado) ni los días de empresa (24 y 31 de diciembre). Los festivos de Sevilla sí cuentan como días pedidos.
   - Una ausencia aprobada cuya fecha ya pasó cuenta como disfrutada (sin cambiar el dato).
5. **Gastos (solo lectura)**: lee `datos.json` del repo de Savey (`savey-data`) con un token de solo lectura. Muestra el gasto del mes frente al presupuesto, las 5 categorías principales y los próximos recurrentes. **Nunca escribe en el repo de Savey.**

## Avisos
La PWA no puede avisar en segundo plano. Habrá una GitHub Action diaria en `panel-data` (`.github/workflows/avisos.yml` + script Node sin dependencias) que lea `datos.json` y envíe por Telegram (bot propio; token y chat id en Secrets) lo que entre en su ventana de aviso y las tareas vencidas. Se hace en una fase aparte, después de la app.

## Reglas de trabajo
- Primero el plan, luego un cambio cada vez. Explica cada cambio en una frase.
- Todo en español de España: euros, fechas `dd/mm/aaaa`, semana empezando en lunes.
- Estilo visual coherente con Savey (mismas variables CSS y modo claro/oscuro/auto).
- Prueba en el navegador en ancho móvil y escritorio antes de dar algo por bueno.
- No envíes datos a ningún sitio salvo la API de GitHub.
- `.gitignore`: nada de datos ni tokens en el repo de la app. La app es pública en Pages y los datos solo viven en el repo privado.
- Sube `CACHE` en `sw.js` en cada cambio publicado.

## Fases
1. Esqueleto PWA + Caducidades + Inicio (sin sync, `localStorage`).
2. Tareas y Trabajo.
3. Sync con `panel-data` (copiado y adaptado de Savey).
4. Gastos desde `savey-data` (solo lectura).
5. GitHub Action de avisos por Telegram.
