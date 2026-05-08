interface ResultsGridProps {
  children: React.ReactNode;
}

export default function ResultsGrid({ children }: ResultsGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">{children}</div>
  );
}
