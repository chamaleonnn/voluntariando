import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Datos que utilizan el navegador y los accesos directos al instalar la aplicación.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voluntariando",
    short_name: "Voluntariando",
    description: "Encontrá oportunidades de voluntariado por ubicación y fecha.",
    start_url: "/",
    display: "standalone",
    background_color: "#002f2c",
    theme_color: "#002f2c",
    icons: [
      {
        src: "/brand/icon-voluntariando-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-voluntariando-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
