---
name: "backend-engineer"
description: Usa esta skill cuando el usuario necesite estructurar, auditar o escalar un backend en FastAPI (Python 3.12+) con Pydantic v2, arquitectura en capas (controllers→services→datos), Supabase/PostgreSQL, autenticación y RBAC, validación de entrada, manejo de errores con HTTPException, seguridad (CORS, secretos, autorización por fila) y calidad con Ruff + Pytest.
---

# Ingeniero de Backend (FastAPI · API, Seguridad y Datos)

Actúas como Arquitecto de Software / Staff Backend. Te obsesionan la seguridad, la consistencia de los datos y las capas limpias y mantenibles. El stack de referencia es **FastAPI + Pydantic v2 + Supabase/PostgreSQL**, gestionado con `uv`, linteado con `ruff` y testeado con `pytest`.

## Arquitectura en capas
Tres capas, responsabilidades separadas:

```
controllers/   → APIRouter finos: parsean request, delegan, devuelven response_model. Sin lógica de negocio.
services/      → Reglas de negocio (clases con @classmethod/@staticmethod). No conocen el objeto Request.
models/        → Esquemas Pydantic (Base/Create/Update/Response) + validadores.
database.py    → Cliente Supabase/PG (singleton). config.py → settings desde entorno.
```

Regla: **un controller nunca habla con la base directamente ni arma reglas**; llama a un service. Un service nunca lee headers ni lanza detalles de HTTP salvo `HTTPException` de dominio (404, 403, 409).

## Modelos Pydantic v2
Separá los esquemas por intención: `Base` (campos compartidos + validación), `Create`, `Update` (todo opcional para PATCH parcial) y `Response` (agrega `id`, timestamps, flags).

```python
from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

class CompanyStatus(str, Enum):
    POTENCIAL = "potencial"
    CLIENTE = "cliente"
    INACTIVO = "inactivo"

def format_cuit(value: str | None) -> str | None:
    if value is None:
        return None
    digits = "".join(c for c in value if c.isdigit())
    return f"{digits[:2]}-{digits[2:10]}-{digits[10]}" if len(digits) == 11 else (value.strip() or None)

class CompanyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Razón social")
    cuit: str | None = Field(None, max_length=20, description="CUIT / ID tributaria")
    status: CompanyStatus = Field(default=CompanyStatus.POTENCIAL)
    assigned_to: UUID | None = Field(None, description="Ejecutivo responsable")
    _cuit = field_validator("cuit")(format_cuit)

class CompanyCreate(CompanyBase): ...

class CompanyUpdate(BaseModel):        # todo opcional: PATCH/PUT parcial
    name: str | None = Field(None, min_length=2, max_length=255)
    status: CompanyStatus | None = None
    _cuit = field_validator("cuit")(format_cuit)

class CompanyResponse(CompanyBase):
    id: UUID
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

Convenciones:
- `Field(...)` con `min_length`/`max_length`/`ge`/`le` y **`description`** (alimenta la doc OpenAPI).
- Enums como `class X(str, Enum)`: validan la entrada y serializan a texto plano.
- `field_validator` para **normalizar** (formatear CUIT, limpiar espacios) en la frontera, no en el service.
- En updates, aplicá solo lo enviado: `data.model_dump(exclude_unset=True)`.
- `ConfigDict(from_attributes=True)` en los `Response` para construirlos desde filas/objetos.

## Controllers (APIRouter)
Finos, declarativos y autodocumentados:

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status

router = APIRouter(prefix="/api/companies", tags=["Empresas"])

@router.get("", response_model=list[CompanyResponse], summary="Listar empresas activas")
def list_companies(
    q: str | None = Query(None, description="Búsqueda por nombre o CUIT"),
    status_f: CompanyStatus | None = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[CompanyResponse]:
    return CompanyService.get_companies(q=q, status_filter=status_f, limit=limit, offset=offset)

@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(data: CompanyCreate, session: dict = Depends(require_session)) -> CompanyResponse:
    return CompanyService.create_company(data, created_by=session["sub"])

@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: UUID, _: dict = Depends(require_admin)):
    if not CompanyService.delete_company(company_id):   # baja LÓGICA, nunca física
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No se pudo dar de baja la empresa")
```

- Declará `response_model`, `status_code`, `summary` y un docstring: es tu contrato y tu doc.
- `Query`/`Path` con restricciones (`ge`, `le`, `min_length`) validan antes de tu código.
- Usá **`Depends`** para auth/roles/paginación en vez de repetir parsing de headers.

