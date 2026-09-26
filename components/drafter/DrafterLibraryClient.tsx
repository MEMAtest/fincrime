"use client";

import { useEffect, useState, useCallback } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

interface ControlTag {
  id: string;
  tag_type: string;
  value: string;
  origin: "code" | "suggested";
  confirmed: boolean;
  evidence_phrase: string | null;
}

interface Control {
  id: string;
  title: string;
  req_ids: string[];
  backoffice_control: string | null;
  coverage: string | null;
  group: "reuse" | "adapt" | "new" | "unassessed";
  tags: ControlTag[];
}

interface MergeGroup {
  id: string;
  backoffice_control: string;
  risk_tag_value: string;
  status: "candidate" | "confirmed" | "split" | "rejected";
  member_control_ids: string[];
}

const GROUP_LABEL: Record<Control["group"], string> = {
  reuse: "Reuse",
  adapt: "Adapt",
  new: "New (closer review)",
  unassessed: "Unassessed",
};

const GROUP_VARIANT: Record<Control["group"], "success" | "warning" | "danger" | "default"> = {
  reuse: "success",
  adapt: "warning",
  new: "danger",
  unassessed: "default",
};

export default function DrafterLibraryClient() {
  const [controls, setControls] = useState<Control[]>([]);
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
  const [filterGroup, setFilterGroup] = useState<Control["group"] | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [writerDisabledReason, setWriterDisabledReason] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [controlsRes, mergeRes] = await Promise.all([
      drafterFetch<{ controls: Control[] }>("/api/drafter/library/controls"),
      drafterFetch<{ groups: MergeGroup[] }>("/api/drafter/library/merge-groups"),
    ]);
    if (controlsRes.ok && "controls" in controlsRes.data) setControls(controlsRes.data.controls);
    if (mergeRes.ok && "groups" in mergeRes.data) setMergeGroups(mergeRes.data.groups);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, [reload]);

  async function suggestTags(controlId: string) {
    setMessage(null);
    const res = await drafterFetch<{ suggested: unknown[]; rejected: unknown[] }>(
      `/api/drafter/library/controls/${controlId}/tags/suggest`,
      { method: "POST" }
    );
    if (!res.ok) {
      const reason = "error" in res.data ? (res.data.error as string) : "Tag suggestion is unavailable.";
      setWriterDisabledReason(reason);
      setMessage(reason);
      return;
    }
    await reload();
  }

  async function decideTag(tagId: string, action: "confirm" | "reject") {
    await drafterFetch(`/api/drafter/library/tags/${tagId}`, { method: "POST", body: JSON.stringify({ action }) });
    await reload();
  }

  async function decideMerge(groupId: string, action: "confirm" | "split" | "reject") {
    await drafterFetch(`/api/drafter/library/merge-groups/${groupId}`, { method: "POST", body: JSON.stringify({ action }) });
    await reload();
  }

  const filtered = filterGroup === "all" ? controls : controls.filter((c) => c.group === filterGroup);
  const candidateMergeGroups = mergeGroups.filter((g) => g.status === "candidate");

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Library" }]}>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Controls library</h1>
          <p className="text-sm text-text-muted mb-6 max-w-2xl">
            Controls built from accepted register rows. Code tags come straight from the register; suggested tags
            need your confirmation before they are used for matching.
          </p>

          {message && <div className="glass-card rounded-xl p-4 text-sm mb-6">{message}</div>}

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {(["all", "reuse", "adapt", "new", "unassessed"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                aria-pressed={filterGroup === g}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  filterGroup === g ? "bg-accent/12 text-accent border-accent/30 font-semibold" : "border-white/10 text-text-muted"
                }`}
              >
                {g === "all" ? "All" : GROUP_LABEL[g]}
              </button>
            ))}
          </div>

          {candidateMergeGroups.length > 0 && (
            <div className="glass-card rounded-xl p-5 mb-6">
              <h2 className="font-medium text-foreground mb-3">Merge candidates</h2>
              <div className="space-y-3">
                {candidateMergeGroups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                    <span>
                      {g.backoffice_control} &middot; {g.risk_tag_value} &middot; {g.member_control_ids.length} controls
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => decideMerge(g.id, "confirm")}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => decideMerge(g.id, "split")}>
                        Split
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => decideMerge(g.id, "reject")}>
                        Reject
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">No controls in this group.</div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((control) => (
                <div key={control.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <p className="font-medium text-foreground">{control.title}</p>
                    <Badge variant={GROUP_VARIANT[control.group]}>{GROUP_LABEL[control.group]}</Badge>
                  </div>
                  <p className="text-xs text-text-muted mb-3">
                    {control.req_ids.join(", ") || "no REQ ID"} &middot; {control.backoffice_control ?? "no backoffice control"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {control.tags.map((tag) => (
                      <span key={tag.id} className="inline-flex items-center gap-1">
                        <Badge variant={tag.confirmed ? "info" : "default"}>
                          {tag.tag_type}: {tag.value}
                          {tag.origin === "suggested" && !tag.confirmed && " (suggested)"}
                        </Badge>
                        {tag.origin === "suggested" && !tag.confirmed && (
                          <span className="flex gap-1">
                            <button className="text-[10px] text-accent" onClick={() => decideTag(tag.id, "confirm")}>
                              confirm
                            </button>
                            <button className="text-[10px] text-red-400" onClick={() => decideTag(tag.id, "reject")}>
                              reject
                            </button>
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => suggestTags(control.id)}>
                    Suggest tags
                  </Button>
                </div>
              ))}
            </div>
          )}

          {writerDisabledReason && <p className="text-xs text-text-muted mt-4">{writerDisabledReason}</p>}
        </div>
      </main>
    </ToolFrame>
  );
}
