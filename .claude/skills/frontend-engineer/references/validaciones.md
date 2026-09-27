# Validaciones de formulario

Toda regla vive como **función pura en `lib/validators.ts`** (con tests) y el formulario sólo decide *cuándo* llamarla. Las mismas reglas se repiten en el backend (Pydantic / service): el cliente valida para ayudar, el servidor para proteger.

## Cuándo validar

| Momento | Qué | Ejemplo |
|---|---|---|
| Mientras escribe (`onChange`) | **máscara**, nunca un error | CUIT → `30-71234567-8`, sólo dígitos en DNI |
| Al salir del campo (`onBlur`) | **formato** de un campo ya completo | "Faltan dígitos: son 11" |
| Al enviar (`onSubmit`) | obligatorios, cruces entre campos, todo lo anterior | "Elegí el cliente" |
| Al editar un campo con error | **limpiar** su error | `setErrors(p => ({ ...p, phone: undefined }))` |
| Respuesta del servidor | unicidad, reglas de negocio | "Teléfono ya registrado en Juan Pérez" |

Nunca muestres un error mientras la persona todavía está escribiendo el valor por primera vez.

## Patrón de formulario

```tsx
type Errors = Partial<Record<keyof CompanyFormData, string>>;

function validate(d: CompanyFormData): Errors {
  return {
    name: d.name.trim().length >= 2 ? undefined : 'Poné la razón social',
    cuit: cuitProblem(d.cuit ?? '') ?? undefined,
    email: !d.email || isValidEmail(d.email) ? undefined : 'Ingresá un correo válido',
  };
}
const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  const next = validate(data);
  setErrors(next);
  if (hasErrors(next)) return focusFirstInvalid(formRef.current);
  setSaving(true);
  try {
    const saved = company ? await updateCompany(company.id, data) : await createCompany(data);
    toast.success(company ? 'Cambios guardados' : 'Empresa registrada', data.name);
    router.push(`/companies/${saved.id}`);
  } catch (err) {
    const f = fieldError(err);                    // { field, message } si el backend lo indicó
    if (f) { setErrors((p) => ({ ...p, [f.field]: f.message })); focusFirstInvalid(formRef.current); }
    else toast.error('No se pudo guardar', errorMessage(err));
    setSaving(false);
  }
};

export function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
```

`setSaving(false)` sólo en el `catch`: si salió bien, la navegación desmonta el formulario y el botón no "parpadea" a habilitado.

## Catálogo de reglas (con código)

### CUIT / CUIL (Argentina)

```ts
/** Máscara mientras se escribe: sólo dígitos (hasta 11) con guiones en su lugar. */
export function formatCuit(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Dígito verificador (módulo 11 de AFIP/ARCA). */
export function isValidCuit(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  const check = 11 - (sum % 11);
  const expected = check === 11 ? 0 : check;
  return expected !== 10 && expected === Number(d[10]);
}

/** Opcional: vacío es válido; si hay algo, 11 dígitos. */
export function cuitProblem(value: string): string | null {
  const n = value.replace(/\D/g, '').length;
  return n === 0 || n === 11 ? null : 'Faltan dígitos: son 11';
}
```

Uso en Corralap: largo incorrecto = **error** (bloquea); dígito verificador que no coincide = **ayuda** ("Revisalo: el dígito verificador no coincide"), porque hay CUIT viejos o mal cargados en papeles y el vendedor no puede frenar la venta. Documentá esa decisión y replicala en el backend (advertencia en la respuesta o bandera `cuit_verified`), no la dejes sólo en el cliente. Campo con `inputMode="numeric"`, `maxLength={13}`, `autoComplete="off"`, clase `cifra`.

### Teléfono → WhatsApp (Argentina)

Normalizá a E.164 sin `+` como hace el backend: los celulares argentinos pasan a `549 + característica + número`, sin el `0` de larga distancia ni el `15`. Aceptá `+54…`, `0054…`, `011 15 …`, `11 …`.

```ts
export function whatsappNumber(raw: string | null | undefined, defaultCountry = '54'): string | null {
  if (!raw) return null;
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  let international = text.startsWith('+');
  if (digits.startsWith('00')) { digits = digits.slice(2); international = true; }
  const stripArMobile = (national: string) => {
    const n = national.replace(/^0+/, '');
    if (n.length === 12) for (const a of [2, 3, 4]) if (n.slice(a, a + 2) === '15') return n.slice(0, a) + n.slice(a + 2);
    return n;
  };
  if (!international && !(digits.startsWith(defaultCountry) && digits.length > 10)) {
    if (defaultCountry === '54') { const nat = stripArMobile(digits); return nat.length === 10 ? `549${nat}` : null; }
    const nat = digits.replace(/^0+/, '');
    return nat.length >= 6 ? `${defaultCountry}${nat}` : null;
  }
  if (digits.startsWith('54')) {
    let nat = digits.slice(2);
    if (nat.startsWith('9')) nat = nat.slice(1);
    nat = stripArMobile(nat);
    return nat.length === 10 ? `549${nat}` : digits;
  }
  return digits.length >= 8 ? digits : null;
}
```

Si devuelve `null`, el botón de WhatsApp se deshabilita con la razón ("El teléfono no parece un celular"). Campo con `type="tel" inputMode="tel"` y `autoComplete="tel"`. **Esta función tiene muchos casos: es la primera candidata a tests de tabla.**

### Correo

```ts
const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;
export const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());
```

