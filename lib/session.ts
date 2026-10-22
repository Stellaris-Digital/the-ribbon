import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertAdminRole } from "@/lib/auth-role";

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user.role;
  assertAdminRole(role);
  return session;
}
