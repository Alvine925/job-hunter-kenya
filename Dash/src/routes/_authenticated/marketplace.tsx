import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout: list at /marketplace, detail at /marketplace/$id */
export const Route = createFileRoute("/_authenticated/marketplace")({
  component: () => <Outlet />,
});
