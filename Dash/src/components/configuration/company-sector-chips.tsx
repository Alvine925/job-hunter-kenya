import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import {
  COMPANY_SECTORS,
  type CompanySectorId,
  companiesForSectors,
  parseCsv,
  joinCsv,
} from "@/lib/configuration-suggestions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  selectedSectors: CompanySectorId[];
  onSectorsChange: (sectors: CompanySectorId[]) => void;
  dynamicCompanies?: string[];
  dynamicSectors?: string[];
};

export function CompanySectorChips({
  value,
  onChange,
  selectedSectors,
  onSectorsChange,
  dynamicCompanies = [],
  dynamicSectors = [],
}: Props) {
  const active = parseCsv(value);

  const sectorOptions = useMemo(() => {
    const keys = Object.keys(COMPANY_SECTORS) as CompanySectorId[];
    return keys
      .filter((id) => id !== "scraped" || dynamicCompanies.length > 0)
      .map((id) => ({
        id,
        label: COMPANY_SECTORS[id].label,
      }));
  }, [dynamicCompanies]);

  const companyOptions = useMemo(() => {
    if (selectedSectors.includes("scraped")) {
      return dynamicCompanies;
    }

    const sectors = selectedSectors.length
      ? selectedSectors
      : (Object.keys(COMPANY_SECTORS) as CompanySectorId[]).filter((s) => s !== "scraped");

    const baseCompanies = companiesForSectors(sectors.filter((s) => s !== "scraped"));

    if (selectedSectors.length === 0) {
      const seen = new Set(baseCompanies);
      const merged = [...baseCompanies];
      for (const c of dynamicCompanies) {
        if (!seen.has(c)) {
          seen.add(c);
          merged.push(c);
        }
      }
      return merged;
    }

    return baseCompanies;
  }, [selectedSectors, dynamicCompanies]);

  const toggleSector = (id: CompanySectorId) => {
    onSectorsChange(
      selectedSectors.includes(id) ? selectedSectors.filter((s) => s !== id) : [...selectedSectors, id],
    );
  };

  const toggleCompany = (name: string) => {
    const lower = name.toLowerCase();
    const exists = active.find((x) => x.toLowerCase() === lower);
    onChange(
      exists
        ? joinCsv(active.filter((x) => x.toLowerCase() !== lower))
        : joinCsv([...active, name]),
    );
  };

  const isActive = (name: string) => active.some((x) => x.toLowerCase() === name.toLowerCase());

  return (
    <div>
      <Label>Target companies (optional)</Label>
      <p className="text-xs text-muted-foreground mt-1">Filter by sector, then pick employers.</p>
      <div className="flex gap-1.5 flex-wrap mt-2">
        {sectorOptions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleSector(s.id)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              selectedSectors.includes(s.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap mt-3 max-h-36 overflow-y-auto p-2 border rounded-md bg-muted/20">
        {companyOptions.map((opt) => {
          const on = isActive(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggleCompany(opt)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
              }`}
            >
              {on ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {opt}
            </button>
          );
        })}
      </div>
      <Input
        className="mt-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Safaricom, Equity Bank, UN Agencies"
      />
      {active.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {active.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
            >
              {item}
              <button type="button" onClick={() => toggleCompany(item)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
