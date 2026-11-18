# Panel

App personal para tener a mano lo que caduca (ITV, DNI, seguros, garantías…), las tareas, el trabajo y un resumen de gastos de SaveyCustom. Es una *web app instalable* (PWA), hermana de SaveyCustom: misma forma de instalarse, mismo aspecto y funciona sin conexión.

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

## 4. Gastos de Savey (solo lectura)

La pestaña **Gastos** muestra el resumen del mes de SaveyCustom: lo gastado frente al presupuesto general (con una rayita que marca en qué día del mes vas), los ingresos, las 5 categorías con más gasto (con su presupuesto si lo tienen) y los 5 próximos recurrentes. Lee `datos.json` de `savey-data` y **nunca escribe en él**.

**Una sola vez**, crea un token de solo lectura (distinto de los otros dos): [Fine-grained tokens → Generate new token](https://github.com/settings/personal-access-tokens/new), nombre `panel-gastos`, *Only select repositories* → `savey-data`, *Contents*: **Read-only**.

**En cada dispositivo:** pestaña **Gastos → Conectar con Savey** (o ⚙️ **Configuración → Conectar gastos de Savey**), con tu usuario, `savey-data` y ese token. Se actualiza al abrir la pestaña (como mucho cada 5 minutos) o con **⟳ Actualizar**, y guarda el último resumen para verlo sin conexión. El token y el resumen se quedan solo en el dispositivo: no van a `panel-data` ni a las copias.

## 5. No perder los datos

- Con la sincronización activada, GitHub ya guarda todo y su historial. Inicio solo te avisa si lleva más de una semana sin sincronizar.
- Sin sincronización: ⚙️ **Configuración → Copia de seguridad** genera un `panel-AAAA-MM-DD.json` con todo. Guárdalo en iCloud Drive. Si hace más de un mes de la última, Inicio te lo recuerda. Para pasarlo a otro dispositivo: **Restaurar copia de seguridad**.
- **No borres la app de la pantalla de inicio** sin tener los datos sincronizados o una copia: al borrarla se borran sus datos.

## Qué hace (por ahora)

- **Inicio**: lo que vence en los próximos 60 días y lo ya vencido, ordenado por días restantes. En rojo lo que ya está dentro de su aviso.
  Debajo, las tareas vencidas, de esta semana o sin fecha, y los días libres que te quedan este año (y los del anterior, si aún te quedan).
- **Caducidades**: alta, edición y **Hecho / renovado**. Si se repite (cada año, cada 2 o cada N años), al marcarla se crea sola la siguiente fecha. Las hechas quedan plegadas al final.
- **Tareas**: personales y de trabajo, con filtro, fecha opcional y prioridad. Se agrupan en vencidas, hoy, esta semana, más adelante y sin fecha. Toca el círculo para completarla; las completadas quedan plegadas.
- **Trabajo**:
  - Las tareas de trabajo pendientes.
  - **Días libres del año**: una sola bolsa con las vacaciones y la libre disposición (24 por defecto, se cambia en **Editar**) más los festivos de Sevilla de ese año. Muestra totales, disfrutados, pedidos y restantes, en días laborables: no cuentan fines de semana, fiestas nacionales ni el 24 y 31 de diciembre. Una petición aprobada cuenta sola como disfrutada cuando pasa su fecha.
  - **Días pedidos**: cada petición dice para qué año cuenta («Cuenta para»), aunque caiga en otro (por ejemplo, días de enero que son del año anterior). Toca el estado para cambiarlo sin abrirla.
  - **Festivos de Sevilla** (plegados al final): **Cargar festivos de Sevilla** añade los de 2026 o 2027 que caen entre semana y no son fiesta nacional (Junta de Andalucía y Ayuntamiento de Sevilla). Cada uno muestra si ya lo has pedido o un botón **Pedir**. Borra los que tu empresa no dé; no se vuelven a cargar.
  - **No laborables**: las fiestas nacionales y los días de empresa del año, plegados, solo para consultar.
  - **Calendario** (selector Lista / Mes / Año): el calendario laboral con colores. Gris para el fin de semana, rojo para las fiestas nacionales y los días de empresa, verde para lo aprobado o disfrutado, amarillo para lo pedido y sin aprobar, y azul con borde discontinuo para lo planificado sin pedir. Hoy va marcado con un círculo. Toca un día para ver qué es y pedirlo; en la vista anual, toca un mes para abrirlo.
- **Gastos**: resumen del mes de SaveyCustom, solo lectura (ver el apartado 4).
- **Botón +**: añade lo que toca según la pestaña (en Inicio y Trabajo te pregunta qué).

## Actualizar la app

Si cambias algo en `app/`, sube en uno el número de `panel-vN` en `app/sw.js` (ahora va por `v2`) y sube los cambios. La app se actualiza sola la siguiente vez que la abras con conexión, normalmente tras cerrarla y abrirla dos veces. Los datos no se tocan.

Para regenerar los iconos: `python tools/generar_iconos.py`.

Para probarla en el ordenador: `python -m http.server 8766 --directory app` y abre `http://localhost:8766`.
