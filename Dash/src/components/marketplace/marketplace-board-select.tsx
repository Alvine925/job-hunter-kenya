import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { MARKETPLACE_BOARDS, type MarketplaceBoardId } from "@/lib/scraped-jobs";

import { cn } from "@/lib/utils";



type Props = {

  value: MarketplaceBoardId;

  onValueChange: (value: MarketplaceBoardId) => void;

  counts: Record<string, number>;

  className?: string;

  id?: string;

};



export function MarketplaceBoardSelect({

  value,

  onValueChange,

  counts,

  className,

  id,

}: Props) {

  return (

    <Select value={value} onValueChange={(v) => onValueChange(v as MarketplaceBoardId)}>

      <SelectTrigger

        id={id}

        className={cn(

          "h-10 sm:h-9 bg-background border-border/80 text-sm w-full",

          className,

        )}

      >

        <SelectValue placeholder="Select job board" />

      </SelectTrigger>

      <SelectContent>
        {MARKETPLACE_BOARDS.map((b) => (
          <SelectItem key={b.id} value={b.id} className="text-xs">
            <span className="flex w-full items-center justify-between gap-4">
              <span>{b.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>

    </Select>

  );

}

