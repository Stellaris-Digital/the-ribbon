export function assertAdminRole(role: string | null | undefined): void {
  if (role !== "admin") {
    throw new Error("Unauthorized");
  }
}
