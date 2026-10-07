import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { brand } from "@/lib/brand";
export const metadata: Metadata = {
  title: brand.name,
  description:
    "Discover local makers, meals and neighbor-powered pickups in Louisiana, Missouri. Clearly labeled demo marketplace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
