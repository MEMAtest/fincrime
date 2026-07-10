import Link from "next/link";
import { ShieldCheck, ArrowRight, Home, Search, Scale, Layers } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full text-center">
        <div className="marker mb-6 justify-center">
          <span className="tech">
            <span className="ix">◇</span>
            <span className="bar" />
            404
          </span>
          <span className="rule" />
        </div>

        <div className="glass-card rounded-2xl p-10 mb-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-accent" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
          <p className="text-sm text-text-muted leading-relaxed">
            This URL may be a stale shared link or a mistyped path. The tools below will get you back on track.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { href: "/", label: "Home", icon: Home },
            { href: "/typology-iq", label: "TypologyIQ", icon: Search },
            { href: "/enforcement", label: "Enforcement", icon: Scale },
            { href: "/controls", label: "Controls", icon: Layers },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="glass-card rounded-xl p-4 flex items-center gap-3 hover:border-accent/40 transition-colors group text-left"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground flex items-center gap-1">
                {label}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </Link>
          ))}
        </div>

        <Link
          href="/start"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
        >
          Start fresh
        </Link>
      </div>
    </main>
  );
}
