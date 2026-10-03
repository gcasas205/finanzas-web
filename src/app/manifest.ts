import type { MetadataRoute } from "next";

/**
 * Manifiesto de la web app: permite "Agregar a la pantalla de inicio" en el
 * celular con el ícono del loader. Se sirve en /manifest.webmanifest (fuera del
 * login en el middleware: el celular lo lee antes de que inicies sesión).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzas",
    short_name: "Finanzas",
    description: "Seguimiento financiero personal",
    lang: "es-AR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0F0D",
    theme_color: "#0A0F0D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
