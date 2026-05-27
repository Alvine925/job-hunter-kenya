import { cn } from "@/lib/utils";
import { MARKETPLACE_BOARDS, type MarketplaceBoardId } from "@/lib/scraped-jobs";
import { LayoutGrid } from "lucide-react";

type Props = {
  active: MarketplaceBoardId;
  counts: Record<string, number>;
  onSelect: (board: MarketplaceBoardId) => void;
};

export function MarketplaceSidebar({ active, counts, onSelect }: Props) {
  return (
    <aside className="w-full lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-border/80 bg-background">
      <div className="p-4 lg:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
          <LayoutGrid className="w-4 h-4 text-primary" />
          Marketplace
        </div>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          {MARKETPLACE_BOARDS.map((board) => {
            const count = counts[board.id] ?? 0;
            const isActive = active === board.id;
            return (
              <button
                key={board.id}
                type="button"
                onClick={() => onSelect(board.id)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition whitespace-nowrap lg:w-full",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <span>{board.label}</span>
                <span
                  className={cn(
                    "tabular-nums text-xs rounded-md px-1.5 py-0.5 min-w-[1.75rem] text-center",
                    isActive ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
