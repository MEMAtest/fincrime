import type { Metadata } from "next";
import ToolFrame from "@/components/layout/ToolFrame";
import EnforcementHubClient from "./EnforcementHubClient";

export const metadata: Metadata = {
  title: "FCA enforcement: what failed and the controls that would have caught it",
  description:
    "Browse real FCA enforcement actions by risk theme and firm type. For each fine, see what failed and the financial crime controls that would have prevented it, then design them.",
};

export default function EnforcementPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <EnforcementHubClient />
      </main>
      </ToolFrame>
  );
}
