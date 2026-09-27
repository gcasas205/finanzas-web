# Testing de frontend

Corralap no tiene tests de frontend: el CI sólo corre ESLint y el build. Es la brecha más fácil de cerrar porque la lógica delicada ya está en funciones puras.

## Pirámide

| Nivel | Herramienta | Qué | Cuánto |
|---|---|---|---|
| Unidad | **Vitest** | `lib/format.ts`, `lib/validators.ts`, `lib/pricing.ts`, `whatsappNumber`, `niceTicks`, `stagger`, `safeBackHref` | casi todo |
| Componente | **Vitest + Testing Library** + `@testing-library/user-event` | primitivos (Select, DatePicker, Dialog, Field) con teclado y roles | uno por primitivo |
| Accesibilidad | **axe** (`vitest-axe` o `@axe-core/playwright`) | cada primitivo y cada pantalla principal | en cada test de componente/e2e |
| Punta a punta | **Playwright** | los flujos de la demo | 3–6 flujos |

## Tests de tabla para funciones puras

```ts
import { describe, expect, it } from 'vitest';
import { formatCuit, isValidCuit } from '@/lib/validators';
import { whatsappNumber } from '@/components/contact/phone';

describe('whatsappNumber', () => {
  it.each([
    ['11 5566-7788', '5491155667788'],
    ['011 15 5566-7788', '5491155667788'],
    ['+54 9 11 5566-7788', '5491155667788'],
    ['+54 11 5566-7788', '5491155667788'],
    ['0054 9 351 555-1234', '5493515551234'],
    ['0351 15 555-1234', '5493515551234'],
    ['123', null],
    ['', null],
  ])('%s → %s', (raw, expected) => expect(whatsappNumber(raw)).toBe(expected));
});

describe('CUIT', () => {
  it('formatea mientras se escribe', () => {
    expect(formatCuit('30')).toBe('30');
    expect(formatCuit('307123')).toBe('30-7123');
    expect(formatCuit('30712345678')).toBe('30-71234567-8');
    expect(formatCuit('30-71234567-89999')).toBe('30-71234567-8');
  });
  it('valida el dígito verificador', () => {
    expect(isValidCuit('30-71234567-1')).toBe(true);
    expect(isValidCuit('20-12345678-6')).toBe(true);
    expect(isValidCuit('30-71234567-8')).toBe(false);   // largo bien, verificador mal → sólo advertencia en la UI
    expect(isValidCuit('30-1234')).toBe(false);
  });
});
```

Estos casos se verificaron ejecutando el código de Corralap. Para nuevos casos, calculá el verificador con la misma fórmula en vez de inventarlo.

Otros casos que valen oro: `formatARSCompact` (límites 10.000 y 1.000.000, negativos), `formatQty` (pluralización: "1 bolsa", "2 bolsas", "18 m³"), `priceFor` (justo en `wholesale_min_qty`, mayorista mayor que minorista → minorista), `applyDiscount` (clamp 0–100), `fromISODate` + `formatDate` en `TZ=America/Argentina/Buenos_Aires` (el bug del día anterior).

Corré Vitest con `TZ` fijo para que los tests de fechas no dependan de la máquina: `"test": "TZ=America/Argentina/Buenos_Aires vitest"`.

## Componentes por su rol, no por su clase

```tsx
it('elige una opción con teclado y devuelve el foco', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Select aria-label="Empresa" value="" onChange={onChange} options={opts} />);
  const trigger = screen.getByRole('button', { name: 'Empresa' });
  trigger.focus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('listbox')).toBeVisible();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledWith(opts[1].value);
  expect(trigger).toHaveFocus();
});

it('anuncia el error del campo', () => {
  render(<Field label="CUIT" error="Faltan dígitos: son 11">{(c) => <Input {...c} />}</Field>);
  expect(screen.getByLabelText('CUIT')).toHaveAccessibleDescription('Faltan dígitos: son 11');
  expect(screen.getByLabelText('CUIT')).toHaveAttribute('aria-invalid', 'true');
});
```

El segundo test hubiera detectado que los formularios de Corralap no cablean `aria-describedby`.

## Flujos punta a punta (la demo de la entrega)

1. Login → Inicio muestra el pipeline activo.
2. Alta de empresa con CUIT → alta de contacto → aparece en el listado.
3. Nuevo presupuesto → "+ Nueva obra" → volver con la obra elegida → agregar materiales → guardar → aparece en el embudo.
4. Mover de etapa (arrastrando **y** con el botón) → persiste al recargar.
5. Cerrar como ganada (pide valor) y como perdida (pide motivo).
6. Vendedor no ve indicadores ni presupuestos ajenos; un 403 se muestra legible.

Con `@axe-core/playwright`, corré `new AxeBuilder({ page }).analyze()` en cada pantalla del flujo y fallá ante violaciones `serious`/`critical`. Probá también con `page.emulateMedia({ reducedMotion: 'reduce' })` y a 375px de ancho (sin scroll horizontal: `document.documentElement.scrollWidth <= innerWidth`).

## CI

Agregá al job de frontend: `npm run typecheck` (`tsc --noEmit`), `npm test`, y Playwright contra el build con el backend en modo mock.
