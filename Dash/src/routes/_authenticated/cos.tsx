import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cos")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/cos" || location.pathname === "/cos/") {
      throw redirect({ to: "/cos/pipeline" });
    }
  },
  component: () => <Outlet />,
});
