import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "WF Tools Premium",
  description: "Suite unificada de herramientas WF Tools migrada a Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={spaceGrotesk.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