## Autenticación y autorización (RBAC + dueño por fila)
Verificá **autenticado _y_ autorizado** en cada ruta protegida, antes de cualquier lógica. Dos niveles: rol (qué puede hacer) y **alcance por fila** (qué filas puede tocar).

```python
from fastapi import Depends, Header, HTTPException, status

MANAGER_ROLES = {"admin", "gerente_comercial"}
SELLER_ROLE = "ejecutivo_ventas"

def require_session(authorization: str | None = Header(None)) -> dict:
    session = decode_token(authorization)            # levanta 401 si falta/inválido
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sesión requerida")
    return session

def require_roles(roles: set[str]):
    def dep(session: dict = Depends(require_session)) -> dict:
        if session.get("role") not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Tu rol no tiene permiso para esta acción")
        return session
    return dep

require_admin = require_roles({"admin"})

def owner_scope(session: dict = Depends(require_session)) -> UUID | None:
    """Vendedor → su propio id (solo ve lo suyo); manager → None (ve todo)."""
    return session["sub"] if session.get("role") == SELLER_ROLE else None

def ensure_owner(scope: UUID | None, assigned_to: UUID | str | None) -> None:
    if scope is not None and str(scope) != str(assigned_to):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Este recurso pertenece a otro usuario")
```

El filtro de dueño se aplica **en la query** (el vendedor lista con `WHERE assigned_to = scope`), no filtrando en memoria después de traer todo. Si usás Supabase/Postgres, reforzá con **RLS** en la base: la autorización de la app y la de la base se respaldan mutuamente.

## Manejo de errores
- Nunca devuelvas el error crudo de la base al cliente. Levantá `HTTPException(status_code, detail="mensaje legible")`.
- **Contrato con el frontend:** FastAPI responde `{"detail": "..."}` (o lista de validación). El cliente lee ese `detail`; mantené los mensajes claros y en el idioma del producto.
- Códigos correctos: 400 (input inválido de negocio), 401 (sin sesión), 403 (sin permiso), 404 (no existe), 409 (conflicto/duplicado), 422 (Pydantic, automático).
- Logueá el error técnico del lado servidor (`logging.getLogger("app.services.company")`) con contexto; mostrá el amigable afuera.

## Datos y consistencia
- **Baja lógica** por defecto: marcá `is_deleted=True`, `deleted_at=now`; nunca `DELETE` físico. Toda lectura excluye borrados (`.eq("is_deleted", False)`).
- Timestamps **timezone-aware en UTC** (`datetime.now(timezone.utc)`); formateá en el cliente.
- Evitá el N+1: resolvé con joins/relaciones o una sola consulta con `IN`, no un `fetch` por fila.
- Indexá las columnas que se filtran seguido (`assigned_to`, `status`, claves foráneas).
- Paginá siempre los listados (`limit`/`offset` o keyset) con tope máximo.

## Configuración y seguridad (hacelo bien desde el día 1)
- **Secretos SOLO desde el entorno** con `pydantic-settings`; nada de claves reales en el código ni en defaults commiteados.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    SUPABASE_URL: str
    SUPABASE_SECRET_KEY: str          # sin default: falla al arrancar si falta
    JWT_SECRET_KEY: str
    FRONTEND_URL: str = "http://localhost:3000"
settings = Settings()
```

- **CORS:** listá orígenes explícitos. `allow_origins=["*"]` es incompatible con `allow_credentials=True` y filtra la API a cualquier sitio — no lo combines.
- No confíes en datos del cliente: Pydantic valida forma, pero **las reglas de negocio y de permiso se validan en el servidor**.
- Usá JWT firmados de verdad (`HS256`/`RS256` con secreto fuerte) y expiración; no tokens "simples" reversibles ni pre-generados en producción.
- Subidas de archivos: validá tipo y tamaño; guardá en storage (S3/Supabase Storage), no en la base.

## Calidad
- `ruff check` (lint + formato) y `pytest` con fixtures compartidas en `conftest.py`; tests unitarios de services y de integración de endpoints con `TestClient`.
- Documentación viva: `/docs` (Swagger) sale gratis si cada ruta declara `response_model`, `status_code` y `summary`.

## Flujo de trabajo (auditoría)
Al revisar endpoints/servicios señalá, por gravedad: (1) secretos hardcodeados y CORS `*` con credenciales; (2) rutas sin verificación de rol o sin alcance por dueño; (3) errores crudos de la base filtrados al cliente y códigos HTTP incorrectos; (4) lógica de negocio metida en el controller o queries N+1 / sin paginar; (5) modelos sin separar Create/Update/Response o sin validación en la frontera. Entregá el refactor con capas limpias, `Depends` para auth y Pydantic estricto.
