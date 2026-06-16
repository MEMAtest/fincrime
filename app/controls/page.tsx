import type { Metadata } from "next";
import ControlsClient from "./ControlsClient";

export const metadata: Metadata = {
  title: "Controls Reference Library",
  description:
    "Browse financial crime controls grouped by risk theme, filtered by firm type and framework, and mapped to real FCA enforcement actions.",
};

export default async function ControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ framework?: string | string[] }>;
}) {
  const sp = await searchParams;
  const fw = Array.isArray(sp.framework) ? sp.framework[0] : sp.framework;
  return <ControlsClient initialFramework={fw ?? "all"} />;
}
