# Seguridad

## Hallazgos en Corralap (y su corrección)

| # | Hallazgo | Evidencia | Impacto | Corrección |
|---|---|---|---|---|
| 1 | Token = `"crm_" + base64(JSON)` sin firma | `auth_controller.generate_simple_token` / `decode_simple_token` | cualquiera fabrica `{"role":"admin"}` y es admin | JWT firmado (abajo) |
| 2 | `exp` se escribe pero **nunca se verifica** | `decode_simple_token` sólo decodifica | un token robado vale para siempre | `jwt.decode(..., options={"require": ["exp", "sub"]})` |
| 3 | El frontend autoinyecta un token de admin pregenerado | `lib/api.ts getAuthHeaders` | acceso admin sin login | el cliente nunca crea credenciales; 401 → login |
| 4 | `CRM_API_KEY` con default hardcodeado y expuesta como `NEXT_PUBLIC_*` | `config.py`, `lib/api.ts` | la "clave" es pública; no protege nada | eliminarla o que la agregue sólo el servidor de Next |
| 5 | API key aceptada por query string (`?api_key=`) | `main.py` | queda en logs de proxies y en el historial | sólo header, comparada con `secrets.compare_digest` |
| 6 | CORS con `"*"` y `allow_credentials=True` | `main.py` | cualquier sitio puede leer respuestas con credenciales | orígenes explícitos desde settings |
| 7 | Credenciales de demo aceptadas por código en cualquier entorno | `supabase_service.authenticate_user` (`admin@crm.com`/`admin123`) | puerta trasera en producción | sólo con `DEMO_MODE=true`, que no puede activarse en `ENVIRONMENT=production` |
| 8 | SHA-256 con sal fija para contraseñas | `hash_password` | rompible con GPU/diccionario | Argon2id (`pwdlib`) o Supabase Auth |
| 9 | Secretos con default (`JWT_SECRET_KEY = "dev-secret…"`, claves de Supabase) | `config.py` | producción puede arrancar con el secreto de ejemplo | campos sin default + validación al iniciar |
| 10 | Webhook de WhatsApp sin validar firma si falta el secreto | `whatsapp_service` ("Sin secreto configurado, no se valida") | cualquiera inyecta mensajes | fallar cerrado: sin secreto, 503 |
| 11 | Subida sin límite de tamaño ni verificación de tipo | `upload_controller` (`content_type or "image/jpeg"`) | archivos gigantes o ejecutables en el bucket | tope de bytes + lista blanca + firma mágica |
| 12 | Fallback silencioso a datos en memoria si Supabase falla | varios services (`_mock_*`) | la app "funciona" y pierde datos sin avisar | modo mock sólo por bandera explícita; si la base falla, 503 |

## Configuración que no arranca insegura

```python
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"          # development | test | production
    DEBUG: bool = False
    DEMO_MODE: bool = False

    SUPABASE_URL: str                          # sin default: si falta, no arranca
    SUPABASE_SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]   # en .env como JSON: CORS_ORIGINS=["https://app.ejemplo.com"]
    WHATSAPP_APP_SECRET: str = ""

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def _secret_fuerte(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY debe tener al menos 32 caracteres")
        return v

    @model_validator(mode="after")
    def _produccion_segura(self):
        if self.ENVIRONMENT == "production":
            if self.DEBUG or self.DEMO_MODE:
                raise ValueError("DEBUG y DEMO_MODE deben estar apagados en producción")
            if "*" in self.CORS_ORIGINS or any("localhost" in o for o in self.CORS_ORIGINS):
                raise ValueError("CORS_ORIGINS en producción debe listar sólo dominios reales")
        return self

settings = Settings()
```

Generá secretos con `python -c "import secrets; print(secrets.token_urlsafe(48))"`. `.env.example` documenta cada variable **sin** valores reales.

## JWT firmado

```python
# core/security.py
from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt  # PyJWT
from pydantic import BaseModel

class Session(BaseModel):
    sub: UUID
    role: str
    name: str | None = None

def create_access_token(user_id: UUID, role: str, name: str | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "role": role, "name": name, "iat": now,
               "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Session:
    data = jwt.decode(
        token, settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],        # lista fija: nunca aceptar "none" ni el alg que diga el token
        options={"require": ["exp", "iat", "sub"]},
        leeway=30,
    )
    return Session(sub=data["sub"], role=data["role"], name=data.get("name"))
```

