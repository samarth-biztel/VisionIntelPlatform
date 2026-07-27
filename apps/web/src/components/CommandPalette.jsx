import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const commands = [
  "Dashboard",
  "Service Registry",
  "Config Editor",
  "Health Monitoring",
  "Logs",
  "Module Manager",
  "Settings"
];

export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const visibleCommands = useMemo(
    () => commands.filter((command) => command.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto mt-20 max-w-2xl border border-border bg-card shadow-neopop">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search size={18} strokeWidth={1.5} />
          <input
            autoFocus
            className="h-10 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            data-testid="command-palette-input"
            placeholder="Search platform"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="grid size-9 place-items-center border border-border hover:-translate-y-0.5 active:scale-95"
            data-testid="command-palette-close"
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-2">
          {visibleCommands.map((command) => (
            <button
              className="flex w-full items-center justify-between rounded-sm px-4 py-3 text-left text-sm font-semibold hover:bg-secondary active:scale-[0.99]"
              data-testid={`command-${command.toLowerCase().replaceAll(" ", "-")}`}
              type="button"
              key={command}
              onClick={onClose}
            >
              {command}
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Open</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
