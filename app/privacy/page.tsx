import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy: what the FinCrime Control Lab collects",
  description:
    "How the FinCrime Control Lab handles your data: assessment work stays in your browser; contact details are only collected when you request an export.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-[11px] uppercase tracking-wider text-accent font-medium mb-1">Privacy</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">What we collect, and what we do not</h1>
          <p className="text-text-muted text-sm mt-3 leading-relaxed">
            The FinCrime Control Lab is a free set of design tools operated by MEMA Consultants. This page explains,
            in plain terms, how it handles your data.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground leading-relaxed">
            <Section title="Your assessment work stays in your browser">
              Everything you do in the tools (typology selections, control ratings, owners, thresholds, KYC checklists,
              maturity answers) is held in your own browser. It is not sent to or stored on our servers, and it is not
              tied to an account. Clearing your browser storage removes it.
            </Section>

            <Section title="We only store contact details you give us for an export">
              When you request a PDF or Word export, we ask for your name, work email, firm and role. We store those
              details so we can send you the document and, if you opt in, occasional updates. We do not receive the
              contents of your assessment with that request beyond what is needed to generate the document you asked for.
            </Section>

            <Section title="How we use it">
              To deliver the export you requested, to respond if you contact us, and, only where you opt in, to send you
              relevant financial-crime updates. We do not sell your details. You can ask us to delete them at any time.
            </Section>

            <Section title="Cited sources and external regulators">
              Citations throughout the tools open in an on-page reference panel rather than navigating you off-site. The
              underlying source URLs point to primary regulators (FATF, the FCA, JMLSG and others); visiting those is
              your choice.
            </Section>

            <Section title="Contact">
              To ask what we hold, or to have it deleted, contact MEMA Consultants at{" "}
              <a href="mailto:contact@memaconsultants.com" className="text-accent hover:underline">contact@memaconsultants.com</a>.
            </Section>
          </div>

          <p className="mt-10 text-xs text-text-muted">
            This is a plain-language summary for the tools on this site, not a substitute for MEMA Consultants{"'"}
            full privacy notice. <Link href="/methodology" className="text-accent hover:underline">See how the lab works</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1.5">{title}</h2>
      <p className="text-text-muted">{children}</p>
    </div>
  );
}
