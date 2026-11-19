# Nora

App personal (antes «Panel») para tener a mano las tareas, lo que caduca (ITV, DNI, seguros, garantías…), las listas, el trabajo y los gastos (Savey). Es una *web app instalable* (PWA) y funciona sin conexión. Por dentro sigue llamándose `panel`: la dirección (`honoriux.github.io/panel/`) y los repositorios (`panel`, `panel-data`) no cambian.

**Cambio de nombre en el iPhone:** iOS solo lee el nombre y el icono al añadir la app, así que para ver «Nora» con el dibujo nuevo hay que volver a instalarla. Ojo: al eliminar una app de la pantalla de inicio, iOS borra también sus datos del dispositivo. Antes, abre la app con conexión para que sincronice y apunta tus dos tokens (el de `panel-data` y el de `savey-data`). Después: mantén pulsado el icono → *Eliminar app* → *Eliminar de la pantalla de inicio*, vuelve a añadirla desde Safari (Compartir → *Añadir a pantalla de inicio*) y conecta de nuevo **Configuración → Sincronizar entre dispositivos** y **Configuración → Savey**. Todo vuelve desde GitHub; solo se pierden los ajustes del dispositivo, como el modo oscuro. En Windows basta con cerrar y abrir la app (como mucho, desinstalarla y volver a instalarla desde Edge o Chrome; los datos se mantienen si al desinstalar no marcas borrar los datos).

**Tus datos se guardan solo en tus dispositivos.** Lo que se publica en internet es únicamente la app, sin ningún dato tuyo.

## Carpetas

| Carpeta | Qué es | ¿Se publica? |
|---|---|---|
| `app/` | La app (HTML, CSS, JS, iconos) | **Sí**, solo esta |
| `tools/` | Generador de iconos | No |
| `.github/workflows/pages.yml` | Publica `app/` en GitHub Pages en cada cambio | — |

## 1. Publicar la app (una sola vez)

1. En GitHub crea un repositorio **público** llamado `panel` y sube esta carpeta (sin datos: el `.gitignore` ya los deja fuera).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada vez que subas cambios en `app/`, se publica sola en `https://honoriux.github.io/panel/` (lo ves en la pestaña **Actions**).

## 2. Instalarla

- **iPhone:** abre la dirección en **Safari** → **Compartir** → **Añadir a pantalla de inicio**. Ábrela siempre desde el icono: el icono y Safari guardan los datos por separado.
- **Windows:** ábrela en Edge o Chrome → icono de instalar en la barra de direcciones (o menú **⋯ → Aplicaciones → Instalar**).

## 3. Sincronizar iPhone y Windows

Igual que en SaveyCustom: los datos se guardan en un repositorio **privado** de tu GitHub y todos los dispositivos conectados ven lo mismo. Cada cambio queda en el historial del repositorio.

**Una sola vez:**
1. **Crea el repositorio privado.** En GitHub: **+ → New repository**, nombre `panel-data`, marca **Private** y pulsa **Create repository**.
2. **Crea el token** (uno nuevo, no reutilices el de Savey):
   1. Tu foto → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   2. *Token name*: `panel`. *Expiration*: la más larga que te deje.
   3. *Repository access*: **Only select repositories** → `panel-data`.
   4. *Permissions → Repository permissions → Contents*: **Read and write**.
   5. Pulsa **Generate token** y copia el `github_pat_…`. Solo se muestra una vez.

**En cada dispositivo** (empieza por el que tenga los datos buenos):
1. ⚙️ **Configuración → Sincronizar entre dispositivos**.
2. Escribe tu usuario de GitHub, `panel-data` y el token, y pulsa **Conectar**.
3. En el segundo dispositivo te preguntará si quieres usar los datos de GitHub: **Aceptar** para quedarte con los del primero, **Cancelar** para combinar ambos.

A partir de ahí, la app sube los cambios unos segundos después de cada uno y descarga los del otro dispositivo cada vez que la abres. Si cambias algo sin conexión, se sincroniza al recuperarla. Si cambias cosas en los dos a la vez, se combinan sin perder nada: gana la modificación más reciente de cada registro.

La app se niega a conectar si el repositorio es público, si es el de Savey (`savey-data`) o si su `datos.json` no es de Panel, para no pisar nunca los datos de Savey.

**Copias mensuales:** la primera sincronización de cada mes guarda una copia completa en `panel-data/copias/AAAA-MM.json`, que nunca se sobrescribe. Para volver a una: ⚙️ **Configuración → Copias mensuales en GitHub**. Reemplaza los datos en todos tus dispositivos.

