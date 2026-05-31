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

const normalizeText = (text: string) =>
  text
    .toUpperCase()
    .replace(/\s*\.\.\.$/, "")
    .trim();
const removePlanPrefixFromName = (name: string, externalPlanId: number | string) => {
  const normalizedName = normalizeText(name).trim();
  const normalizedPlanId = String(externalPlanId).trim();
  const prefixPattern = new RegExp(`^${normalizedPlanId}\\s*-\\s*`);
  return normalizedName.replace(prefixPattern, "");
};
type FilterItem = {
  id: number;
  name: string;
  code?: string;
  external_plan_id?: number | string;
};

function FilterSelect({
  value,
  placeholder,
  items,
  onChange,
  isVisible,
  showCode = false,
}: {
  value: string;
  placeholder: string;
  items: FilterItem[];
  onChange: (val: string) => void;
  isVisible: boolean;
  showCode?: boolean;
}) {
  if (!isVisible) return null;

  return (
    <div className="animate-in fade-in-0 slide-in-from-left-2 min-w-0 duration-300">
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
    </div>
  );
}

function FilterCombobox({
  value,
  placeholder,
  items,
  onChange,
  isVisible,
  showCode = false,
  itemLabel,
}: {
  value: string;
  placeholder: string;
  items: FilterItem[];
  onChange: (val: string) => void;
  isVisible: boolean;
  showCode?: boolean;
  itemLabel?: (item: FilterItem) => string;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  if (!isVisible) return null;
  const selectedItem = items.find((item) => item.id.toString() === value) ?? null;
  const getItemLabel = (item: FilterItem) => {
    if (itemLabel) return itemLabel(item);
    if (showCode && item.code) return `${normalizeText(item.code)} - ${normalizeText(item.name)}`;
    return normalizeText(item.name);
  };
  const selectedText = selectedItem ? getItemLabel(selectedItem) : null;

  return (
    <div className="animate-in fade-in-0 slide-in-from-left-2 min-w-0 duration-300">
      <Combobox
        items={items}
        value={selectedItem}
        onValueChange={(item) => onChange(item ? String(item.id) : "")}
        itemToStringValue={(item) => getItemLabel(item)}
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
          <ComboboxList className="max-h-56 scrollbar-none">
            {(item) => (
              <ComboboxItem key={item.id} value={item}>
                <span className="block w-full min-w-0 truncate">{getItemLabel(item)}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

const CURRICULUM_FILTERS_PANEL_STORAGE_KEY = "curriculum-filters-panel-open";
const LEGACY_FILTERS_PANEL_STORAGE_KEY = "plan-filters-panel-open";
const FILTER_REVEAL_ANIMATION_MS = 220;

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
  const [revealedFiltersCount, setRevealedFiltersCount] = useState(0);
  const [hasCompletedInitialReveal, setHasCompletedInitialReveal] = useState(false);
  const hasUniversities = universities.length > 0;
  const shouldShowUniversityFilter = universities.length > 1;
  const canSelectCampus = shouldShowUniversityFilter ? !!selectedUniversityId : hasUniversities;
  const hasSelectedCampus =
    !selectedCampusId || campuses.some((campus) => campus.id === selectedCampusId);
  const hasSelectedCareer =
    !selectedCareerProgramId ||
    careerPrograms.some((careerProgram) => careerProgram.id === selectedCareerProgramId);

  const isUniversityFilterReady = shouldShowUniversityFilter && !isLoadingUniversities;
  const isCampusFilterReady = canSelectCampus && !isLoadingCampuses && hasSelectedCampus;
  const isCareerFilterReady = !!selectedCampusId && !isLoadingCareerPrograms && hasSelectedCareer;
  const isPlanFilterReady = !!selectedCareerProgramId && !isLoadingPlans;

  const readyFilterKeys = [
    isUniversityFilterReady ? "university" : null,
    isCampusFilterReady ? "campus" : null,
    isCareerFilterReady ? "career" : null,
    isPlanFilterReady ? "plan" : null,
  ].filter((key): key is string => key !== null);
  const readyFilterSignature = readyFilterKeys.join("|");

  const universityAnimationOrder = readyFilterKeys.indexOf("university");
  const campusAnimationOrder = readyFilterKeys.indexOf("campus");
  const careerAnimationOrder = readyFilterKeys.indexOf("career");
  const planAnimationOrder = readyFilterKeys.indexOf("plan");

  const showUniversityFilter = hasCompletedInitialReveal
    ? isUniversityFilterReady
    : universityAnimationOrder >= 0 && revealedFiltersCount > universityAnimationOrder;
  const showCampusFilter = hasCompletedInitialReveal
    ? isCampusFilterReady
    : campusAnimationOrder >= 0 && revealedFiltersCount > campusAnimationOrder;
  const showCareerFilter = hasCompletedInitialReveal
    ? isCareerFilterReady
    : careerAnimationOrder >= 0 && revealedFiltersCount > careerAnimationOrder;
  const showPlanFilter = hasCompletedInitialReveal
    ? isPlanFilterReady
    : planAnimationOrder >= 0 && revealedFiltersCount > planAnimationOrder;

  useEffect(() => {
    localStorage.setItem(CURRICULUM_FILTERS_PANEL_STORAGE_KEY, isFiltersVisible.toString());
  }, [isFiltersVisible]);

  useEffect(() => {
    if (hasCompletedInitialReveal) return;

    setRevealedFiltersCount(0);

    if (readyFilterKeys.length === 0) return;

    const timers = readyFilterKeys.map((_, index) =>
      window.setTimeout(() => {
        setRevealedFiltersCount(index + 1);
        if (index === readyFilterKeys.length - 1) {
          setHasCompletedInitialReveal(true);
        }
      }, index * FILTER_REVEAL_ANIMATION_MS),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [hasCompletedInitialReveal, readyFilterSignature]);

  return (
    <FiltersPanel isExpanded={isFiltersVisible} onExpandedChange={setIsFiltersVisible}>
      <FilterSelect
        value={selectedUniversityId?.toString() || ""}
        placeholder="Universidad"
        items={universities}
        onChange={(val) => onUniversityChange(val ? parseInt(val) : null)}
        isVisible={showUniversityFilter}
      />

      <FilterCombobox
        value={selectedCampusId?.toString() || ""}
        placeholder="Sede"
        items={campuses}
        onChange={(val) => onCampusChange(val ? parseInt(val) : null)}
        isVisible={showCampusFilter}
      />

      <FilterCombobox
        value={selectedCareerProgramId?.toString() || ""}
        placeholder="Carrera"
        items={careerPrograms}
        onChange={(val) => onCareerProgramChange(val ? parseInt(val) : null)}
        isVisible={showCareerFilter}
        itemLabel={(item) =>
          item.code
            ? `${normalizeText(item.code)}: ${normalizeText(item.name)}`
            : normalizeText(item.name)
        }
      />

      <FilterCombobox
        value={selectedPlanId?.toString() || ""}
        placeholder="Plan de estudios"
        items={plans}
        onChange={(val) => onPlanChange(val ? parseInt(val) : null)}
        isVisible={showPlanFilter}
        itemLabel={(item) =>
          item.external_plan_id !== undefined
            ? `${item.external_plan_id}: ${removePlanPrefixFromName(item.name, item.external_plan_id)}`
            : normalizeText(item.name)
        }
      />
    </FiltersPanel>
  );
}
