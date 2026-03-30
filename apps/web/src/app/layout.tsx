import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "PlacementPrep — AI-Powered Placement Test Practice",
    template: "%s | PlacementPrep",
  },
  description:
    "Practice aptitude, verbal, technical, and coding questions for campus placements. Powered by AI.",
  keywords: ["placement preparation", "aptitude test", "coding interview", "TCS", "Infosys"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
