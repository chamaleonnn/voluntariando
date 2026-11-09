import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://voluntariando.web.app"),
  title: "Voluntariando — Encontrá dónde ayudar",
  description: "Encontrá oportunidades de voluntariado por ubicación y fecha.",
  openGraph: {
    title: "Voluntariando — Encontrá dónde ayudar",
    description: "Encontrá oportunidades de voluntariado por ubicación y fecha.",
    images: [{
      url: "/brand/logo-voluntariando.png",
      width: 1254,
      height: 1254,
      alt: "Logo de Voluntariando con Vía y el pañuelo en forma de V",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Voluntariando — Encontrá dónde ayudar",
    description: "Encontrá oportunidades de voluntariado por ubicación y fecha.",
    images: ["/brand/logo-voluntariando.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
