# Contrato de errores

## Forma

Toda respuesta de error tiene `detail` (texto para mostrar). Opcionalmente `code` (estable, para lógica del cliente) y `field` (para marcar un campo del formulario):

```json
{ "detail": "Teléfono ya registrado en Juan Pérez", "code": "duplicate", "field": "phone" }
```

Los 422 de Pydantic mantienen el formato estándar de FastAPI (`detail` como lista con `loc` y `msg`); el frontend toma el último elemento de `loc` como campo. Los mensajes de `ValueError` en validadores salen con el prefijo `"Value error, "`: escribilos pensando en que el cliente lo recorta.

Corralap usa sólo `detail`, y el frontend adivina el campo leyendo el principio del mensaje (`message.startsWith('DNI')`). Agregar `code`/`field` es compatible hacia atrás (el cliente viejo sigue leyendo `detail`).

## Excepción de dominio

```python
# core/errors.py
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")

class DomainError(Exception):
    def __init__(self, code: str, detail: str, *, field: str | None = None, status_code: int = 400):
        self.code, self.detail, self.field, self.status_code = code, detail, field, status_code

class NotFound(DomainError):
    def __init__(self, what: str):
        super().__init__("not_found", f"{what} no encontrado", status_code=404)

def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError):
        body = {"detail": exc.detail, "code": exc.code}
        if exc.field:
            body["field"] = exc.field
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        logger.exception("Error no controlado en %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Ocurrió un error inesperado. Probá de nuevo.", "code": "internal"})
```

El service levanta `DomainError`; nunca `HTTPException` con texto de la base. La traza completa va al log del servidor, al cliente sólo un mensaje humano.

## Tabla de códigos

| HTTP | `code` | Cuándo | Ejemplo de `detail` |
|---|---|---|---|
| 400 | `validation` | regla de negocio sobre datos válidos en forma | "Indicá el motivo de la pérdida" |
| 400 | `blocked_client` | cliente inactivo / no contactar | "Construcciones X está inactivo: no se le pueden hacer presupuestos." |
| 400 | `invalid_transition` | estado ↔ etapa incoherente | "Una etapa abierta exige estado abierta" |
| 401 | `unauthorized` | sin sesión o token inválido/vencido | "Tu sesión venció. Ingresá de nuevo." |
| 403 | `forbidden` | rol o alcance | "Este presupuesto está asignado a otro vendedor" |
| 404 | `not_found` | no existe o está dado de baja | "Presupuesto no encontrado" |
| 409 | `duplicate` | unicidad | "DNI ya registrado en Ana Gómez" |
| 409 | `conflict` | edición concurrente (si usás `updated_at`/versión como control optimista) | "Alguien modificó este presupuesto. Recargá para ver los cambios." |
| 413 | `too_large` | archivo o cuerpo excesivo | "El archivo supera 10 MB" |
| 415 | `unsupported_type` | tipo de archivo | "Sólo imágenes, PDF, Word o Excel" |
| 422 | (FastAPI) | forma inválida | lista de Pydantic |
| 503 | `unavailable` | base o proveedor externo caído | "No pudimos conectar con la base. Probá en unos minutos." |

**No filtres existencia con 403:** si un vendedor pide un presupuesto ajeno, decidí conscientemente entre 403 ("asignado a otro vendedor", útil en un equipo chico) y 404 (no revela que existe). Documentalo.

## Mensajes

En el idioma del producto (español rioplatense en Corralap), cortos, accionables, sin jerga técnica ni IDs internos. Mal: `"Presupuesto/Oportunidad con ID 3f2a… no encontrado"`. Bien: `"Presupuesto no encontrado"`.

## Logging

`logging.getLogger("app.services.opportunity")` por módulo; nivel `INFO` para eventos de negocio (cierre de venta, reasignación), `WARNING` para degradaciones (proveedor de correo caído), `ERROR`/`exception` para fallas. Incluí contexto (`opportunity_id`, `actor_id`), **nunca** tokens, contraseñas ni contenido de archivos. Un `request_id` por pedido (middleware que lo genera y lo devuelve en un header) facilita cruzar un error que reporta un usuario con el log.
