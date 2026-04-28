# Holded Dashboard

Dashboard financiero para analizar y simular datos exportados desde Holded. La aplicación permite cargar un fichero `.xlsx`, consultar métricas de ingresos/gastos, revisar tablas pivote, navegar por la evolución mensual y aplicar simulaciones sobre meses futuros.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Radix UI + componentes propios en `src/components/ui`
- Recharts
- Vercel Serverless Functions en `api/`
- Vercel Blob para persistencia en producción

## Requisitos

- Node.js 22 o superior recomendado
- pnpm

## Configuración local

1. Instala dependencias:

   ```bash
   pnpm install
   ```

2. Crea el fichero de entorno:

   ```bash
   cp .env.local.example .env.local
   ```

3. Rellena las variables:

   ```env
   LOGIN=usuario
   PASSWORD=contraseña
   AUTH_SECRET=un-secreto-largo-y-aleatorio
   BLOB_READ_WRITE_TOKEN=
   ```

   `BLOB_READ_WRITE_TOKEN` es opcional en local. Si no está configurado, las funciones de almacenamiento leen y escriben en `./data`.

4. Arranca el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

   La aplicación queda disponible en `http://localhost:5173`.

También puedes usar:

```bash
make start
```

## Datos

La app espera un export de Holded en formato `.xlsx`. El fichero se descarga desde Holded siguiendo esta ruta:

```text
Holded > Analytics > Goals
```

Ese export debe tener esta estructura:

- Fila 1: título
- Fila 2: vacía
- Fila 3: `Concepte`, `Compte` y 12 columnas mensuales
- Filas siguientes: conceptos contables
- Última fila: total, ignorada durante el parseo

En local, el dataset se guarda en:

- `data/data.xlsx`: fichero original
- `data/data.json`: dataset parseado que consume el frontend

En producción, esos mismos objetos se guardan en Vercel Blob con claves estables para sobrescribir el dataset activo.

## Scripts

```bash
pnpm dev        # servidor Vite con middleware local para api/*.ts
pnpm build      # typecheck + build de producción
pnpm typecheck  # comprobación de tipos
pnpm lint       # alias de typecheck
pnpm preview    # previsualiza el build
pnpm seed       # sube data/data.xlsx a Vercel Blob y genera data.json
```

Comandos equivalentes disponibles en `Makefile`:

```bash
make install
make start
make build
make preview
make typecheck
make clean
```

## Autenticación

El login se valida contra `LOGIN` y `PASSWORD`. Si las credenciales son correctas, `api/login.ts` devuelve un token HMAC firmado con `AUTH_SECRET`.

El frontend guarda el token en `localStorage` y lo revalida con `GET /api/me`. Las rutas protegidas de API, como `POST /api/upload`, requieren cabecera:

```http
Authorization: Bearer <token>
```

## Funcionalidad principal

- Vista `Cockpit`: KPIs, alertas, rankings y gráficos de evolución.
- Vista `Pivote`: filtros y tabla pivote por cuenta/categoría.
- Vista `Timeline`: bloques mensuales con detalle.
- Simulación: edición de importes futuros, aplicación de porcentajes y export CSV.
- Snapshot de forecast: primera carga persistida en `localStorage` para comparar previsión contra datos actuales.
- Upload protegido de `.xlsx`: el servidor parsea el fichero y actualiza `data.json`.

## Estructura

```text
api/                  Funciones serverless y helpers de auth/storage
data/                 Dataset local de desarrollo
scripts/              Scripts operativos, como seed de Blob
src/components/       Layout, UI, gráficos y componentes de simulación
src/context/          Providers de autenticación y dataset
src/features/         Vistas principales de la aplicación
src/hooks/            Hooks de dominio
src/lib/              Parseo, agregación, formato, storage y utilidades
```

## Producción

Para desplegar en Vercel:

1. Configura `LOGIN`, `PASSWORD`, `AUTH_SECRET` y `BLOB_READ_WRITE_TOKEN`.
2. Ejecuta el build:

   ```bash
   pnpm build
   ```

3. Si necesitas inicializar Blob desde el fichero local:

   ```bash
   pnpm seed
   ```

`pnpm seed` requiere `BLOB_READ_WRITE_TOKEN` en `.env.local` y usa `data/data.xlsx` como origen.
