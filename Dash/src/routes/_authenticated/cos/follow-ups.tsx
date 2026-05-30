import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route: renders /cos/follow-ups/ dashboard and /cos/follow-ups/$id workspaces */
export const Route = createFileRoute("/_authenticated/cos/follow-ups")({
  component: () => <Outlet />,
});
