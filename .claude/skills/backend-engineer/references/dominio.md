# Reglas de dominio en el servidor

Patrones de Corralap (`services/opportunity_service.py`, `contact_service.py`, `catalog_audit_service.py`) con las brechas cerradas.

## Montos: `Decimal`, cuantizado, calculado por el servidor

```python
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
def money(v: Decimal) -> Decimal:
    return v.quantize(CENT, rounding=ROUND_HALF_UP)

def line_subtotal(qty: Decimal, unit_price: Decimal, discount_pct: Decimal) -> Decimal:
    return money(qty * unit_price * (Decimal(1) - discount_pct / Decimal(100)))

def quote_total(lines: list[Decimal], discount_pct: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = sum(lines, Decimal(0))
    return subtotal, money(subtotal * (Decimal(1) - discount_pct / Decimal(100)))
```

- El cliente manda cantidad, precio y descuento; **el servidor** calcula subtotales y total. Si el cliente manda `subtotal`, se ignora (mejor: que el modelo de entrada no lo tenga).
- Precio por escala: `mayorista` si hay `wholesale_price` y `qty >= wholesale_min_qty` **y** `wholesale_price <= unit_price`; si no, minorista. Guardá en el renglón `list_price` y `price_tier` para saber después qué se aplicó.
- Si el precio del renglón difiere del de catálogo, `price_tier = "manual"` (negociado), y decidí si ese cambio requiere un rol.
- En la base: `NUMERIC(14,2)`, nunca `float`/`real`. Convertí con `Decimal(str(x))` al leer de librerías que devuelven float.

## Transiciones de estado (máquina explícita)

Corralap valida el cierre sólo en el cliente (diálogos de venta/pérdida) y no controla que estado y etapa coincidan. Hacelo en el servidor:

```python
def validate_transition(existing: Opportunity, target_stage: Stage | None, data: OpportunityUpdate, actor: Session) -> dict:
    stage = target_stage or existing.stage
    status = data.status or existing.status
    if stage.is_closed_won and status != "ganada":
        raise DomainError("invalid_transition", "Una etapa de venta concretada exige estado ganada")
    if stage.is_closed_lost and status != "perdida":
        raise DomainError("invalid_transition", "Una etapa de pérdida exige estado perdida")
    if not (stage.is_closed_won or stage.is_closed_lost) and status != "abierta":
        raise DomainError("invalid_transition", "Una etapa abierta exige estado abierta")
    if status == "perdida" and not (data.loss_reason or existing.loss_reason):
        raise DomainError("validation", "Indicá el motivo de la pérdida", field="loss_reason")
    if existing.status != "abierta" and status == "abierta" and actor.role not in MANAGERS:
        raise DomainError("forbidden", "Sólo un responsable comercial puede reabrir un presupuesto cerrado", status_code=403)
    return {"stage_id": stage.id, "status": status}
```

Y el respaldo en la base:

```sql
ALTER TABLE crm_opportunities ADD CONSTRAINT crm_opp_loss_reason_chk
  CHECK (status <> 'perdida' OR (loss_reason IS NOT NULL AND length(trim(loss_reason)) > 0));
```

## Historial inmutable y línea de tiempo

- Cada cambio de etapa inserta en `crm_stage_history (opportunity_id, from_stage_id, to_stage_id, changed_by, note, created_at)`. Nunca `UPDATE`.
- Cada renegociación de materiales o descuento **incrementa `current_version`** e inserta una foto completa en `crm_opportunity_versions (opportunity_id, version, items jsonb, subtotal, discount_pct, total, note, created_by, created_at)` con `UNIQUE (opportunity_id, version)`. La primera versión se guarda al crear (Corralap la reconstruye tarde si falta: evitá ese caso guardándola siempre).
- La línea de tiempo (`GET /{id}/timeline`) une historial de etapas + versiones (+ actividades) ordenado del más nuevo al más viejo, con autor y, en versiones, `total` vs `previous_total`.
- Blindaje en la base:

```sql
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro histórico: no se modifica ni se borra'; END $$;

CREATE TRIGGER stage_history_inmutable BEFORE UPDATE OR DELETE ON crm_stage_history
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER versions_inmutable BEFORE UPDATE OR DELETE ON crm_opportunity_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
```

## Transacción para escrituras múltiples

