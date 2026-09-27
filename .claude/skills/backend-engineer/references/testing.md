# Testing de backend

Corralap ya corre `ruff format --check`, `ruff check` y `pytest` en CI con `TestClient` y ~15 archivos de tests unitarios. Lo que falta es probar **seguridad** y **permisos** sistemáticamente: sus fixtures usan el mismo token sin firma que la app, así que ningún test podía detectar que el token se falsifica.

## Fixtures por rol

```python
# tests/conftest.py
import os
os.environ.setdefault("JWT_SECRET_KEY", "x" * 48)
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "placeholder")
os.environ.setdefault("DATA_BACKEND", "memory")

import pytest
from uuid import UUID
from fastapi.testclient import TestClient
from backend.main import app
from backend.core.security import create_access_token

USERS = {
    "admin": UUID("00000000-0000-0000-0000-000000000001"),
    "gerente_comercial": UUID("00000000-0000-0000-0000-000000000002"),
    "ejecutivo_ventas": UUID("00000000-0000-0000-0000-000000000003"),
    "otro_vendedor": UUID("00000000-0000-0000-0000-000000000004"),
}

def client_as(role: str, user_key: str | None = None) -> TestClient:
    uid = USERS[user_key or role]
    token = create_access_token(uid, role, role)
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})

@pytest.fixture
def admin(): 
    with client_as("admin") as c: yield c

@pytest.fixture
def vendedor():
    with client_as("ejecutivo_ventas") as c: yield c

@pytest.fixture
def otro_vendedor():
    with client_as("ejecutivo_ventas", "otro_vendedor") as c: yield c

@pytest.fixture
def anonimo():
    with TestClient(app) as c: yield c

@pytest.fixture(autouse=True)
def _datos_limpios():
    reset_memory_repo()          # cada test arranca con los mismos datos semilla
    yield
```

## Seguridad: los tests que Corralap no tiene

```python
import base64, json, time, jwt

def test_token_falsificado_rechazado(anonimo):
    fake = "crm_" + base64.urlsafe_b64encode(json.dumps({"sub": "x", "role": "admin", "exp": 9999999999}).encode()).decode()
    r = anonimo.get("/api/companies", headers={"Authorization": f"Bearer {fake}"})
    assert r.status_code == 401

def test_token_firmado_con_otra_clave_rechazado(anonimo):
    t = jwt.encode({"sub": str(USERS["admin"]), "role": "admin", "iat": int(time.time()), "exp": int(time.time()) + 60}, "otra-clave" * 5, algorithm="HS256")
    assert anonimo.get("/api/companies", headers={"Authorization": f"Bearer {t}"}).status_code == 401

def test_token_vencido_rechazado(anonimo):
    t = jwt.encode({"sub": str(USERS["admin"]), "role": "admin", "iat": 0, "exp": 1}, os.environ["JWT_SECRET_KEY"], algorithm="HS256")
    r = anonimo.get("/api/companies", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 401 and "venció" in r.json()["detail"]

def test_alg_none_rechazado(anonimo):
    t = jwt.encode({"sub": str(USERS["admin"]), "role": "admin", "exp": int(time.time()) + 60}, None, algorithm="none")
    assert anonimo.get("/api/companies", headers={"Authorization": f"Bearer {t}"}).status_code == 401

def test_sin_sesion_401(anonimo):
    assert anonimo.get("/api/opportunities").status_code == 401

def test_credenciales_demo_no_funcionan_en_produccion(monkeypatch, anonimo):
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    r = anonimo.post("/api/auth/login", json={"email": "admin@crm.com", "password": "admin123"})
    assert r.status_code == 401

def test_settings_de_produccion_inseguros_no_arrancan():
    with pytest.raises(ValueError):
        Settings(ENVIRONMENT="production", DEBUG=True, SUPABASE_URL="x", SUPABASE_SECRET_KEY="x", JWT_SECRET_KEY="y" * 40)

def test_webhook_sin_secreto_rechaza(monkeypatch, anonimo):
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "")
    assert anonimo.post("/api/whatsapp/webhook", content=b"{}").status_code == 401
```

## Matriz de permisos parametrizada

