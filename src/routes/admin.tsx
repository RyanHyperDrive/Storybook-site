import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGate>
      <Outlet />
    </AuthGate>
  ),
});
