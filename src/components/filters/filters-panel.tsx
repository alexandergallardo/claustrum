import type { ReactNode } from "react"
import { ChevronDown, ChevronRight, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface FiltersPanelProps {
  title?: string
  isExpanded: boolean
  onExpandedChange: (open: boolean) => void
  headerActions?: ReactNode
  children: ReactNode
  contentClassName?: string
}

export function FiltersPanel({
  title = "Filtros",
  isExpanded,
  onExpandedChange,
  headerActions,
  children,
  contentClassName,
}: FiltersPanelProps) {
  return (
    <Card className="sticky top-[calc(var(--header-height)+0.75rem)] z-30 border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <CardContent className="space-y-3 p-3">
        <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{title}</span>
              {headerActions}
            </div>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={isExpanded ? "Ocultar filtros" : "Mostrar filtros"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className={cn("pt-3", contentClassName)}>
            {children}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
