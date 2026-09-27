# Integraciones

## Webhooks con firma (WhatsApp Cloud API / Meta)

Verificación de suscripción (`GET`) y recepción (`POST`). La firma se calcula sobre el **cuerpo crudo**, antes de parsear JSON:

```python
import hashlib, hmac, json
from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse

public = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp (público)"])

@public.get("/webhook", response_class=PlainTextResponse)
def verify(mode: str = Query(alias="hub.mode"), token: str = Query(alias="hub.verify_token"), challenge: str = Query(alias="hub.challenge")):
    expected = settings.WHATSAPP_VERIFY_TOKEN
    if mode == "subscribe" and expected and hmac.compare_digest(token.encode(), expected.encode()):
        return challenge
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Verificación inválida")

def signature_ok(raw: bytes, header: str | None) -> bool:
    secret = settings.WHATSAPP_APP_SECRET
    if not secret:
        return False                                   # FALLAR CERRADO: sin secreto no se acepta nada
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1].strip())

@public.post("/webhook", status_code=200)
async def receive(request: Request):
    raw = await request.body()
    if not signature_ok(raw, request.headers.get("x-hub-signature-256")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Firma inválida")
    payload = json.loads(raw)
    WhatsAppService.ingest(payload)                    # idempotente: el id de mensaje de Meta como clave única
    return {"ok": True}
```

Corralap hace bien el `compare_digest` pero **acepta todo si falta el secreto**. Además:
- **Idempotencia:** Meta reintenta; guardá el `wamid` con índice único y ignorá duplicados.
- Respondé 200 rápido y procesá lo pesado en segundo plano (`BackgroundTasks` o cola).
- Ventana de 24 h de WhatsApp: fuera de ella sólo plantillas aprobadas; exponé `window_open` en la conversación para que el front deshabilite el texto libre.
- Sin credenciales configuradas, el sistema **degrada explícitamente** a `wa.me` + registro manual de la actividad, y lo informa (`provider: "wa.me"` en la respuesta), no finge un envío.

## Correo saliente con proveedor intercambiable

```python
class EmailProvider(Protocol):
    def send(self, msg: OutgoingEmail) -> SendResult: ...

def get_email_provider() -> EmailProvider:
    match settings.EMAIL_PROVIDER:
        case "resend": return ResendProvider(settings.RESEND_API_KEY)
        case "smtp":   return SmtpProvider(settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER, settings.SMTP_PASSWORD)
        case _:        return LogProvider()            # desarrollo: no envía, registra
```

- El `LogProvider` devuelve `sent=False, simulated=True` y el front muestra "Falta configurar el proveedor de correo. Quedó en el seguimiento." (Corralap lo hace así: bien).
- **Sanitizá el HTML** del editor antes de enviarlo (lista blanca de etiquetas con `nh3` o `bleach`) y limitá tamaño (`max_length` en el modelo: Corralap usa 300.000 caracteres).
- Validá destinatarios con `EmailStr`, tope de destinatarios (20) y de adjuntos (10).
- Todo envío (o intento) crea una **actividad** en el seguimiento: alimenta la salud del presupuesto.

## Subida de archivos

```python
ALLOWED = {
    "image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG", "image/webp": b"RIFF",
    "application/pdf": b"%PDF",
}
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}
# WebP: además de "RIFF" al inicio, verificá b"WEBP" en data[8:12] (RIFF también es WAV/AVI).
MAX_BYTES = 10 * 1024 * 1024

@router.post("/uploads", status_code=201)
async def upload(file: UploadFile, session: Session = Depends(require_session)):
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise DomainError("too_large", "El archivo supera 10 MB", status_code=413)
    magic = ALLOWED.get(file.content_type or "")
    if not magic or not data.startswith(magic):          # el content-type lo manda el cliente: verificá los bytes
        raise DomainError("unsupported_type", "Sólo imágenes o PDF", status_code=415)
    key = f"adjuntos/{session.sub}/{uuid4()}{EXT[file.content_type]}"   # nombre generado, nunca el del usuario
    StorageService.put(key, data, content_type=file.content_type)
    return {"key": key, "size_bytes": len(data), "content_type": file.content_type, "name": file.filename[:200]}
```

- Para documentos de Office (ZIP por dentro: `PK\x03\x04`), verificá la firma ZIP y la extensión.
- Bucket **privado**; se sirven con URLs firmadas de corta duración (`generate_presigned_url` en S3, `create_signed_url` en Supabase Storage), no con URLs públicas permanentes.
- En `Settings`, el nombre del bucket sin default real (Corralap tiene `myawsbucketelito` hardcodeado).
- Límite de tamaño también en el proxy/servidor (Vercel y uvicorn tienen los suyos) para no leer 1 GB en memoria.

## Degradación explícita, nunca silenciosa

Corralap cae a listas en memoria (`_mock_versions`, etc.) cuando Supabase falla. En producción eso significa "guardé" sin guardar. Regla:

```python
if settings.DATA_BACKEND == "memory":        # sólo por configuración explícita (tests, demo sin base)
    repo = InMemoryRepo()
else:
    repo = SupabaseRepo(client)               # si falla → excepción → 503 con code "unavailable"
```

Elegí el backend de datos **al arrancar**, no en cada `except`.

## Tareas periódicas

Recalcular salud o enviar recordatorios no requiere cron si se calcula al leer (Corralap lo hace así: `days_since_last_activity` en cada consulta). Si alguna vez hace falta un proceso periódico, usá un job programado (Vercel Cron, `pg_cron` en Supabase) que llame a un endpoint protegido por una clave de servidor, no un `while True` dentro de la API.
