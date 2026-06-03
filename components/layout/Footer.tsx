import FinCrimeLogo from "@/components/brand/FinCrimeLogo";

export default function Footer() {
  return (
    <footer className="border-t border-card-border mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FinCrimeLogo variant="icon" size="sm" animated={false} />
            <span className="text-sm text-text-muted">
              MEMA Consultants Ltd &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>Sources: FATF | Wolfsberg | FCA | JMLSG</span>
          </div>
          <a
            href="https://memaconsultants.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            memaconsultants.com
          </a>
        </div>
      </div>
    </footer>
  );
}
