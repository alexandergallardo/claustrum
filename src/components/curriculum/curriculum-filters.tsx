import { useState, useEffect, useRef } from "react";

import type {
  CatalogUniversity,
  CatalogCampus,
  CatalogCareerProgram,
  CatalogStudyPlan,
} from "@/lib/types";

import { FiltersPanel } from "@/components/filters/filters-panel";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CurriculumFiltersProps {
  universities: CatalogUniversity[];
  campuses: CatalogCampus[];
  careerPrograms: CatalogCareerProgram[];
  plans: CatalogStudyPlan[];
  selectedUniversityId: number | null;
  selectedCampusId: number | null;
  selectedCareerProgramId: number | null;
  selectedPlanId: number | null;
  onUniversityChange: (id: number | null) => void;
  onCampusChange: (id: number | null) => void;
  onCareerProgramChange: (id: number | null) => void;
  onPlanChange: (id: number | null) => void;
  isLoadingUniversities: boolean;
  isLoadingCampuses?: boolean;
  isLoadingCareerPrograms: boolean;
  isLoadingPlans: boolean;
  canUseProfileDefaults?: boolean;
  isUsingProfileDefaults?: boolean;
  onUseProfileDefaults?: () => void;
}

const truncateText = (text: string, maxLength = 35) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

const normalizeText = (text: string) => text.toUpperCase();

function FilterSkeleton() {
  return <Skeleton className="h-8 w-full sm:w-[160px]" />;
}