Deliberadamente permisiva: la verdad la tiene `EmailStr` del backend. En destinatarios múltiples: pastillas, Enter/coma/espacio/Tab agregan, pegar extrae direcciones de "Juan <juan@obra.com>, Ana <ana@obra.com>", sin duplicados (comparación en minúsculas), las inválidas quedan marcadas en rojo con texto oculto "(correo inválido)". Error de conjunto: "Agregá al menos un destinatario".

### Montos en formato es-AR

```ts
/** "1.250.000,50" → 1250000.5 · "" → null · basura → NaN */
export function parseAmount(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  return Number(t.replace(/\s|\$/g, '').replace(/\./g, '').replace(',', '.'));
}
export const amountProblem = (n: number | null, { required = false, min = 0 } = {}) =>
  n === null ? (required ? 'Falta el monto' : null)
  : !Number.isFinite(n) || n < min ? 'Ingresá un monto válido' : null;
```

Campo `AffixInput` con prefijo `$`, `inputMode="decimal"`, `cifra`. El botón de confirmar se deshabilita mientras el valor sea inválido **y** el error se muestra (no sólo deshabilitar: la persona tiene que saber por qué).

### Porcentajes y cantidades

- Descuento: `0–100`, clamp al calcular (`Math.min(100, Math.max(0, pct))`), error si se escribe fuera de rango.
- Cantidad: `> 0`; unidades enteras (bolsa, barra) con `inputMode="numeric"`, fraccionables (m³) con `decimal`.
- Redondeá a centavos con `Math.round((n + Number.EPSILON) * 100) / 100` sólo para **mostrar**; el total que vale es el que devuelve el servidor.

### Pares condicionales y cruces

Si uno de un par está cargado, el otro es obligatorio; y hay relaciones entre campos:

```ts
if (wholesale !== null || qty !== null) {
  if (wholesale === null) e.wholesale_price = 'Falta el precio mayorista';
  else if (!Number.isFinite(wholesale) || wholesale <= 0) e.wholesale_price = 'Revisá el precio';
  else if (wholesale > retail) e.wholesale_price = 'No puede superar al minorista';
  if (qty === null) e.wholesale_min_qty = 'Falta la cantidad';
  else if (!Number.isFinite(qty) || qty <= 0) e.wholesale_min_qty = 'Revisá la cantidad';
}
```

Otros cruces típicos: fecha de cierre ≥ hoy (`min` del `DatePicker`), empresa **o** contacto obligatorio (uno de dos), título autocompletado desde la obra si queda vacío (`Materiales · <obra>`).

### Opciones no elegibles

No ocultes: mostrá con motivo y bloqueá. `{ value, label, hint: 'Inactivo: no se le puede presupuestar', disabled: true }`. El backend rechaza igual (409/400) por si la lista quedó vieja.

### Dependencias entre campos

Al cambiar el cliente, **reseteá** lo que dependía de él (obra, punto de contacto). Un `Select` dependiente sin padre queda deshabilitado con placeholder explicativo ("Elegí la empresa primero").

### Adjuntos

```ts
const MAX_MB = 10, MAX_FILES = 10;
const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx';
for (const file of files) {
  if (slots-- <= 0) { toast.warning('Demasiados adjuntos', `Hasta ${MAX_FILES} archivos por correo.`); break; }
  if (file.size > MAX_MB * 1024 * 1024) { toast.warning('Archivo muy pesado', `${file.name} supera ${MAX_MB} MB.`); continue; }
  // subir con estado por archivo: 'subiendo' | 'listo' | 'error' (reintentable)
}
```

El `accept` es una sugerencia para el selector del sistema, no una validación: el backend tiene que revisar tipo real y tamaño.

### Fechas

```ts
/** "2026-09-24" → Date local (no UTC). */
export function fromISODate(s?: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}
```

**Bug a evitar (presente en Corralap):** `formatDate(opp.expected_close_date)` hace `new Date('2026-09-24')`, que se interpreta como medianoche UTC y en Argentina muestra **23 de septiembre**. Las fechas sin hora se parsean con `fromISODate`; los timestamps con hora sí con `new Date(iso)`.

## Errores del servidor mapeados a campos

Contrato con el backend (ver skill `backend-engineer`): `{"detail": "Teléfono ya registrado en Juan Pérez", "code": "duplicate", "field": "phone"}`.

```ts
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public field?: string) { super(message); }
}
export async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const b = await res.json();
    if (typeof b?.detail === 'string') return new ApiError(b.detail, res.status, b.code, b.field);
    if (Array.isArray(b?.detail) && b.detail[0]) {             // 422 de Pydantic
      const e = b.detail[0];
      return new ApiError(String(e.msg).replace(/^Value error, /, ''), 422, 'validation', e.loc?.at(-1));
    }
  } catch { /* sin JSON */ }
  return new ApiError(fallback, res.status);
}
export const fieldError = (err: unknown) =>
  err instanceof ApiError && err.field ? { field: err.field, message: err.message } : null;
```

Esto reemplaza el `message.startsWith('DNI')` de Corralap. Traducí los nombres de campo del backend a los del formulario si difieren (`document_number` → `dni`) en un mapa explícito.

## Mensajes

Cortos, segunda persona, accionables, sin culpa: "Falta el nombre", "Elegí el cliente", "Poné un nombre", "Ingresá un monto válido", "No puede superar al minorista". Aviso de éxito con el **nombre del registro** como mensaje ("Empresa registrada · Construcciones del Oeste SRL").
