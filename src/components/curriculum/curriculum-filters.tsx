import { useState, useEffect } from "react";

import type {
  CatalogUniversity,
  CatalogCampus,
  CatalogCareerProgram,
  CatalogStudyPlan,
} from "@/lib/types";

import { FiltersPanel } from "@/components/filters/filters-panel";
import {
  FilterCombobox,
  normalizeText,
  removePlanPrefixFromName,
} from "@/components/filters/shared-filters";

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
  const [hasCompletedInitialReveal, setHasCompletedInitialReveal] = useState(() => {
    return !!selectedCampusId || !!selectedCareerProgramId || !!selectedPlanId;
  });
  const hasUniversities = universities.length > 0;
  const shouldShowUniversityFilter = universities.length > 1;
  const canSelectCampus = shouldShowUniversityFilter ? !!selectedUniversityId : hasUniversities;

  const isUniversityFilterReady = shouldShowUniversityFilter && !isLoadingUniversities;
  const isCampusFilterReady = canSelectCampus && !isLoadingCampuses;
  const isCareerFilterReady = !!selectedCampusId && !isLoadingCareerPrograms;
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
      <FilterCombobox
        label="Universidad"
        value={selectedUniversityId?.toString() || ""}
        placeholder="Universidad"
        items={universities}
        onChange={(val) => onUniversityChange(val ? parseInt(val) : null)}
        isVisible={showUniversityFilter}
      />

      <FilterCombobox
        label="Sede"
        value={selectedCampusId?.toString() || ""}
        placeholder="Sede"
        items={campuses}
        onChange={(val) => onCampusChange(val ? parseInt(val) : null)}
        isVisible={showCampusFilter}
        itemLabel={(item) =>
          item.code
            ? `${normalizeText(item.code)}: ${normalizeText(item.name)}`
            : normalizeText(item.name)
        }
      />

      <FilterCombobox
        label="Carrera"
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
        label="Plan de estudios"
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
