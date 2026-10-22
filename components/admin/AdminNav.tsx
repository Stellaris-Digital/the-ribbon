"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AdminNav({ email }: { email: string }) {
  const router = useRouter();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6dcc8] px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <Link className="font-semibold" href="/admin">
          The Ribbon
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/labels">Labels</Link>
          <Link href="/admin/places">Places</Link>
          <Link href="/">Timeline</Link>
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-stone-600">{email}</span>
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/admin/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
