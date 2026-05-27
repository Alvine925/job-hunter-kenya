import { useEffect, useRef, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import { parseCsv, searchRoleSuggestions, joinCsv } from "@/lib/configuration-suggestions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  dynamicRoles?: string[];
};

export function RoleSearchField({ value, onChange, dynamicRoles = [] }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = parseCsv(value);
  const suggestions = searchRoleSuggestions(query);

  const scrapedSuggestions = useMemo(() => {
    if (!dynamicRoles || !dynamicRoles.length) return [];
    const q = query.trim().toLowerCase();
    
    // Filter out roles that are already in the preset suggestions to avoid duplicates
    const presetSet = new Set(suggestions.map((s) => s.label.toLowerCase()));
    const activeRoles = dynamicRoles.filter((r) => !presetSet.has(r.toLowerCase()));

    if (!q) {
      return activeRoles.slice(0, 5).map((r) => ({ label: r }));
    }
    return activeRoles
      .filter((r) => r.toLowerCase().includes(q))
      .slice(0, 10)
      .map((r) => ({ label: r }));
  }, [dynamicRoles, query, suggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const addRole = (role: string) => {
    const lower = role.toLowerCase();
    if (selected.some((s) => s.toLowerCase() === lower)) return;
    onChange(joinCsv([...selected, role]));
    setQuery("");
    setOpen(false);
  };

  const removeRole = (role: string) => {
    onChange(joinCsv(selected.filter((s) => s.toLowerCase() !== role.toLowerCase())));
  };

  return (
    <div ref={wrapRef}>
      <Label>Target roles</Label>
      <div className="relative mt-1.5">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              addRole(query.trim());
            }
          }}
          placeholder="Search roles — try M&E, Program Officer, Data Analyst…"
          className="pl-9 text-xs"
        />
        {open && (query.length > 0 || suggestions.length > 0 || scrapedSuggestions.length > 0) && (
          <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md text-sm divide-y divide-border/50">
            {suggestions.length === 0 && scrapedSuggestions.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground text-xs">
                No matches — press Enter to add &quot;{query}&quot;
              </li>
            ) : (
              <>
                {suggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1 bg-muted/30 font-semibold sticky top-0 bg-popover">
                      Standard Professions
                    </div>
                    <ul>
                      {suggestions.map((s) => (
                        <li key={s.label}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted flex flex-col"
                            onClick={() => addRole(s.label)}
                          >
                            <span className="text-xs font-medium">{s.label}</span>
                            {s.matchedVia && (
                              <span className="text-[10px] text-muted-foreground">Also matches: {s.matchedVia}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {scrapedSuggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1 bg-muted/30 font-semibold sticky top-0 bg-popover">
                      Active from Scraped Jobs
                    </div>
                    <ul>
                      {scrapedSuggestions.map((s) => (
                        <li key={s.label}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted flex flex-col"
                            onClick={() => addRole(s.label)}
                          >
                            <span className="text-xs font-medium">{s.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {query.trim() &&
              !suggestions.some((s) => s.label.toLowerCase() === query.trim().toLowerCase()) &&
              !scrapedSuggestions.some((s) => s.label.toLowerCase() === query.trim().toLowerCase()) && (
                <li>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-primary text-xs font-medium"
                    onClick={() => addRole(query.trim())}
                  >
                    Add custom: {query.trim()}
                  </button>
                </li>
              )}
          </ul>
        )}
      </div>
      <Input
        className="mt-2 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or edit comma-separated list directly"
      />
      {selected.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {selected.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
            >
              {role}
              <button type="button" onClick={() => removeRole(role)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