Cuando el token caduque verás un aviso en Inicio y en Configuración. Crea uno nuevo y pégalo en el mismo sitio.

## 4. Gastos (Savey)

La pestaña **Gastos** es Savey entero: su Inicio para apuntar con el botón **+**, y en el menú **☰** de arriba a la izquierda el resto de pantallas (Línea temporal, Ideas, Cuentas) y Recurrente, Editar cuentas y Categorías. Desliza a los lados para cambiar de mes y toca el mes para volver al actual. Sus datos siguen en `savey-data`, aparte de los de Panel.

**Una sola vez**, crea un token para Savey en Panel: [Fine-grained tokens → Generate new token](https://github.com/settings/personal-access-tokens/new), nombre `panel-savey`, *Only select repositories* → `savey-data`, *Contents*: **Read and write**. (También vale el que usa SaveyCustom.) El token de solo lectura `panel-gastos` ya no hace falta: puedes borrarlo en GitHub.

**En cada dispositivo:** ⚙️ **Configuración → Savey → Sincronizar entre dispositivos**, con tu usuario, `savey-data` y ese token. Como en Panel aún no hay movimientos, se descargan los de GitHub tal cual. El token se queda solo en el dispositivo.

En **Configuración → Savey** están también la moneda y demás preferencias, las copias mensuales, la copia de seguridad y restaurar (los mismos archivos que SaveyCustom) y exportar o importar CSV.

**Cuentas que no son tu dinero** (préstamos y similares): en la cuenta, desactiva **Es mi dinero**. Las transferencias entre tus cuentas (por ejemplo, de la principal a la remunerada) no cuentan como ingreso ni gasto; lo que pasas a una cuenta que no es tuya cuenta como gasto, y lo que te llega de ella, como ingreso. Salen en Inicio e Ideas como «→ Préstamo» o «← Préstamo». El valor neto suma todas las cuentas: si te prestan dinero, esa cuenta queda en negativo y el valor neto no sube. Edita las cuentas desde Panel: SaveyCustom no conoce esta opción.

SaveyCustom puede seguir instalada mientras pruebas: las dos sincronizan con `savey-data` y no se pisan ni duplican los recurrentes. Cuando lo tengas claro, puedes borrarla del iPhone.

## 5. Avisos por WhatsApp

Cada día a la hora que elijas (por defecto, las 7:00 de España) te llega un WhatsApp con las tareas de hoy, las vencidas y las que se acercan, **solo si hay algo**. Lleva únicamente títulos y fechas, nunca notas. Lo envía una GitHub Action de `panel-data` (`.github/workflows/avisos.yml` y `scripts/`) con [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/).

La hora y cuándo salen las tareas con aviso y las vencidas se eligen en ⚙️ **Configuración → Avisos por WhatsApp**: *Todos los días*, *Hitos* (al entrar en su aviso, a 7 días y a 1 día; las vencidas, el día siguiente y cada lunes) o *Personalizado*. Las de hoy salen siempre. Las tareas sin fecha salen al final del mensaje los lunes, y también se puede elegir cada día o nunca.

**Una sola vez:**
1. Si no tienes ya tu `apikey` de CallMeBot: añade a tus contactos el número que indica su web, mándale por WhatsApp el mensaje de activación que pone allí y te contestará con tu `apikey`.
2. En GitHub, en `panel-data`: **Settings → Secrets and variables → Actions → New repository secret**, y crea dos:
   - `CALLMEBOT_PHONE`: tu número con prefijo y sin espacios ni `+`, por ejemplo `34600000000`.
   - `CALLMEBOT_APIKEY`: tu `apikey`.
3. Pruébalo: **Actions → Avisos por WhatsApp → Run workflow → Run workflow**. Te llega el mensaje de hoy marcado como «(prueba)», aunque no haya nada. Si desmarcas «Enviar», solo lo muestra en el registro sin mandarlo.

GitHub lo lanza cada hora con unos minutos de retraso; si un envío falla, lo reintenta cada hora ese mismo día. Si al final no se ha podido enviar (o no se ha llegado a ejecutar), Panel lo dice con un aviso ⚠️ en Inicio y en Configuración → Avisos por WhatsApp. El motivo está en el registro de **Actions** de `panel-data` (por ejemplo, si faltan los Secrets o CallMeBot rechazó el mensaje). Cada aviso guarda su resultado en `avisos-estado.json`, así que `panel-data` tiene un commit automático al día.

## 6. Google Calendar

Cada hora (en la misma ejecución que los avisos), `panel-data` sincroniza con tu Google Calendar:
- **Nora → Google:** los días libres (vacaciones, libre disposición y otros, con su estado: «(pedido)», «(por pedir)») y las tareas pendientes con fecha aparecen en un calendario propio llamado **Nora**, como eventos de día completo. Lo pasado no sale. Solo títulos y fechas, nunca notas. Ese calendario lo lleva Nora: lo que cambies o crees allí a mano se sobrescribe o se borra.
- **Google → Nora:** los eventos que se repiten **cada año** de un calendario aparte «Cumpleaños» pasan a Nora como tareas periódicas 🎂 con aviso 7 días antes (salen en Inicio y en el WhatsApp). Si cambias el nombre o el día en Google, se actualiza; si lo quitas de Google, se quita de Nora; si lo borras en Nora, no vuelve. Cámbialos en Google, no en Nora.

Los cambios tardan como mucho una hora en llegar (si tienes prisa: **Actions → Google Calendar → Run workflow**).

**Una sola vez (unos 15 minutos):**
1. **Proyecto de Google Cloud:** en [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto (por ejemplo, `nora`).
2. **Activa la API:** *APIs y servicios → Biblioteca →* **Google Calendar API** → *Habilitar*.
3. **Cuenta de servicio** (el «usuario robot» de Nora): *IAM y administración → Cuentas de servicio → Crear cuenta de servicio*, nombre `nora`, sin roles → *Listo*. Ábrela → *Claves → Agregar clave → Crear clave nueva → JSON*: se descarga un archivo. Copia también su correo (`nora@….iam.gserviceaccount.com`).
4. **Calendario «Nora»:** en [Google Calendar](https://calendar.google.com) (en el ordenador) → *Otros calendarios → + → Crear calendario* → «Nora». En su *Configuración y uso compartido*: *Compartir con determinadas personas → Añadir* el correo de la cuenta de servicio con permiso **Hacer cambios en eventos**. Más abajo, en *Integrar el calendario*, copia el **ID del calendario**.
5. **Cumpleaños:** el calendario «Cumpleaños» de Google sale de Contactos y la cuenta de servicio no puede verlo (tampoco compartiendo tu calendario principal: probado). Crea otro calendario, por ejemplo «Cumples», compártelo con la cuenta de servicio con permiso **Ver todos los detalles de los eventos**, copia su ID y apunta en él cada cumpleaños como evento de día completo que se repite **cada año**.
6. **Secrets** en `panel-data` (*Settings → Secrets and variables → Actions → New repository secret*):
   - `GOOGLE_SA_KEY`: el **contenido entero** del archivo JSON descargado.
   - `GCAL_NORA`: el ID del calendario «Nora».
   - `GCAL_CUMPLES`: el ID del calendario de cumpleaños (acaba en `@group.calendar.google.com`).
7. Pruébalo: **Actions → Google Calendar → Run workflow**. En el registro verás cuántos eventos ha creado y cuántos cumpleaños ha traído. Después **borra el archivo JSON** de Descargas (la clave ya está en los Secrets).
8. En el iPhone, en el widget o la app de Google Calendar, comprueba que el calendario «Nora» está marcado para que se vea.

Si Google no te deja crear la clave en el paso 3 (aviso de una «política de la organización»), cuéntamelo y lo vemos.

## 7. No perder los datos

- Con la sincronización activada, GitHub ya guarda todo y su historial. Inicio solo te avisa si lleva más de una semana sin sincronizar.
- Cuando quieras una copia a mano (o sin sincronización): ⚙️ **Configuración → Exportar copia de seguridad** genera un `panel-AAAA-MM-DD.json` con todo. Guárdalo en iCloud Drive. Si hace más de un mes de la última, Inicio te lo recuerda. Para pasarlo a otro dispositivo: **Restaurar copia de seguridad**.
- **No borres la app de la pantalla de inicio** sin tener los datos sincronizados o una copia: al borrarla se borran sus datos.

## Qué hace (por ahora)

- **Inicio**: las tareas vencidas, las de hoy o de esta semana, las que ya han entrado en su aviso (en rojo) y las que no tienen fecha. Debajo, las listas marcadas para Inicio que tienen algo apuntado y los días libres que te quedan este año (y los del anterior, si aún te quedan).
- **Tareas**: todas juntas, también las periódicas como renovaciones y caducidades (antes estaban en una pestaña aparte). Cada una puede tener fecha, prioridad, ámbito (personal o trabajo), icono y notas, y si tiene fecha:
  - **Se repite** cada N días, semanas, meses o años: al marcarla como hecha se crea sola la siguiente (si ibas con retraso, la primera fecha que aún no ha pasado). Sirve para la ITV, el DNI o los seguros, y también para recibos o tareas periódicas.
  - **Avisar** con N días de antelación: desde entonces aparece en Inicio y con la etiqueta en rojo. Sin aviso, aparece la semana que toca.
  - Filtros: todas, personal, trabajo y «periódicas»; también puedes deslizar a izquierda o derecha para pasar de uno a otro. Toca el círculo para completarla; las completadas quedan plegadas.
- **Listas**: para lo que no es una tarea pero no quieres olvidar (la compra, lo que pedir por AliExpress, ideas de regalos…). Crea las listas que quieras, con nombre e icono, y marca **Mostrar en Inicio** en las que quieras tener a mano: salen en Inicio mientras tengan algo apuntado. Dentro de una lista, escribe arriba y pulsa Intro para ir apuntando seguido; toca una cosa para ponerle una nota, moverla a otra lista o borrarla. Lo que tachas baja plegado a **Tachados** y desaparece con **Quitar tachados**. Para volver al resumen, desliza hacia la derecha, pulsa «‹ Listas» o vuelve a tocar la pestaña Listas.
- **Trabajo**:
  - Las tareas de trabajo pendientes.
  - **Días libres del año**: una sola bolsa con las vacaciones y la libre disposición (24 por defecto) más los festivos locales y autonómicos de Sevilla de ese año, que se calculan solos para cualquier año (miércoles de Feria, Corpus, Jueves Santo, Día de Andalucía y los lunes que sustituyen a fiestas nacionales en domingo): 5 en 2027, 4 en 2028… En 2026 son 3 por el cambio de sede. En **Editar** ves las fechas calculadas y puedes poner otro número si un año tu empresa da otro. Muestra totales, disfrutados, pedidos y restantes, en días laborables: no cuentan fines de semana, fiestas nacionales ni el 24 y 31 de diciembre. Una petición aprobada cuenta sola como disfrutada cuando pasa su fecha.
  - **Días pedidos**: cada petición dice para qué año cuenta («Cuenta para»), aunque caiga en otro (por ejemplo, días de enero que son del año anterior). Toca el estado para cambiarlo sin abrirla. Si pides un único día, puedes marcarlo como **medio día**: cuenta 0,5.
  - **No laborables**: las fiestas nacionales y los días de empresa del año, plegados, solo para consultar.
  - **Calendario** (selector Lista / Mes / Año): el calendario laboral con colores. Gris para el fin de semana, rojo para las fiestas nacionales y los días de empresa, verde para lo aprobado o disfrutado, amarillo para lo pedido y sin aprobar, y azul con borde discontinuo para lo planificado sin pedir. Los medios días se ven con media casilla coloreada. Hoy va marcado con un círculo. Toca un día para ver qué es y pedirlo; en la vista anual, toca un mes para abrirlo. Desliza a izquierda o derecha para cambiar de mes (o de año, en la vista anual), y toca el nombre del mes o el año para volver al actual.
- **Gastos**: Savey (ver el apartado 4).
- **Botón +**: en Inicio y Tareas crea una tarea; en Listas te pregunta en qué lista apuntar (o crea una nueva); en Gastos apunta un movimiento; en Trabajo te pregunta qué.
- **Pestañas**, de izquierda a derecha: Tareas, Listas, Inicio, Gastos y Trabajo. Al abrir la app, Inicio.

## Actualizar la app

Si cambias algo en `app/`, cambia la versión en `CACHE` de `app/sw.js` y en `APP_VERSION` de `app/app.js` (las dos iguales) a `panel-AAAA-MM-DD.N`, con la fecha del día y el nº de publicación de ese día (`.1`, `.2`…), y sube los cambios. La app se actualiza sola la siguiente vez que la abras con conexión, normalmente tras cerrarla y abrirla dos veces. Los datos no se tocan.

Para saber qué versión tienes: ⚙️ **Configuración → Acerca de**. Si ya hay una más nueva publicada, lo dice en rojo; cierra la app del todo (en el iPhone, desliza hacia arriba desde el selector de apps) y vuelve a abrirla.

Para regenerar los iconos: `python tools/generar_iconos.py`.

Para probarla en el ordenador: `python -m http.server 8766 --directory app` y abre `http://localhost:8766`.
