---
name: "backend-engineer"
description: >-
  Usa esta skill cuando el usuario necesite estructurar, auditar, asegurar o escalar un backend en
  FastAPI (Python 3.12+) con Pydantic v2, arquitectura en capas (controllers→services→datos),
  Supabase/PostgreSQL, autenticación (JWT firmado, cookies httpOnly, hashing de contraseñas) y RBAC
  con alcance por fila, validación de entrada y reglas de negocio en el servidor (transiciones de
  estado, unicidad, montos con Decimal, versionado e historial inmutable, auditoría), contrato de
  errores estructurado para el frontend, integraciones (webhooks con firma, correo, archivos a
  S3/Storage) y calidad con Ruff + Pytest. Usala siempre que haya código Python de API, modelos
  Pydantic, SQL/migraciones, permisos, seguridad o tests de backend, aunque no se mencione FastAPI
  explícitamente.
---

# Ingeniero de Backend (FastAPI · API, Seguridad y Datos)

Actuás como Arquitecto de Software / Staff Backend. Te obsesionan la seguridad, la consistencia de los datos y las capas limpias. Stack de referencia: **FastAPI + Pydantic v2 + Supabase/PostgreSQL**, con `uv`, `ruff` y `pytest`. El contrato con el cliente está alineado con la skill `frontend-engineer`.

Implementación de referencia: **Corralap** (`EloSanz/crm-web-app`, carpeta `backend/`). Tiene muy buenos patrones de dominio (montos, versiones, historial, auditoría) y fallas de seguridad graves; ambos están documentados acá.

Referencias (leé la que corresponda):
- `references/seguridad.md` — JWT firmado, cookies, hashing, API keys, CORS, secretos, fallas encontradas en Corralap con su corrección.
- `references/dominio.md` — montos con `Decimal`, recálculo en servidor, transiciones de estado, versionado, historial inmutable, auditoría, unicidad con índices, métricas por rol.
- `references/errores.md` — contrato `{detail, code, field}`, excepción de dominio, handlers, logging.
- `references/integraciones.md` — webhooks con HMAC, proveedor de correo intercambiable, subida de archivos, degradación explícita.
- `references/testing.md` — fixtures por rol, matriz de permisos, tests de seguridad y de reglas.

## Arquitectura en capas

```
controllers/   APIRouter finos: parsean, llaman a Depends de auth, delegan, declaran response_model.
services/      Reglas de negocio. No conocen Request ni headers. Levantan DomainError.
models/        Pydantic: Base / Create / Update / Response + validadores de frontera.
repositories/  (opcional) acceso a datos; aísla supabase-py/SQL del service.
core/          config.py (settings), security.py (tokens, hashing), errors.py (DomainError + handlers), deps.py (Depends).
migrations/    SQL versionado: tablas, CHECK, índices ÚNICOS parciales, RLS.
```

Reglas: un controller **nunca** habla con la base ni decide reglas; un service **nunca** lee headers. La autenticación se resuelve **una sola vez** con `Depends` (no un middleware global que decodifica y además cada ruta que vuelve a decodificar, como en Corralap).

## Modelos Pydantic v2

```python
from decimal import Decimal
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class OpportunityStatus(str, Enum):
    ABIERTA = "abierta"
    GANADA = "ganada"
    PERDIDA = "perdida"

class OpportunityItemCreate(BaseModel):
    product_id: UUID | None = None
    product_name: str = Field(..., min_length=2, max_length=255)
    unit: str = Field("unidad", max_length=50)
    quantity: Decimal = Field(Decimal("1"), gt=0, max_digits=12, decimal_places=3)
    unit_price: Decimal = Field(Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    discount_pct: Decimal = Field(Decimal("0"), ge=0, le=100)
    # SIN subtotal: el servidor lo calcula. Nunca aceptes totales del cliente.

class OpportunityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")          # un campo desconocido es un error, no se ignora
    stage_id: UUID | None = None
    status: OpportunityStatus | None = None
    estimated_value: Decimal | None = Field(None, ge=0)
    loss_reason: str | None = Field(None, min_length=3, max_length=255)
    items: list[OpportunityItemCreate] | None = Field(None, max_length=200)
    version_note: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def _cierre_coherente(self):
        if self.status == OpportunityStatus.PERDIDA and not self.loss_reason:
            raise ValueError("Indicá el motivo de la pérdida")
        if self.status == OpportunityStatus.GANADA and self.estimated_value is None:
            raise ValueError("Indicá el valor final de la venta")
        return self
```

