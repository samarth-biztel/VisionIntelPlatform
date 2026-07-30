export function Badge({ children, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? "bg-accent text-white dark:text-white"
      : "bg-secondary text-secondary-foreground";

  return (
    <span className={`rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-[0.16em] ${toneClass}`}>
      {children}
    </span>
  );
}
