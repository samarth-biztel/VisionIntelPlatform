import { Moon, Search, Sun } from "lucide-react";

export function TopNav({ onOpenCommand, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur md:px-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Core Supervisor</p>
        <h1 className="font-display text-2xl font-black tracking-normal md:text-3xl">Vision Intel Platform</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="hidden min-w-64 items-center justify-between border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:-translate-y-0.5 md:flex"
          data-testid="global-search-button"
          type="button"
          onClick={onOpenCommand}
        >
          <span className="flex items-center gap-2">
            <Search size={16} strokeWidth={1.5} />
            Search
          </span>
          <kbd className="text-xs font-bold">Cmd K</kbd>
        </button>
        <button
          className="grid size-11 place-items-center border border-border bg-card hover:-translate-y-0.5 active:scale-95"
          data-testid="theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
        </button>
      </div>
    </header>
  );
}
