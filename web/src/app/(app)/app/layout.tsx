import type { ReactNode } from "react";
import { BottomNav } from "@/components/nav/BottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