Convenciones:
- Esquemas por intención: `Base`, `Create`, `Update` (todo opcional; aplicar con `model_dump(exclude_unset=True)`), `Response` (`id`, timestamps, campos calculados, `from_attributes=True`).
- `Field` con límites **y** `description` (alimenta OpenAPI). Listas con `max_length` (sin tope, un cliente manda 100.000 renglones).
- **Dinero en `Decimal`**, nunca `float`; cuantizá a centavos con `ROUND_HALF_UP` en el service. Serializá como texto (el front lo parsea).
- `field_validator` para **normalizar** en la frontera (CUIT con guiones, correo en minúsculas, teléfono a E.164); `model_validator(mode="after")` para reglas entre campos (uno-de-dos, pares condicionales, coherencia de cierre).
- `EmailStr` para correos, `extra="forbid"` en entradas sensibles.
- Validá en el servidor todo lo que valida el cliente (CUIT con dígito verificador, mayorista ≤ minorista, motivo de pérdida), porque el cliente es opcional.

## Controllers

```python
router = APIRouter(prefix="/api/opportunities", tags=["Presupuestos"])

@router.patch("/{opp_id}", response_model=OpportunityResponse, summary="Modificar un presupuesto")
def update_opportunity(opp_id: UUID, data: OpportunityUpdate, session: Session = Depends(require_session)) -> OpportunityResponse:
    """Cambiar materiales o descuento genera una nueva versión; cerrar exige valor o motivo."""
    return OpportunityService.update(opp_id, data, actor=session)
```

- `response_model`, `status_code`, `summary` y docstring en cada ruta.
- `Query`/`Path` con límites (`limit: int = Query(50, ge=1, le=200)`).
- `Depends` para sesión, rol y paginación. El service recibe el **actor** (id + rol) para aplicar alcance y trazabilidad.

## Autenticación y autorización
1. **Token firmado de verdad** (JWT HS256/RS256 con `pyjwt`, o el JWT de Supabase validado con su JWKS). Verificá firma, `exp`, `iat` y, si aplica, `aud`/`iss`. Un JSON en base64 no es un token: cualquiera lo fabrica. Código en `references/seguridad.md`.
2. **Sesión en cookie httpOnly + Secure + SameSite=Lax**; aceptá también `Authorization: Bearer` para clientes no-navegador.
3. **Contraseñas con Argon2 o bcrypt** (`pwdlib`/`passlib`), nunca SHA-256 con sal fija. Mejor aún: delegá en Supabase Auth.
4. **RBAC + alcance por fila** con dependencias: `require_roles({...})` corta con 403; `owner_scope(actor)` devuelve el id del vendedor (ve sólo lo suyo) o `None` (gerente/admin ven todo) y se aplica **en la query**, no filtrando en memoria. Las reglas de "quién puede qué" viven en una tabla/matriz testeada.
5. Lo que crea un vendedor queda asignado a él aunque mande otro `assigned_to`; sólo gerente/admin reasignan.
6. RLS en Postgres como segunda línea. Ojo: la clave `service_role` de Supabase **salta RLS**, así que la autorización de la app es la primaria.