function FilterSelect({
  value,
  placeholder,
  items,
  onChange,
  isLoading,
  isVisible,
  showCode = false,
}: {
  value: string;
  placeholder: string;
  items: { id: number; code?: string; name: string }[];
  onChange: (val: string) => void;
  isLoading: boolean;
  isVisible: boolean;
  showCode?: boolean;
}) {
  if (!isVisible) return null;

  const hasData = items.length > 0;
  const showSkeleton = isLoading && !hasData;

  return (
    <div
      className={`min-w-0 ${showSkeleton ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-200" : ""}`}
    >
      {showSkeleton ? (
        <FilterSkeleton />
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            size="sm"
            className="w-full min-w-0 text-xs sm:max-w-[280px] sm:min-w-[160px]"
          >
            <SelectValue
              placeholder={placeholder}
              className="block max-w-full min-w-0 truncate text-left"
            />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
            <SelectGroup>
              <TooltipProvider>
                {items.map((item) => {
                  const fullText =
                    showCode && item.code
                      ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
                      : normalizeText(item.name);
                  const displayText = truncateText(fullText);
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <SelectItem value={item.id.toString()}>{displayText}</SelectItem>
                      </TooltipTrigger>
                      {displayText !== fullText && (
                        <TooltipContent side="right">
                          <p>{fullText}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function FilterCombobox({
  value,
  placeholder,
  items,
  onChange,
  isLoading,
  isVisible,
  showCode = false,
}: {
  value: string;
  placeholder: string;
  items: { id: number; code?: string; name: string }[];
  onChange: (val: string) => void;
  isLoading: boolean;
  isVisible: boolean;
  showCode?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  if (!isVisible) return null;

  const hasData = items.length > 0;
  const showSkeleton = isLoading && !hasData;
  const selectedItem = items.find((item) => item.id.toString() === value) ?? null;
  const selectedText = selectedItem
    ? showCode && selectedItem.code
      ? `${normalizeText(selectedItem.code)} - ${normalizeText(selectedItem.name)}`
      : normalizeText(selectedItem.name)
    : null;

  return (
    <div
      className={`min-w-0 ${showSkeleton ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-200" : ""}`}
    >
      {showSkeleton ? (
        <FilterSkeleton />
      ) : (
        <Combobox
          items={items}
          value={selectedItem}
          onValueChange={(item) => onChange(item ? String(item.id) : "")}
          itemToStringValue={(item) =>
            showCode && item.code
              ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
              : normalizeText(item.name)
          }
        >
          <ComboboxTrigger
            ref={triggerRef}
            render={
              <Button
                variant="outline"
                className="h-8 w-full min-w-0 justify-between text-xs font-normal sm:max-w-[360px] sm:min-w-[240px]"
              />
            }
          >
            <span
              className={`block min-w-0 flex-1 truncate text-left ${!selectedText ? "text-muted-foreground" : ""}`}
            >
              {selectedText ?? placeholder}
            </span>
          </ComboboxTrigger>
          <ComboboxContent
            anchor={triggerRef}
            className="w-[var(--anchor-width)] max-w-[calc(var(--available-width)-1rem)] min-w-[var(--anchor-width)]"
          >
            <ComboboxInput showTrigger={false} placeholder="Buscar" />
            <ComboboxEmpty>No se encontraron resultados.</ComboboxEmpty>
            <ComboboxList className="max-h-56 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(item) => (
                <ComboboxItem key={item.id} value={item}>
                  <span className="block w-full min-w-0 truncate">
                    {showCode && item.code
                      ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
                      : normalizeText(item.name)}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </div>
  );
}

const CURRICULUM_FILTERS_PANEL_STORAGE_KEY = "curriculum-filters-panel-open";
const LEGACY_FILTERS_PANEL_STORAGE_KEY = "plan-filters-panel-open";

function getInitialFiltersPanelOpen(): boolean {
  if (typeof window === "undefined") return true;
  const stored =
    localStorage.getItem(CURRICULUM_FILTERS_PANEL_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_FILTERS_PANEL_STORAGE_KEY);
  return stored !== "false";
}

export function CurriculumFilters({
  universities,
  campuses,
  careerPrograms,
  plans,
  selectedUniversityId,
  selectedCampusId,
  selectedCareerProgramId,
  selectedPlanId,
  onUniversityChange,
  onCampusChange,
  onCareerProgramChange,
  onPlanChange,
  isLoadingUniversities,
  isLoadingCampuses = false,
  isLoadingCareerPrograms,
  isLoadingPlans,
}: CurriculumFiltersProps) {
  const [isFiltersVisible, setIsFiltersVisible] = useState(getInitialFiltersPanelOpen);
  const hasUniversities = universities.length > 0;
  const shouldShowUniversityFilter = universities.length > 1;
  const canSelectCampus = shouldShowUniversityFilter ? !!selectedUniversityId : hasUniversities;

  useEffect(() => {
    localStorage.setItem(CURRICULUM_FILTERS_PANEL_STORAGE_KEY, isFiltersVisible.toString());
  }, [isFiltersVisible]);

  if (!hasUniversities && isLoadingUniversities) {
    return (
      <div className="bg-muted/30 flex flex-wrap items-center gap-2.5 rounded-lg px-3 py-2">
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
      </div>
    );
  }

  return (
    <FiltersPanel isExpanded={isFiltersVisible} onExpandedChange={setIsFiltersVisible}>
      <FilterSelect
        value={selectedUniversityId?.toString() || ""}
        placeholder="Universidad"
        items={universities}
        onChange={(val) => onUniversityChange(val ? parseInt(val) : null)}
        isLoading={!hasUniversities && isLoadingUniversities}
        isVisible={shouldShowUniversityFilter}
      />

      <FilterCombobox
        value={selectedCampusId?.toString() || ""}
        placeholder="Sede"
        items={campuses}
        onChange={(val) => onCampusChange(val ? parseInt(val) : null)}
        isLoading={!campuses.length && isLoadingCampuses}
        isVisible={canSelectCampus}
      />

      <FilterCombobox
        value={selectedCareerProgramId?.toString() || ""}
        placeholder="Carrera"
        items={careerPrograms}
        onChange={(val) => onCareerProgramChange(val ? parseInt(val) : null)}
        isLoading={!careerPrograms.length && isLoadingCareerPrograms}
        isVisible={!!selectedCampusId}
        showCode={true}
      />

      <FilterCombobox
        value={selectedPlanId?.toString() || ""}
        placeholder="Plan de estudios"
        items={plans}
        onChange={(val) => onPlanChange(val ? parseInt(val) : null)}
        isLoading={!plans.length && isLoadingPlans}
        isVisible={!!selectedCareerProgramId}
      />
    </FiltersPanel>
  );
}
