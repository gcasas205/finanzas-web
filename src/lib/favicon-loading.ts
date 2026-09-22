"use client";

/**
 * Favicon "en vivo": mientras algo carga en la app, el ícono de la pestaña
 * gira un anillo ámbar alrededor de la marca (mismo mark que src/app/icon.svg).
 * Varias vistas pueden pedir el estado de carga a la vez (ej. navegación
 * rápida entre secciones), así que se cuenta con un ref-count global: el
 * ícono vuelve a su estado quieto solo cuando nadie más lo necesita.
 */

const BG = "#0A0F0D";
const FG = "#F4F1EA";
const AMBER = "#C9A24B";

function markSvg(spinnerAngle: number | null): string {
  const ring = spinnerAngle == null
    ? ""
    : `<circle cx="16" cy="16" r="14" fill="none" stroke="${AMBER}" stroke-width="2.5" ` +
      `stroke-linecap="round" stroke-dasharray="22 66" transform="rotate(${spinnerAngle} 16 16)"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${BG}"/>` +
    `<text x="9.5" y="23.5" font-family="Georgia, 'Times New Roman', serif" font-size="19" font-weight="700" fill="${FG}">F</text>` +
    `<circle cx="24.5" cy="22.5" r="2.15" fill="${AMBER}"/>` +
    `${ring}</svg>`
  );
}

function toDataUri(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const IDLE_HREF = toDataUri(markSvg(null));

const FRAME_COUNT = 8;
const FRAME_HREFS = Array.from({ length: FRAME_COUNT }, (_, i) =>
  toDataUri(markSvg((360 / FRAME_COUNT) * i))
);

let refCount = 0;
let frameIndex = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

function applyFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = href;
}

function tick() {
  frameIndex = (frameIndex + 1) % FRAME_COUNT;
  applyFavicon(FRAME_HREFS[frameIndex]);
}

function start() {
  if (intervalId) return;
  applyFavicon(FRAME_HREFS[frameIndex]);
  intervalId = setInterval(tick, 100);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  applyFavicon(IDLE_HREF);
}

/** Suma un "interesado" en mostrar el favicon como cargando; llamar al resultado lo libera. */
export function acquireFaviconLoading(): () => void {
  refCount += 1;
  if (refCount === 1) start();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) stop();
  };
}