El rol dentro del token es una **caché**: si un admin cambia el rol o desactiva a un usuario, el token viejo sigue diciendo lo anterior hasta vencer. Para acciones sensibles (gestión de usuarios) releé el usuario de la base, o usá vencimientos cortos + refresh token.

Con Supabase Auth: validá el JWT de Supabase con `jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")` (o el secreto HS256 del proyecto si usa el esquema legado) y leé el rol de tu tabla de usuarios.

## Dependencias de sesión y rol

```python
# core/deps.py
from fastapi import Cookie, Depends, Header, HTTPException, status

def require_session(authorization: str | None = Header(None), session_cookie: str | None = Cookie(None, alias="session")) -> Session:
    token = session_cookie or (authorization[7:] if authorization and authorization.startswith("Bearer ") else None)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sesión requerida")
    try:
        return decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Tu sesión venció. Ingresá de nuevo.")
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")

def require_roles(*roles: str):
    def dep(session: Session = Depends(require_session)) -> Session:
        if session.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Tu rol no tiene permiso para esta acción")
        return session
    return dep

MANAGERS = ("admin", "gerente_comercial")
require_admin = require_roles("admin")
require_manager = require_roles(*MANAGERS)

def owner_scope(session: Session) -> UUID | None:
    return session.sub if session.role == "ejecutivo_ventas" else None
```

Aplicá `require_session` a nivel de router (`APIRouter(dependencies=[Depends(require_session)])`) para que una ruta nueva no nazca pública por olvido; las públicas (salud, login, webhook) van en un router aparte.

## Login con cookie

```python
@router.post("/login", response_model=UserResponse)
def login(credentials: LoginRequest, response: Response) -> UserResponse:
    user = AuthService.authenticate(credentials.email, credentials.password)   # mismo mensaje si no existe o si la clave falla
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Correo o contraseña incorrectos")
    response.set_cookie("session", create_access_token(user.id, user.role, user.full_name),
                        httponly=True, secure=settings.ENVIRONMENT != "development", samesite="lax",
                        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
    return user

@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie("session", path="/")
```

Limitá intentos de login por IP y por correo (p. ej. `slowapi` o un contador en Redis/tabla) para frenar fuerza bruta. `SameSite=Lax` + cuerpo JSON cubre CSRF en la mayoría de los casos; si hay formularios `application/x-www-form-urlencoded` con efectos, agregá token CSRF.

## Contraseñas

```python
from pwdlib import PasswordHash      # uv add "pwdlib[argon2]"
password_hash = PasswordHash.recommended()   # Argon2id

hashed = password_hash.hash(plain)
ok = password_hash.verify(plain, hashed)
```

Nunca loguees contraseñas ni tokens. Si alguna vez hubo hashes débiles, re-hasheá al próximo login exitoso.

## Claves y comparaciones

- Una clave que conoce el navegador no autentica nada. Si necesitás una clave entre servidores (Next → FastAPI), que la agregue el servidor de Next y el backend la compare con `secrets.compare_digest(given, expected)`.
- Sólo por header; nunca por query string.

## CORS

```python
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type", "Authorization"])
```

Si el front llama al mismo origen vía rewrite (`/api/*` → backend), CORS ni siquiera entra en juego: preferilo.

## RLS como segunda línea

```sql
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendedor_ve_lo_suyo ON crm_opportunities FOR SELECT
  USING (
    assigned_to = (SELECT id FROM crm_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM crm_users u WHERE u.auth_user_id = auth.uid() AND u.role IN ('admin', 'gerente_comercial'))
  );
```

Sólo protege si el backend consulta con el JWT del usuario (clave publicable + token), no con `service_role`. Si usás `service_role`, RLS es irrelevante para la API y la autorización del service es la única barrera: testeala.

## Endpoints de desarrollo

Montalos sólo si `settings.DEMO_MODE` (y el validador impide `DEMO_MODE` en producción): `if settings.DEMO_MODE: app.include_router(dev_router)`. Una ruta que responde 404 "no disponible" igual está desplegada.
