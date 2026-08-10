"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, Users, ShieldCheck, SlidersHorizontal, Building2, Plus, Trash2 } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { compareToAppetite, type AppetiteResult } from "@/data/scoring/residual-risk";
import type { PersonDTO, PersonRole } from "@/components/pra/types";

interface WorkspaceSettingsShape {
  defaultHourlyCostGbp: number;
  defaultTestSampleSize: number;
  organisationName: string | null;
  dateFormat: "en-GB" | "iso";
  reviewReminderDays: number;
}

interface SettingsResponse {
  name: string | null;
  ownerEmail: string | null;
  appetiteThresholds: { toleratedFrom: number; outsideFrom: number };
  settings: WorkspaceSettingsShape;
}

const APPETITE_BAND_LABEL: Record<AppetiteResult, string> = {
  within: "Within appetite",
  tolerated: "Tolerated",
  outside: "Outside appetite",
};

const APPETITE_BAND_CLASS: Record<AppetiteResult, string> = {
  within: "text-accent",
  tolerated: "text-amber-500",
  outside: "text-red-500",
};

const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

type SaveState = "idle" | "saving" | "saved" | "error";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof SettingsIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-text-muted mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="text-xs text-text-muted">Saving...</span>;
  if (state === "saved") return <span className="text-xs text-accent">Saved</span>;
  if (state === "error") return <span className="text-xs text-red-500">Could not save</span>;
  return null;
}

