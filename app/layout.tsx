import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FinCrime Control Lab | MEMA Consultants",
  description:
    "Free financial crime control design tools. Map typologies to controls and define partner control ownership with AI-powered insights.",
  keywords: [
    "financial crime",
    "AML",
    "typology",
    "controls",
    "partner oversight",
    "FATF",
    "Wolfsberg",
    "FCA",
  ],
  openGraph: {
    title: "FinCrime Control Lab | MEMA Consultants",
    description:
      "Free financial crime control design tools powered by FATF, Wolfsberg, and FCA frameworks.",
    url: "https://fincrime.memaconsultants.com",
    siteName: "FinCrime Control Lab",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
