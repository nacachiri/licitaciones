# Licitaciones

Aplicación sencilla en **Node.js + TypeScript** que cada mañana consulta las licitaciones de la [Plataforma de Contratación del Sector Público](https://contrataciondelsectorpublico.gob.es), las filtra según tu configuración y te envía un correo HTML con las **nuevas** que cumplan los criterios.

## Cómo funciona

1. Cada día a las **08:00** (configurable) se consulta el feed oficial de datos abiertos de la Plataforma de Contratación del Sector Público (formato Atom/CODICE, sin scraping).
2. Las licitaciones se filtran según `config.json`.
3. Se genera un correo HTML limpio y se envía con Nodemailer.
4. Se registra todo en un log diario dentro de `logs/`.

> Nota: cada ejecución envía **todas** las licitaciones que cumplen los filtros, aunque ya se hubieran enviado en días anteriores. No hay deduplicación.

## Requisitos

- Node.js LTS (>= 18)
- Cuenta SMTP (por ejemplo, una contraseña de aplicación de Gmail)

## Instalación

```bash
npm install
cp .env.example .env   # editar con tus datos SMTP
```

## Configuración

### `.env`

| Variable       | Descripción                                                        |
|----------------|--------------------------------------------------------------------|
| `SMTP_HOST`    | Servidor SMTP (p. ej. `smtp.gmail.com`)                            |
| `SMTP_PORT`    | Puerto SMTP (587)                                                  |
| `SMTP_SECURE`  | `true` para TLS implícito (puerto 465), `false` para STARTTLS      |
| `SMTP_USER`    | Usuario SMTP                                                       |
| `SMTP_PASS`    | Contraseña / contraseña de aplicación                              |
| `EMAIL_FROM`   | Remitente, p. ej. `Licitaciones <no-reply@tudominio.com>`           |
| `EMAIL_TO`     | Destinatario                                                       |
| `SCHEDULE`     | Expresión cron (por defecto `0 8 * * *` = cada día a las 08:00)    |

### `config.json`

Todos los filtros son **opcionales**: si una lista está vacía, ese filtro no se aplica.

| Campo                    | Descripción                                                        |
|--------------------------|--------------------------------------------------------------------|
| `cpv`                    | Códigos CPV (5 u 8 dígitos). Coinciden si el CPV de la licitación empieza por alguno. |
| `keywords`               | Palabras clave que deben aparecer en el título (sin distinguir mayúsculas). |
| `excludeKeywords`        | Palabras clave que **no** deben aparecer en el título.             |
| `minimumBudget`          | Importe mínimo (EUR).                                              |
| `maximumBudget`          | Importe máximo (EUR) o `null`.                                     |
| `regions`                | Comunidades autónomas (coincidencia parcial, p. ej. `"Castilla"`). |
| `provinces`              | Provincias (coincidencia parcial, p. ej. `"Burgos"`).              |
| `contractTypes`          | Código de tipo de contrato tal y como aparece en el feed.          |
| `procedureTypes`         | Tipos de procedimiento: nombre (p. ej. `"Abierto"`, `"Abierto simplificado"`) o código (p. ej. `"1"`, `"9"`). |
| `contractingAuthorities` | Organismos contratantes (coincidencia parcial en el nombre).       |
| `statuses`               | Estados del expediente (p. ej. `["PUB"]`). Vacío = solo publicadas. |
| `since`                  | Fecha ISO desde la que mostrar licitaciones (p. ej. `"2026-01-01"`) o `null`. |
| `sendEmailIfEmpty`       | Si es `true`, se envía un correo aunque no haya licitaciones nuevas. |

## Uso

```bash
# Ejecutar una búsqueda manual y salir
npm run run

# Desarrollo (arranca y ejecuta inmediatamente + scheduler)
npm run dev

# Compilar
npm run build

# Producción (requiere `npm run build` antes)
npm start
```

## Persistencia

- `logs/AAAAAMMDD.log`: registro diario con inicio, fin, descargadas, filtradas, enviadas y errores.

## Notas

- Se recorren todas las páginas del feed (hasta 20 páginas ≈ 10.000 entradas) para cubrir la mayor cantidad de expedientes.
- La fuente oficial es: `https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom`
