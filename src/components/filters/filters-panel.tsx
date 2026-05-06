import type { ReactNode } from "react";

import { SlidersHorizontal, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FiltersPanelProps {
  isExpanded: boolean;
  onExpandedChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function FiltersPanel({
  isExpanded,
  onExpandedChange,
  children,
  className,
}: FiltersPanelProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Desktop: always visible as horizontal bar */}
      <div className="bg-muted/30 hidden flex-wrap items-center gap-2.5 rounded-lg px-3 py-2 md:flex">
        {children}
      </div>

      {/* Mobile: collapsible */}
      <div className="md:hidden">
        <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
          <div className="bg-muted/30 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={isExpanded ? "Ocultar filtros" : "Mostrar filtros"}
              >
                {isExpanded ? <X className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="pt-2">
            <div className="bg-muted/30 space-y-2.5 rounded-lg px-3 py-3">{children}</div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