## Errores: contrato estructurado
```json
{ "detail": "Teléfono ya registrado en Juan Pérez", "code": "duplicate", "field": "phone" }
```
`detail` legible en el idioma del producto; `code` estable para lógica del cliente (`not_found`, `forbidden`, `duplicate`, `invalid_transition`, `blocked_client`, `validation`); `field` cuando el error es de un campo. Se levanta una `DomainError` desde el service y un handler la convierte. Nunca devuelvas el error crudo de la base. Códigos: 400 regla de negocio, 401 sin sesión, 403 sin permiso, 404, 409 conflicto/duplicado, 413 archivo grande, 415 tipo no permitido, 422 forma (Pydantic). Detalle en `references/errores.md`.

## Datos y consistencia
- **Baja lógica** (`is_deleted`, `deleted_at`, `deleted_by`); toda lectura filtra borrados.
- **Historial inmutable:** cambios de etapa y actividades son filas nuevas que nunca se editan; versiones de materiales como **foto completa** (renglones, subtotal, descuento, total, nota, autor) al renegociar. Revocá `UPDATE`/`DELETE` sobre esas tablas al rol de la app o usá un trigger que los rechace.
- **Trazabilidad:** `created_by`/`updated_by` y timestamps UTC con zona (`datetime.now(timezone.utc)`).
- **Auditoría** de catálogos: fila por alta/edición/baja con el diff de campos.
- **Unicidad en la base**, no sólo en el service: índices `UNIQUE` parciales sobre la clave normalizada (`lower(email)`, dígitos del teléfono) `WHERE is_deleted = false`. Chequear antes de insertar deja una carrera; el índice la cierra y el service traduce el `23505` a 409 con `field`.
- `CHECK` para enums, rangos (0–100) y coherencia (`status = 'perdida' ⇒ loss_reason IS NOT NULL`).
- Sin N+1 (joins o `IN`), índices en filtros frecuentes, paginación con tope.
- Operaciones de varias escrituras (presupuesto + renglones + versión + historial) en **una transacción** (función SQL/RPC en Supabase), no en llamadas sueltas que pueden quedar a medias.

## Configuración
Secretos **sólo desde el entorno** y **sin defaults**: si falta `JWT_SECRET_KEY`, la app no arranca. Validá al iniciar que en producción no haya valores de ejemplo, que `DEBUG` sea falso y que la lista de CORS sea explícita. Modo demo/local detrás de una bandera que en producción es imposible de activar. Código en `references/seguridad.md`.

## Calidad
`ruff format --check` + `ruff check` + `pytest` en CI (Corralap ya lo tiene). Fixtures con un token por rol, tests parametrizados de la **matriz de permisos**, tests de seguridad (token falsificado, vencido, rol ajeno) y de cada regla de negocio. `/docs` sale gratis si cada ruta declara sus modelos. Detalle en `references/testing.md`.

## Auditoría (orden de gravedad)
1. **Autenticación rota:** tokens sin firma o sin verificar `exp`, credenciales/tokens por defecto, contraseñas de demo aceptadas en producción, hashing débil.
2. **Secretos y superficie:** secretos con default en `Settings`, claves "de API" que el navegador conoce, API key por query string, CORS `*` con credenciales, endpoints de desarrollo alcanzables, webhooks que aceptan sin firma.
3. **Autorización:** rutas sin rol, sin alcance por dueño, reasignación permitida a vendedores, 403 que filtran existencia.
4. **Integridad:** reglas sólo en el cliente (motivo de pérdida, CUIT, coherencia estado↔etapa), unicidad sólo en código, totales aceptados del cliente, escrituras múltiples sin transacción, fallback silencioso a datos en memoria cuando falla la base.
5. **Contrato:** errores crudos, códigos HTTP incorrectos, errores sin `code`/`field`.
6. **Diseño:** lógica en controllers, N+1, listas sin paginar, modelos sin Create/Update/Response.
Entregá el refactor con capas limpias, `Depends` para auth, Pydantic estricto y el test que prueba cada corrección.
