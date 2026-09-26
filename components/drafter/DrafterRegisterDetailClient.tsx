"use client";

import { useEffect, useState, useCallback } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

type ColumnRole = "filter" | "section_and_tags" | "reuse_adapt_new" | "draft_input" | "evidence" | "reference_only" | "unused";

interface MappingEntry {
  sourceHeader: string;
  role: ColumnRole;
  fieldKey: string;
}

interface ValidationIssue {
  check: string;
  severity: "blocking" | "warning" | "info";
  message: string;
  column?: string;
}

interface RegisterRow {
  id: string;
  row_index: number;
  req_id: string | null;
  fields: Record<string, { text: string; error?: string }>;
  validation_issues: ValidationIssue[];
  is_blocked: boolean;
}

interface RegisterVersion {
  id: string;
  version: number;
  status: "validating" | "blocked" | "accepted";
}

interface DetailResponse {
  registerImport: { id: string; sheet_name: string };
  mapping: MappingEntry[];
  versions: RegisterVersion[];
  latestVersion: RegisterVersion | null;
  rows: RegisterRow[];
  missingColumnIssues: ValidationIssue[];
  overridesByRow: Record<string, Record<string, { resolution: string; note: string | null; actor: string }>>;
}

const ROLES: ColumnRole[] = ["filter", "section_and_tags", "reuse_adapt_new", "draft_input", "evidence", "reference_only", "unused"];

const SEVERITY_VARIANT = { blocking: "danger", warning: "warning", info: "info" } as const;

export default function DrafterRegisterDetailClient({ importId }: { importId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [mappingDraft, setMappingDraft] = useState<MappingEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await drafterFetch<DetailResponse>(`/api/drafter/register/${importId}`);
    if (res.ok && "registerImport" in res.data) {
      setData(res.data);
      setMappingDraft(res.data.mapping);
    }
  }, [importId]);

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, [reload]);

  async function saveMapping() {
    setBusy(true);
    setMessage(null);
    const res = await drafterFetch(`/api/drafter/register/${importId}/mapping`, {
      method: "PUT",
      body: JSON.stringify({ mapping: mappingDraft }),
    });
    setBusy(false);
    if (!res.ok && "error" in res.data) {
      setMessage(res.data.error ?? "Could not save mapping");
      return;
    }
    await reload();
  }

  async function resolveIssue(rowId: string, checkName: string, resolution: "resolved" | "overridden") {
    let note: string | null = null;
    if (resolution === "overridden") {
      note = window.prompt("Reason for overriding this blocking issue (required):");
      if (!note || !note.trim()) return;
    }
    const res = await drafterFetch(`/api/drafter/register-rows/${rowId}/override`, {
      method: "POST",
      body: JSON.stringify({ checkName, resolution, note }),
    });
    if (!res.ok && "error" in res.data) {
      setMessage(res.data.error ?? "Could not resolve issue");
      return;
    }
    await reload();
  }

  async function acceptVersion() {
    if (!data?.latestVersion) return;
    setBusy(true);
    setMessage(null);
    const res = await drafterFetch(`/api/drafter/register/${importId}/versions`, {
      method: "POST",
      body: JSON.stringify({ versionId: data.latestVersion.id, action: "accept" }),
    });
    setBusy(false);
    if (!res.ok && "error" in res.data) {
      setMessage(res.data.error ?? "Could not accept this version");
      return;
    }
    setMessage("Version accepted. Controls built into the library.");
    await reload();
  }

  if (!data) {
    return (
      <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Register", href: "/drafter/register" }]}>
        <main className="flex-1 max-w-[1800px] mx-auto px-4 py-8 text-sm text-text-muted">Loading...</main>
      </ToolFrame>
    );
  }

  const blockedRows = data.rows.filter((r) => r.is_blocked);
  const canAccept = data.latestVersion && data.latestVersion.status !== "accepted" && blockedRows.length === 0;

  return (
    <ToolFrame
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "PRA Drafter", href: "/drafter" },
        { label: "Register", href: "/drafter/register" },
        { label: data.registerImport.sheet_name },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{data.registerImport.sheet_name}</h1>
              <p className="text-sm text-text-muted mt-1">
                Version {data.latestVersion?.version ?? "-"} &middot; {data.rows.length} row(s) &middot;{" "}
                {blockedRows.length} blocked
              </p>
            </div>
            <div className="flex items-center gap-2">
              {data.latestVersion?.status === "accepted" ? (
                <Badge variant="success">Accepted</Badge>
              ) : (
                <Button disabled={!canAccept || busy} onClick={acceptVersion}>
                  Accept version
                </Button>
              )}
            </div>
          </div>

          {message && <div className="glass-card rounded-xl p-4 text-sm mb-6">{message}</div>}

          {data.missingColumnIssues.length > 0 && (
            <div className="glass-card rounded-xl p-5 mb-6">
              <h2 className="font-medium text-foreground mb-3">Missing columns</h2>
              <ul className="space-y-1">
                {data.missingColumnIssues.map((issue, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[issue.severity]}>{issue.severity}</Badge>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass-card rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-foreground">Column mapping</h2>
              <Button size="sm" variant="secondary" disabled={busy} onClick={saveMapping}>
                Save mapping &amp; revalidate
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th className="pb-2 pr-4">Source header</th>
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2">Field key</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingDraft.map((col, idx) => (
                    <tr key={col.sourceHeader} className="border-t border-white/5">
                      <td className="py-1.5 pr-4">{col.sourceHeader}</td>
                      <td className="py-1.5 pr-4">
                        <select
                          className="bg-white/5 border border-white/10 rounded px-2 py-1"
                          value={col.role}
                          onChange={(e) => {
                            const next = [...mappingDraft];
                            next[idx] = { ...next[idx], role: e.target.value as ColumnRole };
                            setMappingDraft(next);
                          }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 font-mono text-text-muted">{col.fieldKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <h2 className="font-medium text-foreground mb-3">Rows</h2>
            <div className="space-y-3">
              {data.rows.map((row) => (
                <div key={row.id} className={`rounded-lg p-4 border ${row.is_blocked ? "border-red-500/30 bg-red-500/5" : "border-white/10"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">
                      Row {row.row_index + 1} {row.req_id && <span className="text-text-muted font-normal">&middot; {row.req_id}</span>}
                    </p>
                    {row.is_blocked ? <Badge variant="danger">Blocked</Badge> : <Badge variant="success">Clear</Badge>}
                  </div>
                  {row.validation_issues.length === 0 ? (
                    <p className="text-xs text-text-muted">No issues.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {row.validation_issues.map((issue, i) => {
                        const resolution = data.overridesByRow[row.id]?.[issue.check];
                        return (
                          <li key={i} className="text-xs flex items-center gap-2 flex-wrap">
                            <Badge variant={SEVERITY_VARIANT[issue.severity]}>{issue.severity}</Badge>
                            <span>{issue.message}</span>
                            {issue.severity === "blocking" &&
                              (resolution ? (
                                <span className="ml-auto flex items-center gap-1.5">
                                  <Badge variant="success">
                                    {resolution.resolution === "overridden" ? "Overridden" : "Resolved"} by {resolution.actor}
                                  </Badge>
                                  {resolution.note && <span className="text-text-muted italic">&ldquo;{resolution.note}&rdquo;</span>}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 ml-auto">
                                  <Button size="sm" variant="secondary" onClick={() => resolveIssue(row.id, issue.check, "resolved")}>
                                    Mark resolved
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => resolveIssue(row.id, issue.check, "overridden")}>
                                    Override
                                  </Button>
                                </span>
                              ))}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </ToolFrame>
  );
}
