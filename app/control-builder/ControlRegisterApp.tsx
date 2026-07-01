"use client";

import { useMemo, useState } from "react";
import AppShell, { type Crumb, type FirmContext } from "@/components/layout/AppShell";
import RegisterTable from "@/components/controls/register/RegisterTable";
import BuilderWizard from "@/components/controls/builder/BuilderWizard";
import AddControlsModal from "@/components/controls/AddControlsModal";
import { allControls, getControlBySlug, controlsForFirmType } from "@/data/controls";
import type { ControlOverride } from "@/data/controls/types";
import type { FirmType } from "@/data/typologies/types";

type View = "register" | "builder";

export default function ControlRegisterApp({
  initialSlugs,
  contextLabel,
  initialFirmType,
}: {
  initialSlugs: string[];
  contextLabel?: string;
  initialFirmType?: FirmType;
}) {
  const [selected, setSelected] = useState<string[]>(initialSlugs);
  const [overrides, setOverrides] = useState<Record<string, ControlOverride>>({});
  const [tested, setTested] = useState<Record<string, number[]>>({});
  const [view, setView] = useState<View>("register");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [firmContext, setFirmContext] = useState<FirmContext>(initialFirmType ?? "all");
  const [showAdd, setShowAdd] = useState(false);

  const selectedControls = useMemo(
    () => selected.map(getControlBySlug).filter(Boolean) as NonNullable<ReturnType<typeof getControlBySlug>>[],
    [selected]
  );

  const setOverride = (slug: string, patch: Partial<ControlOverride>) =>
    setOverrides((o) => ({ ...o, [slug]: { ...(o[slug] ?? {}), ...patch } }));
  const resetOverride = (slug: string) =>
    setOverrides((o) => { const n = { ...o }; delete n[slug]; return n; });

  const toggleTest = (slug: string, idx: number) =>
    setTested((t) => {
      const cur = t[slug] ?? [];
      const next = cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx];
      return { ...t, [slug]: next };
    });

  const add = (slug: string) => {
    if (!getControlBySlug(slug) || selected.includes(slug)) return;
    setSelected((s) => [...s, slug]);
    setActiveSlug(slug);
  };
  const remove = (slug: string) => {
    setSelected((s) => s.filter((x) => x !== slug));
    resetOverride(slug);
    setActiveSlug((a) => (a === slug ? null : a));
  };

  const switchFirm = (fc: FirmContext) => {
    setFirmContext(fc);
    const next = fc === "all" ? allControls : controlsForFirmType(fc);
    const slugs = next.map((c) => c.slug);
    setSelected(slugs);
    setActiveSlug(null);
    // Switching firm context reloads the register; return to it so we never keep
    // editing a control that may no longer belong to the new firm's set.
    setView("register");
  };

  // "Edit" from the register: the control is already in the register (add is a
  // safety no-op if not). Opens the builder on it.
  const openBuilder = (slug: string) => {
    if (!selected.includes(slug) && getControlBySlug(slug)) setSelected((s) => [...s, slug]);
    setActiveSlug(slug);
    setView("builder");
  };

  // Browsing the builder's library / linked controls: navigate to the control
  // WITHOUT silently adding it to the register (and thus the export). The wizard
  // shows an explicit "Add to register" when the control is not yet in it.
  const navigateBuilder = (slug: string) => {
    if (!getControlBySlug(slug)) return;
    setActiveSlug(slug);
    setView("builder");
  };

  const onSelectInApp = (id: "controls" | "control-builder") => {
    if (id === "controls") { setView("register"); setActiveSlug(null); }
    else { setActiveSlug((a) => a ?? selected[0] ?? null); setView("builder"); }
  };

  const backToRegister = () => { setView("register"); setActiveSlug(null); };

  const builderControl = activeSlug ? getControlBySlug(activeSlug) : selectedControls[0];

  const breadcrumb: Crumb[] =
    view === "register"
      ? [{ label: "Home", href: "/" }, { label: "Controls", onClick: () => setView("register") }, { label: "Control Register" }]
      : [{ label: "Control Register", onClick: () => setView("register") }, { label: "Control Builder" }, { label: "Edit Control" }];

  return (
    <AppShell
      breadcrumb={breadcrumb}
      activeId={view === "register" ? "controls" : "control-builder"}
      activeTopNav="Control Builder"
      onSelectInApp={onSelectInApp}
      firm={{ value: firmContext, onChange: switchFirm }}
    >
      {view === "register" ? (
        <RegisterTable
          controls={selectedControls}
          overrides={overrides}
          setOverride={setOverride}
          tested={tested}
          onToggleTest={toggleTest}
          activeSlug={activeSlug}
          setActiveSlug={setActiveSlug}
          onEdit={openBuilder}
          onAdd={() => setShowAdd(true)}
          contextLabel={contextLabel}
        />
      ) : builderControl ? (
        <BuilderWizard
          key={builderControl.slug}
          control={builderControl}
          override={overrides[builderControl.slug] ?? {}}
          setOverride={(patch) => setOverride(builderControl.slug, patch)}
          resetOverride={() => resetOverride(builderControl.slug)}
          tested={tested[builderControl.slug] ?? []}
          onToggleTest={(idx) => toggleTest(builderControl.slug, idx)}
          registerSlugs={selected}
          onSelectControl={navigateBuilder}
          onAddToRegister={() => add(builderControl.slug)}
          onBackToRegister={backToRegister}
          onAdd={() => setShowAdd(true)}
        />
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-text-muted">Your register is empty. <button onClick={() => setShowAdd(true)} className="text-accent hover:underline">Add a control</button> to start building.</p>
        </div>
      )}

      <p className="px-4 sm:px-6 pb-6 text-xs text-text-muted/80 max-w-4xl">
        This tool produces a control specification for design and discussion. It is not legal advice; validate thresholds,
        ownership and status against your own risk assessment and the cited sources before implementing. Nothing is saved to a server.
      </p>

      <AddControlsModal open={showAdd} onClose={() => setShowAdd(false)} selected={selected} onAdd={add} onRemove={remove} />
    </AppShell>
  );
}
