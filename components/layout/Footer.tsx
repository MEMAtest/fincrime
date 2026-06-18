import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer wrap">
      <div className="footer-grid">
        <div>
          <Link className="brand" href="/">
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <span className="brand-text">
              <b>FinCrime Control Lab</b>
              <span>Financial crime, controlled.</span>
            </span>
          </Link>
          <p className="fdesc">
            Design financial crime controls mapped to authoritative frameworks and
            real enforcement, free and deterministic.
          </p>
        </div>
        <div className="fcol">
          <h4>Tools</h4>
          <Link href="/typology-iq">TypologyIQ</Link>
          <Link href="/partner-control-map">PartnerControlMap</Link>
          <Link href="/controls">Controls Library</Link>
          <Link href="/kyc-requirements">KYC Matrix</Link>
          <Link href="/firm-research">AI in Research</Link>
        </div>
        <div className="fcol">
          <h4>Frameworks</h4>
          <Link href="/controls?framework=fatf">FATF</Link>
          <Link href="/controls?framework=wolfsberg">Wolfsberg</Link>
          <Link href="/controls?framework=fca">FCA</Link>
          <Link href="/controls?framework=jmlsg">JMLSG</Link>
        </div>
        <div className="fcol">
          <h4>Learn</h4>
          <Link href="/glossary">Glossary</Link>
          <Link href="/methodology">Methodology</Link>
          <a href="https://memaconsultants.com" target="_blank" rel="noopener noreferrer">Talk to MEMA</a>
          <Link href="/firm-research">Get started</Link>
        </div>
      </div>
      <div className="footer-base">
        <span className="l">© {new Date().getFullYear()} FINCRIME CONTROL LAB · A MEMA CONSULTANTS INITIATIVE</span>
        <span className="badges">
          <span className="badge">FATF-aligned</span>
          <span className="badge">Wolfsberg</span>
          <span className="badge">FCA</span>
          <span className="badge">JMLSG</span>
        </span>
      </div>
    </footer>
  );
}
