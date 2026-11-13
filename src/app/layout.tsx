import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "CR Libretas",
      template: "%s | CR Libretas",
    },
    description:
      "Sistema de gestión y generación de boletas de la I.E.P. Cristo Redentor de Nocheto.",
    icons: {
      icon: "/brand/escudo.png",
    },
    openGraph: {
      type: "website",
      locale: "es_PE",
      title: "CR Libretas",
      description: "Gestión académica segura.",
      images: [
        {
          url: new URL("/og.png", metadataBase).toString(),
          width: 1728,
          height: 909,
          alt: "CR Libretas — Gestión académica segura",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "CR Libretas",
      description: "Gestión académica segura.",
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
