# MEMORY.md — Finanzas
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resumí o borrá lo que ya no aporte.

## Estado actual (v6.0 · septiembre 2026)
- En producción en Vercel. Secciones: Resumen, Movimientos, Dólares, Ahorro, Análisis, Importar y Ajustes.
- Los 33 hallazgos de `docs/auditoria-skills.md` (backend, frontend y diseño) están implementados y mergeados en `main`.
- Últimos cambios: barras móviles sólidas para iOS y vuelta del verde/rojo en montos y confirmaciones.
- Ingresos USD de Movimientos permiten repartir mediano/largo (columnas P y Q de `Transacciones`), igual que la compra de USD. Filas viejas sin reparto: el excedente va a mediano, como antes.
- `typecheck` y `lint` limpios, y 40 tests de Vitest en verde (cálculos, validaciones, seguridad).
- CI en GitHub Actions: `CI Back` (typecheck + Vitest) y `CI Front` (typecheck + lint + build), cada uno se saltea si el PR no toca sus archivos. Pensado para proteger `main` (Vercel despliega producción desde ahí).
- ESLint configurado con `next/core-web-vitals` en `.eslintrc.js` (sin hallazgos al activarlo).

## Decisiones (y por qué)
- Google Sheets como base de datos: es uso personal, gratis y editable a mano.
- Los ajustes (nombre, TNA de Mercado Pago, días de tarjeta) viven sólo en la hoja `Config`: Vercel resetea el filesystem y las env vars equivalentes se ignoran a propósito.
- `ALLOWED_EMAILS` es obligatoria y se rechequea en cada request: sacar un email corta el acceso al instante.
- Caché en memoria por instancia (3 min datos, 2 min config): alcanza para un solo usuario. No se migró a `revalidateTag`.
- Montos como float redondeados con `roundMoney`, no como enteros en centavos.
- Montos en verde (entra) y rojo (sale), siempre con signo o flecha. Se probó en neutro y se revirtió a pedido.
- No se migra el stack (Next 14 / React 18 / Tailwind 3) aunque las skills apunten a versiones nuevas.

- `.gitignore` ignora todo `*.json` salvo excepciones explícitas, para no subir credenciales. Sumar un JSON necesario se pregunta antes (regla en `AGENTS.md`). Por eso ESLint va en `.eslintrc.js`.
- `*.tsbuildinfo` fuera del repo: es caché de compilación.

## Aprendizajes y errores a evitar
- `outline-none` de Tailwind pisaba el anillo de foco: usar `.form-input` y `:focus-visible`.
- `toISOString()` corre el día a la noche en Argentina: usar `hoyLocal()`.
- Tragarse errores de Sheets mostraba "sin movimientos" y encima lo cacheaba.
- Regresión de v3.3: una página de `(app)` devolvía `null` en vez de su vista. Revisarlas al tocar el routing.

## Pendientes / a revisar
- Probar en el navegador el bloque "Destino del ahorro" de Movimientos (320px, desktop y teclado): no se pudo sin credenciales.

## Próximos pasos
- (vacío por ahora)