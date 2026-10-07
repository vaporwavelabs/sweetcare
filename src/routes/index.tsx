import { createFileRoute } from "@tanstack/react-router";
import { LaunchGuard, SweetCare } from "@/components/SweetCare";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <LaunchGuard>
      <SweetCare />
    </LaunchGuard>
  );
}