export default function SettingsPage() {
  const { workspaceId, ready, wsFetch } = useWorkspace();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Local, editable drafts - reset from `data` (the server's response) every
  // time it changes, so a save always ends by reflecting what the server
  // actually stored, never what the form merely had typed into it.
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [dateFormat, setDateFormat] = useState<"en-GB" | "iso">("en-GB");
  const [toleratedFrom, setToleratedFrom] = useState("40");
  const [outsideFrom, setOutsideFrom] = useState("60");
  const [previewScore, setPreviewScore] = useState("50");
  const [hourlyCost, setHourlyCost] = useState("35");
  const [sampleSize, setSampleSize] = useState("25");
  const [reminderDays, setReminderDays] = useState("30");

  const [orgSave, setOrgSave] = useState<SaveState>("idle");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [appetiteSave, setAppetiteSave] = useState<SaveState>("idle");
  const [appetiteError, setAppetiteError] = useState<string | null>(null);
  const [opSave, setOpSave] = useState<SaveState>("idle");
  const [opError, setOpError] = useState<string | null>(null);

  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<PersonRole>("owner");
  const [newEmail, setNewEmail] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  const applyFromServer = useCallback((response: SettingsResponse) => {
    setData(response);
    setName(response.name ?? "");
    setOwnerEmail(response.ownerEmail ?? "");
    setOrganisationName(response.settings.organisationName ?? "");
    setDateFormat(response.settings.dateFormat);
    setToleratedFrom(String(response.appetiteThresholds.toleratedFrom));
    setOutsideFrom(String(response.appetiteThresholds.outsideFrom));
    setHourlyCost(String(response.settings.defaultHourlyCostGbp));
    setSampleSize(String(response.settings.defaultTestSampleSize));
    setReminderDays(String(response.settings.reviewReminderDays));
  }, []);

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, peopleRes] = await Promise.all([
          wsFetch("/api/workspace/settings"),
          wsFetch("/api/workspace/people"),
        ]);
        if (!settingsRes.ok) throw new Error("failed");
        const settingsData: SettingsResponse = await settingsRes.json();
        if (!cancelled) applyFromServer(settingsData);

        if (peopleRes.ok) {
          const peopleData = await peopleRes.json();
          if (!cancelled) setPeople(Array.isArray(peopleData.people) ? peopleData.people : []);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load workspace settings. Refresh to try again.");
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, applyFromServer]);

  const saveOrganisation = async () => {
    setOrgSave("saving");
    setOrgError(null);
    try {
      const res = await wsFetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          ownerEmail: ownerEmail.trim() || null,
          settings: { organisationName: organisationName.trim() || null, dateFormat },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setOrgSave("error");
        setOrgError(typeof body?.error === "string" ? body.error : "Could not save.");
        return;
      }
      applyFromServer(body);
      setOrgSave("saved");
    } catch {
      setOrgSave("error");
      setOrgError("Could not save. Please try again.");
    }
  };

  const saveAppetite = async () => {
    const tolerated = Number(toleratedFrom);
    const outside = Number(outsideFrom);
    setAppetiteSave("saving");
    setAppetiteError(null);
    try {
      const res = await wsFetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appetiteThresholds: { toleratedFrom: tolerated, outsideFrom: outside } }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAppetiteSave("error");
        setAppetiteError(typeof body?.error === "string" ? body.error : "Could not save.");
        return;
      }
      applyFromServer(body);
      setAppetiteSave("saved");
    } catch {
      setAppetiteSave("error");
      setAppetiteError("Could not save. Please try again.");
    }
  };

  const saveOperational = async () => {
    setOpSave("saving");
    setOpError(null);
    try {
      const res = await wsFetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            defaultHourlyCostGbp: Number(hourlyCost),
            defaultTestSampleSize: Number(sampleSize),
            reviewReminderDays: Number(reminderDays),
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setOpSave("error");
        setOpError(typeof body?.error === "string" ? body.error : "Could not save.");
        return;
      }
      applyFromServer(body);
      setOpSave("saved");
    } catch {
      setOpSave("error");
      setOpError("Could not save. Please try again.");
    }
  };

  const addPerson = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAddingPerson(true);
    setPeopleError(null);
    try {
      const res = await wsFetch("/api/workspace/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, role: newRole, email: newEmail.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setPeopleError(typeof body?.error === "string" ? body.error : "Could not add that person.");
        return;
      }
      setPeople((prev) => [...prev, body.person]);
      setNewName("");
      setNewEmail("");
    } catch {
      setPeopleError("Could not add that person. Please try again.");
    } finally {
      setAddingPerson(false);
    }
  };

  const removePerson = async (id: string) => {
    setPeopleError(null);
    try {
      const res = await wsFetch(`/api/workspace/people/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPeopleError(typeof body?.error === "string" ? body.error : "Could not remove that person.");
        return;
      }
      setPeople((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setPeopleError("Could not remove that person. Please try again.");
    }
  };

  const noWorkspaceYet = ready && !workspaceId;

  const previewScoreNum = Number(previewScore);
  const previewBand: AppetiteResult | null = Number.isFinite(previewScoreNum)
    ? compareToAppetite(previewScoreNum, {
        toleratedFrom: Number(toleratedFrom) || 0,
        outsideFrom: Number(outsideFrom) || 100,
      })
    : null;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Governance" }, { label: "Settings" }]}>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ToolPageHeader
            eyebrow="GOVERNANCE"
            title="Workspace"
            titleAccent="Settings"
            subtitle="Organisation identity, risk appetite thresholds, operational defaults, and the people who own, review and approve work in this workspace."
          />

          {noWorkspaceYet ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <SettingsIcon className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No workspace yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto">
                Settings apply to a saved workspace. Start a product risk assessment, control test or another
                workflow first - a workspace is created automatically the first time you save something, and
                Settings will be here waiting for it.
              </p>
            </div>
          ) : loadError ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-text-muted">{loadError}</p>
            </div>
          ) : !data ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-text-muted">Loading settings...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Organisation */}
              <SectionCard
                icon={Building2}
                title="Organisation"
                description="Identifies this workspace and prints on every generated PDF's header."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Workspace name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveOrganisation} />
                  <Input
                    type="email"
                    label="Owner email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    onBlur={saveOrganisation}
                  />
                  <Input
                    label="Organisation name (for PDF packs)"
                    value={organisationName}
                    onChange={(e) => setOrganisationName(e.target.value)}
                    onBlur={saveOrganisation}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ink-soft">Date format</label>
                    <select
                      value={dateFormat}
                      onChange={(e) => {
                        setDateFormat(e.target.value as "en-GB" | "iso");
                      }}
                      onBlur={saveOrganisation}
                      className="px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      <option value="en-GB">DD/MM/YYYY (en-GB)</option>
                      <option value="iso">YYYY-MM-DD (ISO)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="secondary" onClick={saveOrganisation}>
                    Save organisation
                  </Button>
                  <SaveStatus state={orgSave} />
                  {orgError && <span className="text-xs text-red-500">{orgError}</span>}
                </div>
              </SectionCard>

              {/* Risk appetite */}
              <SectionCard
                icon={ShieldCheck}
                title="Risk appetite"
                description="The residual-risk score bands used across every product risk assessment. toleratedFrom must be strictly below outsideFrom."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    label="Tolerated from (0-100)"
                    value={toleratedFrom}
                    onChange={(e) => setToleratedFrom(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    label="Outside from (0-100)"
                    value={outsideFrom}
                    onChange={(e) => setOutsideFrom(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="secondary" onClick={saveAppetite}>
                    Save thresholds
                  </Button>
                  <SaveStatus state={appetiteSave} />
                  {appetiteError && <span className="text-xs text-red-500">{appetiteError}</span>}
                </div>

                <div className="pt-3 border-t border-surface-border">
                  <div className="flex items-end gap-3 flex-wrap">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      label="Preview a residual score"
                      value={previewScore}
                      onChange={(e) => setPreviewScore(e.target.value)}
                      className="max-w-[160px]"
                    />
                    {previewBand && (
                      <p className={`text-sm font-medium ${APPETITE_BAND_CLASS[previewBand]}`}>
                        {APPETITE_BAND_LABEL[previewBand]}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    Computed live with the real compareToAppetite function against the thresholds above (not yet
                    saved values included).
                  </p>
                </div>
              </SectionCard>

              {/* Operational defaults */}
              <SectionCard
                icon={SlidersHorizontal}
                title="Operational defaults"
                description="Feed the operational-load calculator, new control tests, and the governance dashboard's due-soon window."
              >
                <div className="grid sm:grid-cols-3 gap-4">
                  <Input
                    type="number"
                    min={0}
                    label="Default hourly cost (£)"
                    value={hourlyCost}
                    onChange={(e) => setHourlyCost(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={1}
                    label="Default test sample size"
                    value={sampleSize}
                    onChange={(e) => setSampleSize(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    label="Review reminder (days)"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="secondary" onClick={saveOperational}>
                    Save operational defaults
                  </Button>
                  <SaveStatus state={opSave} />
                  {opError && <span className="text-xs text-red-500">{opError}</span>}
                </div>
              </SectionCard>

              {/* People */}
              <SectionCard
                icon={Users}
                title="People"
                description="Owners, reviewers and approvers named on decisions, tests, conditions and actions across the workspace."
              >
                {peopleLoading ? (
                  <p className="text-sm text-text-muted">Loading people...</p>
                ) : people.length === 0 ? (
                  <p className="text-sm text-text-muted">No people added yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {people.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="text-foreground">{p.name}</span>
                          <span className="text-xs text-text-muted ml-2">({p.role})</span>
                          {p.email && <span className="text-xs text-text-muted ml-2">{p.email}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removePerson(p.id)}
                          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-red-500 cursor-pointer shrink-0"
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-surface-border space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-ink-soft">Role</label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as PersonRole)}
                        className="px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                      >
                        {PERSON_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      type="email"
                      label="Email (optional)"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={addPerson} disabled={addingPerson || !newName.trim()}>
                    <Plus className="h-3.5 w-3.5" /> {addingPerson ? "Adding..." : "Add person"}
                  </Button>
                  {peopleError && <p className="text-xs text-red-500">{peopleError}</p>}
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}
