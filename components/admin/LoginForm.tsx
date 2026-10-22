"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="w-full max-w-sm space-y-4 rounded-lg border border-[#e6dcc8] bg-[#fffdf8] p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        const result = await authClient.signIn.email({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
        setPending(false);
        if (result.error) {
          setError("Those credentials were not accepted.");
          return;
        }
        router.push("/admin");
        router.refresh();
      }}
    >
      <h1 className="text-xl font-semibold">Admin sign in</h1>
      <label className="block text-sm">
        Email
        <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" name="email" type="email" required />
      </label>
      <label className="block text-sm">
        Password
        <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" name="password" type="password" required />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="rounded-full bg-[#241c15] px-4 py-2 text-sm text-[#f7f1e4]" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
