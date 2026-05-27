import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type MarketplaceFilterState = {
  filter: string;
  setFilter: (v: string) => void;
  professionFilter: string;
  setProfessionFilter: (v: string) => void;
  companyFilter: string;
  setCompanyFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
};

type Options = {
  professionOptions: { activeList: string[]; inactiveList: string[] };
  companyOptions: { activeList: string[]; inactiveList: string[] };
  categoryOptions: { activeList: string[]; inactiveList: string[] };
};

type Props = MarketplaceFilterState &
  Options & {
    layout?: "grid" | "stack";
    showSearch?: boolean;
  };

export function MarketplaceFilters({
  filter,
  setFilter,
  professionFilter,
  setProfessionFilter,
  companyFilter,
  setCompanyFilter,
  categoryFilter,
  setCategoryFilter,
  dateFilter,
  setDateFilter,
  sortBy,
  setSortBy,
  professionOptions,
  companyOptions,
  categoryOptions,
  layout = "grid",
  showSearch = true,
}: Props) {
  const isStack = layout === "stack";

  return (
    <div
      className={
        isStack
          ? "flex flex-col gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      }
    >
      {showSearch && (
        <div className={isStack ? "w-full" : "relative sm:col-span-2 lg:col-span-2"}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search title, description..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 h-10 sm:h-9 bg-background border-border/80 w-full text-sm sm:text-xs"
          />
        </div>
      )}

      <FilterSelect
        value={professionFilter}
        onChange={setProfessionFilter}
        placeholder="Profession / Role"
        allLabel="All Professions"
        activeLabel="Active"
        inactiveLabel="Other Kenyan Professions"
        activeList={professionOptions.activeList}
        inactiveList={professionOptions.inactiveList}
      />

      <FilterSelect
        value={companyFilter}
        onChange={setCompanyFilter}
        placeholder="Company"
        allLabel="All Companies"
        activeLabel="Active"
        inactiveLabel="Other Kenyan Companies"
        activeList={companyOptions.activeList}
        inactiveList={companyOptions.inactiveList}
      />

      <FilterSelect
        value={categoryFilter}
        onChange={setCategoryFilter}
        placeholder="Category / Sector"
        allLabel="All Categories"
        activeLabel="Active Sectors"
        inactiveLabel="Other Sectors"
        activeList={categoryOptions.activeList}
        inactiveList={categoryOptions.inactiveList}
      />

      <Select value={dateFilter} onValueChange={setDateFilter}>
        <SelectTrigger className="h-10 sm:h-9 bg-background border-border/80 text-sm sm:text-xs w-full">
          <SelectValue placeholder="Date Posted" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Any time
          </SelectItem>
          <SelectItem value="24h" className="text-xs">
            Past 24 hours
          </SelectItem>
          <SelectItem value="week" className="text-xs">
            Past week
          </SelectItem>
          <SelectItem value="month" className="text-xs">
            Past month
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="h-10 sm:h-9 bg-background border-border/80 text-sm sm:text-xs w-full">
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest" className="text-xs">
            Newest first
          </SelectItem>
          <SelectItem value="oldest" className="text-xs">
            Oldest first
          </SelectItem>
          <SelectItem value="company" className="text-xs">
            Company A-Z
          </SelectItem>
          <SelectItem value="title" className="text-xs">
            Title A-Z
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  allLabel,
  activeLabel,
  inactiveLabel,
  activeList,
  inactiveList,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  allLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  activeList: string[];
  inactiveList: string[];
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = useMemo(() => {
    if (value === "all") return allLabel;
    return [...activeList, ...inactiveList].find((item) => item === value) ?? value;
  }, [activeList, allLabel, inactiveList, value]);

  return (
    <Select value={value} onValueChange={onChange} onOpenChange={setOpen}>
      <SelectTrigger className="h-10 sm:h-9 bg-background border-border/80 text-sm sm:text-xs w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          {allLabel}
        </SelectItem>
        {value !== "all" && !open && (
          <SelectItem value={value} className="text-xs">
            {currentLabel}
          </SelectItem>
        )}
        {open && activeList.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
              {activeLabel} ({activeList.length})
            </SelectLabel>
            {activeList.map((item) => (
              <SelectItem key={item} value={item} className="text-xs">
                {item}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {open && inactiveList.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
              {inactiveLabel}
            </SelectLabel>
            {inactiveList.map((item) => (
              <SelectItem key={item} value={item} className="text-xs">
                {item}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