Crear un presupuesto toca 4 tablas (presupuesto, renglones, versión 1, historial). Con `supabase-py` cada `.insert()` es un pedido HTTP independiente: si el tercero falla, quedan datos a medias. Movelo a una función SQL y llamala con `client.rpc("create_opportunity", {...})`, o usá una conexión directa (`psycopg`) con `BEGIN … COMMIT`.

## Unicidad real

Corralap normaliza bien (`_digits`, `_phone_key`, `lower(email)`) y chequea antes de insertar, pero los índices no son `UNIQUE`: dos altas simultáneas pasan. Cerralo en la base:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_email ON crm_contacts (lower(email))
  WHERE is_deleted = false AND email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_document ON crm_contacts (regexp_replace(document_number, '\D', '', 'g'))
  WHERE is_deleted = false AND document_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_phone ON crm_contacts (phone_key)   -- columna normalizada guardada
  WHERE is_deleted = false AND phone_key IS NOT NULL;
```

El chequeo previo en el service se mantiene (da un mensaje lindo: "ya registrado en Juan Pérez"), y además se atrapa la violación (`23505`) como red de seguridad:

```python
try:
    res = client.table("crm_contacts").insert(row).execute()
except APIError as e:                       # postgrest.exceptions.APIError
    if e.code == "23505":
        raise DomainError("duplicate", "Ya existe un contacto con ese dato", field=field_from_constraint(e.message), status_code=409)
    raise
```

## Reglas de negocio típicas (Corralap)

| Regla | Dónde |
|---|---|
| Toda oportunidad tiene empresa **o** contacto | `model_validator` en `Create` + service |
| No se presupuesta a empresas `inactivo` / `no_contactar` | service (`_ensure_company_can_quote`) → 400 `blocked_client` |
| Lo que crea un vendedor queda asignado a él | service ignora `assigned_to` si `actor.role == "ejecutivo_ventas"` |
| Sólo gerente/admin reasignan | `require_manager` en la ruta de reasignación o chequeo en el service |
| Vendedor no ve montos totales ni indicadores | rutas `/api/metrics/*` con `require_manager`; `owner_scope` en el resto |
| DNI, teléfono y correo no se repiten entre contactos | índices únicos + chequeo previo |
| CUIT de 11 dígitos, normalizado `XX-XXXXXXXX-X` | `field_validator`; dígito verificador como advertencia o error según decisión del producto (documentala) |
| Precio mayorista ≤ minorista, y ambos campos mayoristas juntos | `model_validator` en producto + `CHECK` en la base |
| Descuento 0–100 | `Field(ge=0, le=100)` + `CHECK` |
| Historial del catálogo sólo para admin | `require_admin` |

Replicá el dígito verificador del CUIT en Python:

```python
def cuit_is_valid(value: str) -> bool:
    d = "".join(c for c in value if c.isdigit())
    if len(d) != 11:
        return False
    weights = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    check = 11 - sum(w * int(x) for w, x in zip(weights, d[:10])) % 11
    expected = 0 if check == 11 else check
    return expected != 10 and expected == int(d[10])
```

## Auditoría de catálogo

Fila por cambio en `crm_catalog_audit (product_id, action IN ('alta','edicion','baja'), changes jsonb, user_id, created_at)`, donde `changes` guarda `{campo: [antes, después]}` sólo de lo que cambió. Calculá el diff comparando el modelo previo con `data.model_dump(exclude_unset=True)`. Endpoint de lectura sólo admin, paginado.

## Métricas por rol (North Star: pipeline activo)

- `last_activity_at` = última actividad del presupuesto; `days_since_last_activity` en días enteros UTC; `health`: `healthy` ≤ 7, `warning` 8–14, `stale` > 14 **o sin actividad**. Umbrales como constantes con nombre en un solo módulo (no repetidos en front y back: exponelos en la respuesta o en un endpoint de configuración).
- `GET /api/metrics/active-pipeline?days=7` devuelve cantidad y monto activos, estancados y el ratio. El vendedor recibe sólo lo suyo (aplicar `owner_scope`) o 403 según la decisión del producto; nunca el total del equipo.
- Calculá en SQL (`GROUP BY`, `MAX(created_at)` de actividades con `LEFT JOIN`) en vez de traer todo a Python cuando el volumen crece; `metrics_service.py` de Corralap (1.300 líneas en Python) es candidato a vistas o funciones SQL.
