import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QRPass | Gestión integral de barrios cerrados",
  description: "Automatizá expensas, controlá accesos y mejorá la comunicación de tu barrio cerrado. Todo desde una sola plataforma.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
