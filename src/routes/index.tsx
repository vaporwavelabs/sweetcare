import { createFileRoute } from "@tanstack/react-router";
import { SweetCare } from "@/components/SweetCare";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SweetCare />;
}
