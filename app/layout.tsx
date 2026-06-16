import type { Metadata } from "next";
import { Space_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import FieldBackground from "@/components/field/FieldBackground";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinCrime Control Lab: Financial crime, controlled.",
  description:
    "Free financial crime control design tools. Map AML typologies to detection controls, define partner control ownership, and browse a controls library mapped to real enforcement actions.",
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
    title: "FinCrime Control Lab: Financial crime, controlled.",
    description:
      "Free financial crime control design tools powered by FATF, Wolfsberg, and FCA frameworks.",
    url: "https://fincrime.memaconsultants.com",
    siteName: "FinCrime Control Lab",
    type: "website",
  },
};

const themeInit = `
(function () {
  try {
    var stored = localStorage.getItem('fincrime-theme');
    var theme = stored || 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <FieldBackground />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
