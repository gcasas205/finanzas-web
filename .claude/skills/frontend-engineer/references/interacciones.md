# Interacciones

## Kanban con @dnd-kit

```tsx
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),          // un clic no es un arrastre
  useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }), // mantener apretado: no rompe el scroll
  useSensor(KeyboardSensor),
);

<DndContext
  sensors={sensors}
  onDragStart={(e) => setActiveId(String(e.active.id))}
  onDragEnd={(e) => {
    setActiveId(null);
    const opp = byId(e.active.id); const stage = stageById(e.over?.id);
    if (opp && stage && opp.stage_id !== stage.id) onMove(opp, stage);
  }}
  onDragCancel={() => setActiveId(null)}
  accessibility={{
    announcements: {
      onDragStart: ({ active }) => `Levantaste ${titleOf(active.id)}.`,
      onDragOver: ({ over }) => (over ? `Sobre ${stageName(over.id)}.` : 'Fuera de las etapas.'),
      onDragEnd: ({ over }) => (over ? `Soltado en ${stageName(over.id)}.` : 'Se canceló el movimiento.'),
      onDragCancel: () => 'Se canceló el movimiento.',
    },
    screenReaderInstructions: { draggable: 'Para mover el presupuesto, presioná espacio, elegí la etapa con las flechas y presioná espacio de nuevo.' },
  }}
>
  {children}
  <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
    {active && <div className="w-[284px] max-w-[84vw] rotate-[2.5deg] scale-[1.03] cursor-grabbing"><OpportunityCard opp={active} lifted /></div>}
  </DragOverlay>
</DndContext>
```

Tarjeta arrastrable: mouse y dedo desde toda la tarjeta, **teclado sólo desde el asa** para que Enter en el título siga navegando:

```tsx
const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({ id: opp.id });
const on = (listeners ?? {}) as Record<string, ((e: unknown) => void) | undefined>;
<div ref={setNodeRef} onMouseDown={on.onMouseDown} onTouchStart={on.onTouchStart}
     className={clsx('group/drag relative touch-manipulation',
       isDragging && 'rounded-xl border-2 border-dashed border-linea-fuerte bg-chapa/40 [&>*]:invisible')}>
  {children}
  <button ref={setActivatorNodeRef} type="button" {...attributes} onKeyDown={on.onKeyDown}
          aria-label={`Mover ${opp.title}`}
          className="absolute right-1.5 top-1.5 z-[2] opacity-0 group-hover/drag:opacity-100 focus-visible:opacity-100 cursor-grab">
    <GripVertical className="h-4 w-4" />
  </button>
</div>
```

La columna destino recibe `isOver` (anillo interior oscuro) e `isDragging` (todas las columnas se marcan como posibles destinos; la vacía dice "Soltá acá"). Alternativa sin arrastre: botón "Pasar a <siguiente etapa>" en cada tarjeta.

## Optimista con reversión

```tsx
const { data, setData } = useLoad(load);

const moveLocal = (id: string, update: Partial<Opportunity>) => {
  const snapshot = data;                        // foto de lo que se ve ahora (el handler corre con el render actual)
  setData((prev) => prev && { ...prev, opportunities: prev.opportunities.map((o) => (o.id === id ? { ...o, ...update } : o)) });
  return () => setData(snapshot);               // función para deshacer
};

const run = async (id: string, update: OpportunityUpdateData, ok: string) => {
  const undo = moveLocal(id, update);
  try {
    const saved = await updateOpportunity(id, update);
    setData((p) => p && { ...p, opportunities: p.opportunities.map((o) => (o.id === id ? saved : o)) }); // la verdad del servidor
    toast.success(ok);
  } catch (err) {
    undo();                                     // vuelve al instante, sin esperar un reload
    toast.error('No se pudo mover el presupuesto', errorMessage(err));
  }
};
```

Corralap hoy revierte con `await reload()` (una ida y vuelta completa con la tarjeta en el lugar equivocado mientras tanto); la foto previa es instantánea. Con React 19 también podés usar `useOptimistic` dentro de una Action. Si un cambio afecta totales calculados en el servidor (salud, pipeline), después del éxito refrescá sólo esos agregados.

## Transiciones que piden datos

```tsx
export function useStageTransitions(apply: (id: string, u: OpportunityUpdateData, msg: string) => Promise<void>) {
  const [win, setWin] = useState<{ opp: Opportunity; stageId: string } | null>(null);
  const [lost, setLost] = useState<{ opp: Opportunity; stageId: string } | null>(null);
  const moveTo = (opp: Opportunity, stage: Stage) => {
    if (opp.stage_id === stage.id) return;
    if (stage.is_closed_won) return setWin({ opp, stageId: stage.id });
    if (stage.is_closed_lost) return setLost({ opp, stageId: stage.id });
    void apply(opp.id, { stage_id: stage.id, status: 'abierta' }, `Pasó a ${sentenceCase(stage.name)}`);
  };
  const dialogs = (<>
    {win && <WinDialog opp={win.opp} onCancel={() => setWin(null)}
      onConfirm={(v) => { setWin(null); void apply(win.opp.id, { stage_id: win.stageId, status: 'ganada', estimated_value: v }, '¡Venta concretada!'); }} />}
    {lost && <LostDialog opp={lost.opp} onCancel={() => setLost(null)}
      onConfirm={(r) => { setLost(null); void apply(lost.opp.id, { stage_id: lost.stageId, status: 'perdida', loss_reason: r }, 'Marcado como perdido'); }} />}
  </>);
  return { moveTo, dialogs };
}
```

