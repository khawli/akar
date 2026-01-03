"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

const items: Item[] = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/inbox", label: "À traiter" },
  { href: "/app/properties", label: "Biens" },
  { href: "/app/documents", label: "Docs" },
  { href: "/app/account", label: "Compte" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "rounded-md px-3 py-2 text-sm",
                active ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-100",
              ].join(" ")}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
