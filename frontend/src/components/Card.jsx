export function Card({ children, className = "" }) {
  return (
    <section className={`border border-border bg-card text-card-foreground rounded-sm p-6 md:p-8 ${className}`}>
      {children}
    </section>
  );
}
