import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WagmiProviderWrapper } from "@/components/WagmiProviderWrapper";
import NavBar from "@/components/NavBar";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "9ncore — Confidential Lending Pool",
  description:
    "Encrypted DeFi lending powered by Zama FHEVM. Your collateral and debt stay private.",
  other: {
    "ory-verify": "orynth-5437a6a443bd4fae9f602770895f62a2",
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <WagmiProviderWrapper>
          <NavBar />
          {children}
        </WagmiProviderWrapper>
      </body>
    </html>
  );
}