El diálogo de venta arranca con el valor presupuestado y lo muestra como ayuda; el de pérdida usa radios grandes (44px) con los motivos del catálogo y deshabilita "Marcar perdido" hasta elegir uno.

## Borrador y retorno entre rutas

```ts
const DRAFT_KEY = 'corralap:borrador-presupuesto';

function goCreate(kind: 'obra' | 'contacto') {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(currentDraft())); } catch { /* sin almacenamiento: se vuelve sin borrador */ }
  const q = new URLSearchParams({ volver: '/opportunities/nuevo' });
  if (companyId) q.set('company_id', companyId);
  router.push(`${kind === 'obra' ? '/projects/nueva' : '/contacts/nuevo'}?${q}`);
}
// Al volver: /opportunities/nuevo?borrador=1&nueva_obra=<id>
const [preset] = useState(() => {                        // se lee UNA vez, en el primer render
  const q = new URLSearchParams(window.location.search);
  const draft = q.get('borrador') ? readDraft() : null;
  /* …fusionar draft + parámetros (preseleccionar la obra/contacto recién creado) */
});
// Tras guardar con éxito: sessionStorage.removeItem(DRAFT_KEY)
```

`sessionStorage` (no `localStorage`): el borrador muere con la pestaña. El formulario de destino cambia su botón a "Registrar y volver al presupuesto" y, al terminar, pregunta si volver. **Validá siempre `volver`:**

```ts
export const safeBackHref = (v: string | null | undefined, fallback: string) =>
  v && v.startsWith('/') && !v.startsWith('//') ? v : fallback;   // evita ?volver=https://sitio-malo
```

**Mejora:** versioná la clave del borrador (`…:v2`) y descartá borradores que no validan contra el tipo actual, para que un cambio de esquema no rompa la página.

## Aviso de cambios sin guardar

```ts
export function useLeaveGuard(active: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault(); e.stopPropagation();          // fase de captura: antes que el <Link>
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); document.removeEventListener('click', onClick, true); };
  }, [active]);
  return { pendingHref, cancel: () => setPendingHref(null) };
}
```

`active` = "hay cambios" (compará contra el estado inicial, no "tocó algún campo"). Si confirma salir, desactivá la guarda y `router.push(pendingHref)`. No cubre el botón "atrás" del navegador; si importa, agregá un `popstate`.

## Polling cortés

```ts
useEffect(() => {
  let alive = true, timer: number | undefined;
  const tick = async () => {
    if (document.visibilityState === 'visible') await refresh();
    if (alive) timer = window.setTimeout(tick, POLL_MS);     // encadenado: nunca se solapan dos pedidos
  };
  timer = window.setTimeout(tick, POLL_MS);
  const onVisible = () => document.visibilityState === 'visible' && refresh();
  document.addEventListener('visibilitychange', onVisible);
  return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
}, [refresh]);
```

En un chat, mantené el scroll abajo **sólo si** la persona ya estaba leyendo lo último (medí antes de actualizar en `useLayoutEffect`). Pedí sólo lo nuevo (`?after=<último id>`) cuando el backend lo permita.

## Paleta ⌘K

Atajo global `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'` con `preventDefault`. Mostrá `⌘K` o `Ctrl K` según `navigator.userAgent` (con `suppressHydrationWarning` si se renderiza en servidor). Grupos "Crear", "Ir a" y resultados por entidad, búsqueda con la misma `norm()` sin acentos, flechas + Enter, Escape cierra. Mismo contrato ARIA que el `Select` (combobox + listbox).

## Gráficos SVG propios

```ts
/** Ancho real del contenedor: el SVG se dibuja en píxeles para que el texto no se achique. */
export function useChartWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const w = Math.floor(e?.contentRect.width ?? 0); setWidth((p) => (p === w ? p : w)); });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Cuenta desde el valor anterior al nuevo (ease-out cúbico). Con movimiento reducido, salta. */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(value);
  useEffect(() => {
    let frame = 0;
    const start = from.current;
    if (prefersReducedMotion() || start === target) {
      frame = requestAnimationFrame(() => { from.current = target; setValue(target); });
      return () => cancelAnimationFrame(frame);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const next = start + (target - start) * (1 - (1 - t) ** 3);
      from.current = next; setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
```

Recorrido por teclado (`useActiveIndex`): el `<svg>` es enfocable (`tabIndex={0}`, `role="img"`, `aria-label` con el resumen), flechas/Inicio/Fin mueven la marca activa, Escape la suelta; el puntero usa el mismo estado. El tooltip se muestra con puntero **y** con foco. Cada gráfico tiene su tabla gemela ("Ver tabla"). Barras horizontales como `<ul>` HTML con `<Link>` por fila para permitir drill-down. Clases de animación y escalonado en la skill `webapp-designer` (`references/movimiento.md`).

## Estados de vista

```tsx
const { data, error, loading, reload } = useLoad(load);   // load definido FUERA del componente (estable)
if (loading) return <LoadingBlock label="Cargando presupuestos" />;
if (error) return <ErrorPanel message={error} onRetry={reload} />;
if (!data.items.length) return <EmptyState illustration="presupuestos" title="Todavía no hay presupuestos" action={<ButtonLink href="/opportunities/nuevo">Nuevo presupuesto</ButtonLink>} />;
```

`useLoad` usa una bandera `alive` para no hacer `setState` tras desmontar. **Mejora:** usá `AbortController` y pasá `signal` al `fetch` para cancelar de verdad el pedido al salir de la vista.
