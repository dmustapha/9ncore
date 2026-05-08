import type { Metadata } from "next";
import "./globals.css";
import { WagmiProviderWrapper } from "@/components/WagmiProviderWrapper";

export const metadata: Metadata = {
  title: "PrivLend — Confidential Lending Pool",
  description:
    "Encrypted DeFi lending powered by Zama FHEVM. Your collateral and debt stay private.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WagmiProviderWrapper>{children}</WagmiProviderWrapper>
      </body>
    </html>
  );
}