```python
PERMISOS = [
    # (método, ruta, rol, esperado)
    ("GET",  "/api/metrics/active-pipeline", "admin",             200),
    ("GET",  "/api/metrics/active-pipeline", "gerente_comercial", 200),
    ("GET",  "/api/metrics/active-pipeline", "ejecutivo_ventas",  403),
    ("GET",  "/api/users",                    "ejecutivo_ventas",  403),
    ("POST", "/api/users",                    "gerente_comercial", 403),
    ("GET",  "/api/products/audit",           "gerente_comercial", 403),
    ("DELETE", "/api/companies/{company}",    "ejecutivo_ventas",  403),
]

@pytest.mark.parametrize("method,path,role,expected", PERMISOS)
def test_matriz(method, path, role, expected, seed_ids):
    with client_as(role) as c:
        assert c.request(method, path.format(**seed_ids)).status_code == expected
```

La matriz es documentación ejecutable: cuando el producto cambia un permiso, cambia una fila.

## Alcance por dueño

```python
def test_vendedor_no_ve_presupuesto_ajeno(vendedor, otro_vendedor, opp_de_otro):
    assert vendedor.get(f"/api/opportunities/{opp_de_otro}").status_code in (403, 404)
    ids = {o["id"] for o in vendedor.get("/api/opportunities").json()}
    assert opp_de_otro not in ids

def test_vendedor_no_puede_autoasignarse_a_otro(vendedor, stage_id, company_id):
    r = vendedor.post("/api/opportunities", json={"title": "Test", "company_id": company_id, "stage_id": stage_id,
                                                  "assigned_to": str(USERS["otro_vendedor"])})
    assert r.status_code == 201 and r.json()["assigned_to"] == str(USERS["ejecutivo_ventas"])
```

## Reglas de dominio

```python
def test_total_lo_calcula_el_servidor(admin, base_opp):
    r = admin.post("/api/opportunities", json={**base_opp, "discount_pct": "10", "items": [
        {"product_name": "Cemento 50 kg", "quantity": "3", "unit_price": "9800.00", "discount_pct": "5"}]})
    body = r.json()
    assert Decimal(body["estimated_value"]) == Decimal("25137.00")   # 3 × 9800 × 0,95 = 27930 → × 0,90

def test_perder_sin_motivo_falla(admin, opp_id, lost_stage):
    r = admin.patch(f"/api/opportunities/{opp_id}", json={"stage_id": lost_stage, "status": "perdida"})
    assert r.status_code == 422

def test_cambiar_materiales_crea_version(admin, opp_id):
    admin.patch(f"/api/opportunities/{opp_id}", json={"items": [...], "version_note": "Pidió 10 bolsas más"})
    versions = admin.get(f"/api/opportunities/{opp_id}/versions").json()
    assert [v["version"] for v in versions] == [2, 1] and versions[0]["note"] == "Pidió 10 bolsas más"

def test_contacto_duplicado_devuelve_campo(admin, contacto_existente):
    r = admin.post("/api/contacts", json={"first_name": "Otro", "last_name": "X", "phone": contacto_existente["phone"]})
    assert r.status_code == 409 and r.json()["field"] == "phone"

@pytest.mark.parametrize("cuit,ok", [("30-71234567-1", True), ("20-12345678-6", True), ("30-71234567-8", False), ("30-1234", False)])
def test_cuit(cuit, ok):
    assert cuit_is_valid(cuit) is ok
```

(Los CUIT de ejemplo se verificaron con la fórmula de módulo 11.)

## Base real en CI (opcional pero valioso)

Para probar `CHECK`, índices únicos, triggers de inmutabilidad y RLS, levantá Postgres en el job (`services: postgres:16` en GitHub Actions), aplicá `migrations/*.sql` en orden y corré una suite marcada `@pytest.mark.db`. Los tests en memoria no pueden probar lo que vive en la base.

## Checklist

- [ ] Token falsificado, firmado con otra clave, vencido y `alg=none` → 401.
- [ ] Matriz de permisos completa por rol.
- [ ] Alcance por dueño en listar, ver, editar y mover.
- [ ] Cada regla de negocio con un test que la rompe a propósito.
- [ ] Totales y redondeos con `Decimal` exactos.
- [ ] Errores con `code` y `field` esperados.
- [ ] Settings inseguros en producción no arrancan.
