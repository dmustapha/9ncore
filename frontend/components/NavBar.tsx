"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectWallet from "./ConnectWallet";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lend", label: "Lend" },
  { href: "/borrow", label: "Borrow" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header
      className="h-11 sticky top-0 z-50 flex items-center justify-between px-6"
      style={{
        background: "rgba(7,7,13,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(45,212,191,0.12)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img src="/logo.svg" width={26} height={26} alt="9ncore" className="rounded-md" />
        <span className="text-[#E8EAF0] font-bold text-base">9ncore</span>
      </div>

      {/* Nav links */}
      <nav className="hidden sm:flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                active
                  ? "bg-[rgba(45,212,191,0.12)] text-teal"
                  : "text-[#9CA3AF] hover:text-[#E8EAF0]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet */}
      <ConnectWallet />
    </header>
  );
}
