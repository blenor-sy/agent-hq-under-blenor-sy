"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="icon-button"
      title="Sign out"
      onClick={async () => {
        await getBrowserClient()?.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut size={17} />
      <span className="nav-label">Sign out</span>
    </button>
  );
}
