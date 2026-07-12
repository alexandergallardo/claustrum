import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CatalogCampus, CatalogStudyPlan } from "@/lib/types";

import { MemoizedCurriculumBoard } from "@/components/curriculum/curriculum-board";
import { CurriculumFilters } from "@/components/curriculum/curriculum-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  useAuthUser,
  useUniversities,
  useCampuses,
  useAcademicUnits,
  useStudyPlans,
  useStudyPlanDetail,
  useUserStudyPlan,
} from "@/lib/hooks/use-queries";

import {
  CURRICULUM_DEFAULT_UNIVERSITY_ID,
  isMeaningfulCurriculumSearch,
  normalizeCurriculumUniversityId,
} from "./-curriculum-search";

const MAIN_CAMPUS_CODES = new Set(["AL", "CA", "LM", "SC", "SJ"]);

export function CurriculumPage() {
  const search = useSearch({ from: "/curriculum/" });
  const navigate = useNavigate({ from: "/curriculum/" });

  const selectedUniversityId = search.university ?? CURRICULUM_DEFAULT_UNIVERSITY_ID;
  const selectedCampusId = search.campus ?? null;
  const selectedAcademicUnitId = search.career ?? null;
  const selectedPlanId = search.plan ?? null;
  const hasMeaningfulSearch = isMeaningfulCurriculumSearch(search);
  const [isUsingProfileDefaults, setIsUsingProfileDefaults] = useState(() => !hasMeaningfulSearch);
  const shouldAutoSelectPlanRef = useRef(false);

  const { data: universities, isLoading: isLoadingUniversities } = useUniversities();
  const campusesQuery = useCampuses(selectedUniversityId);
  const academicUnitsQuery = useAcademicUnits(selectedCampusId);
  const plansQuery = useStudyPlans(selectedAcademicUnitId);

  const selectedPlanData = plansQuery.data?.find((p: CatalogStudyPlan) => p.id === selectedPlanId);

  const planDetailQuery = useStudyPlanDetail(selectedPlanId, selectedPlanData);
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const { data: userStudyPlan, isLoading: isUserStudyPlanLoading } = useUserStudyPlan(
    authUser?.id ?? null,
  );
  const isProfileLoading = isUsingProfileDefaults && (isAuthLoading || isUserStudyPlanLoading);
  const isAutoSelectingPlan =
    shouldAutoSelectPlanRef.current &&
    !!selectedAcademicUnitId &&
    !selectedPlanId &&
    (plansQuery.isFetching || (plansQuery.data?.length ?? 0) > 0);
  const isPendingFilters = isProfileLoading || isAutoSelectingPlan;
  const userStudyPlanUniversityId =
    normalizeCurriculumUniversityId(userStudyPlan?.universityId) ??
    CURRICULUM_DEFAULT_UNIVERSITY_ID;

  const campuses = campusesQuery.data ?? [];
  const academicUnits = academicUnitsQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  const mainCampuses = campuses.filter(
    (c: CatalogCampus) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId,
  );
  const isAutoSelectingLatestPlan =
    shouldAutoSelectPlanRef.current &&
    !!selectedAcademicUnitId &&
    !selectedPlanId &&
    plans.length > 0;
  const isLoadingPlansForFilters =
    (plansQuery.isFetching && plansQuery.data?.length === 0) || isAutoSelectingLatestPlan;

  useEffect(() => {
    if (!userStudyPlan) return;

    const hasAnySearch =
      hasMeaningfulSearch || !!selectedCampusId || !!selectedAcademicUnitId || !!selectedPlanId;
    const isEmptySearch = !hasMeaningfulSearch;

    // Case 1: no params at all → load full profile
    if (isEmptySearch) {
      setIsUsingProfileDefaults(true);
      void navigate({
        to: "/curriculum",
        search: {
          university: normalizeCurriculumUniversityId(userStudyPlan.universityId),
          u: normalizeCurriculumUniversityId(userStudyPlan.universityId),
          campus: userStudyPlan.campusId ?? undefined,
          c: userStudyPlan.campusId ?? undefined,
          career: userStudyPlan.academicUnitId ?? undefined,
          r: userStudyPlan.academicUnitId ?? undefined,
          plan: userStudyPlan.studyPlanId ?? undefined,
          p: userStudyPlan.studyPlanId ?? undefined,
        } as never,
      });
      return;
    }

    // Case 2: some params exist, university matches profile, but missing campus/career/plan
    // → fill in the missing ones from profile
    if (
      hasAnySearch &&
      isUsingProfileDefaults &&
      selectedUniversityId === userStudyPlanUniversityId
    ) {
      const missingCampus = !selectedCampusId && userStudyPlan.campusId;
      const missingCareer = !selectedAcademicUnitId && userStudyPlan.academicUnitId;
      const missingPlan = !selectedPlanId && userStudyPlan.studyPlanId;

      if (missingCampus || missingCareer || missingPlan) {
        setIsUsingProfileDefaults(true);
        void navigate({
          to: "/curriculum",
          search: {
            ...search,
            campus: selectedCampusId ?? userStudyPlan.campusId ?? undefined,
            c: selectedCampusId ?? userStudyPlan.campusId ?? undefined,
            career: selectedAcademicUnitId ?? userStudyPlan.academicUnitId ?? undefined,
            r: selectedAcademicUnitId ?? userStudyPlan.academicUnitId ?? undefined,
            plan: selectedPlanId ?? userStudyPlan.studyPlanId ?? undefined,
            p: selectedPlanId ?? userStudyPlan.studyPlanId ?? undefined,
          } as never,
        });
      }
    }
  }, [
    userStudyPlan,
    isUsingProfileDefaults,
    selectedUniversityId,
    selectedCampusId,
    selectedAcademicUnitId,
    selectedPlanId,
    navigate,
    search,
    hasMeaningfulSearch,
    userStudyPlanUniversityId,
  ]);

  useEffect(() => {
    if (!authUser) {
      setIsUsingProfileDefaults(false);
      return;
    }
    if (!userStudyPlan) return;
    const hasSearch = hasMeaningfulSearch;
    if (!hasSearch) {
      setIsUsingProfileDefaults(true);
      return;
    }

    const matchesProfile =
      selectedUniversityId === userStudyPlanUniversityId &&
      search.campus === userStudyPlan.campusId &&
      search.career === userStudyPlan.academicUnitId &&
      search.plan === userStudyPlan.studyPlanId;

    setIsUsingProfileDefaults(matchesProfile);
  }, [
    authUser,
    search,
    userStudyPlan,
    selectedUniversityId,
    userStudyPlanUniversityId,
    hasMeaningfulSearch,
  ]);

  const handleUniversityChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = false;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        university: normalizeCurriculumUniversityId(id),
        u: normalizeCurriculumUniversityId(id),
      };
      void navigate({
        to: "/curriculum",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handleCampusChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = false;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        c: id ?? undefined,
        campus: id ?? undefined,
      };
      void navigate({
        to: "/curriculum",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handleAcademicUnitChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = id !== null;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        r: id ?? undefined,
        career: id ?? undefined,
        p: undefined,
        plan: undefined,
      };
      void navigate({
        to: "/curriculum",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handlePlanChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = false;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        p: id ?? undefined,
        plan: id ?? undefined,
      };
      void navigate({
        to: "/curriculum",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handleUseProfileDefaults = useCallback(() => {
    if (!userStudyPlan) return;
    shouldAutoSelectPlanRef.current = false;
    setIsUsingProfileDefaults(true);

    const newSearch: Record<string, unknown> = {
      ...search,
      university: normalizeCurriculumUniversityId(userStudyPlan.universityId),
      u: normalizeCurriculumUniversityId(userStudyPlan.universityId),
      campus: userStudyPlan.campusId ?? undefined,
      c: userStudyPlan.campusId ?? undefined,
      career: userStudyPlan.academicUnitId ?? undefined,
      r: userStudyPlan.academicUnitId ?? undefined,
      plan: userStudyPlan.studyPlanId ?? undefined,
      p: userStudyPlan.studyPlanId ?? undefined,
    };

    void navigate({
      to: "/curriculum",
      search: newSearch as never,
    });
  }, [navigate, search, userStudyPlan]);

  useEffect(() => {
    if (!selectedCampusId) return;
    if (campusesQuery.isFetching) return;
    if (mainCampuses.some((c) => c.id === selectedCampusId)) return;

    shouldAutoSelectPlanRef.current = false;
    const validateCampusSearch: Record<string, unknown> = {
      ...search,
      c: undefined,
      campus: undefined,
      r: undefined,
      career: undefined,
      p: undefined,
      plan: undefined,
    };
    void navigate({
      to: "/curriculum",
      search: validateCampusSearch as never,
    });
  }, [selectedCampusId, mainCampuses, campusesQuery.isFetching, navigate, search]);

  useEffect(() => {
    if (!selectedAcademicUnitId) return;
    if (academicUnitsQuery.isFetching) return;
    if (academicUnits.some((c) => c.id === selectedAcademicUnitId)) return;

    shouldAutoSelectPlanRef.current = false;
    const validateCareerSearch: Record<string, unknown> = {
      ...search,
      r: undefined,
      career: undefined,
      p: undefined,
      plan: undefined,
    };
    void navigate({
      to: "/curriculum",
      search: validateCareerSearch as never,
    });
  }, [selectedAcademicUnitId, academicUnits, academicUnitsQuery.isFetching, navigate, search]);

  useEffect(() => {
    if (!selectedPlanId) return;
    if (plansQuery.isFetching) return;
    if (plans.some((p) => p.id === selectedPlanId)) return;

    shouldAutoSelectPlanRef.current = true;
    const validatePlanSearch: Record<string, unknown> = {
      ...search,
      p: undefined,
      plan: undefined,
    };
    void navigate({
      to: "/curriculum",
      search: validatePlanSearch as never,
    });
  }, [selectedPlanId, plans, plansQuery.isFetching, navigate, search]);

  useEffect(() => {
    if (!shouldAutoSelectPlanRef.current) return;
    if (!selectedAcademicUnitId) return;
    if (selectedPlanId) {
      shouldAutoSelectPlanRef.current = false;
      return;
    }
    if (plansQuery.isFetching) return;
    if (!plans.length) {
      shouldAutoSelectPlanRef.current = false;
      return;
    }

    shouldAutoSelectPlanRef.current = false;
    const autoPlanSearch: Record<string, unknown> = {
      ...search,
      p: plans[0].id,
      plan: plans[0].id,
    };
    void navigate({
      to: "/curriculum",
      search: autoPlanSearch as never,
    });
  }, [navigate, plans, plansQuery.isFetching, search, selectedAcademicUnitId, selectedPlanId]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          <header className="sr-only">
            <h1>Plan de estudios TEC</h1>
            <p>
              Consulta planes de estudio del TEC por sede, carrera y plan. Revisa cursos,
              requisitos, correquisitos, equivalencias y avance academico para entender mejor tu
              malla curricular.
            </p>
          </header>

          <div className="px-4 lg:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <CurriculumFilters
                  universities={universities ?? []}
                  campuses={mainCampuses}
                  careerPrograms={academicUnits}
                  plans={plans}
                  selectedUniversityId={selectedUniversityId}
                  selectedCampusId={selectedCampusId}
                  selectedCareerProgramId={selectedAcademicUnitId}
                  selectedPlanId={selectedPlanId}
                  onUniversityChange={handleUniversityChange}
                  onCampusChange={handleCampusChange}
                  onCareerProgramChange={handleAcademicUnitChange}
                  onPlanChange={handlePlanChange}
                  isLoadingUniversities={isLoadingUniversities}
                  isLoadingCampuses={campusesQuery.isFetching && campusesQuery.data?.length === 0}
                  isLoadingCareerPrograms={
                    academicUnitsQuery.isFetching && academicUnitsQuery.data?.length === 0
                  }
                  isLoadingPlans={isLoadingPlansForFilters}
                />
              </div>
              {!!authUser && !!userStudyPlan && (
                <Button
                  type="button"
                  variant={isUsingProfileDefaults ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleUseProfileDefaults}
                  disabled={isUsingProfileDefaults}
                  className="h-8 shrink-0 gap-1.5 text-xs"
                >
                  <User className="size-3.5" />
                  {isUsingProfileDefaults ? "Perfil activo" : "Usar mi perfil"}
                </Button>
              )}
            </div>
          </div>

          {planDetailQuery.isError && (
            <div className="px-4 lg:px-6">
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Error al cargar el plan de estudios. Intenta de nuevo.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {selectedPlanId && planDetailQuery.isLoading && (
            <div className="flex flex-1 px-4 lg:px-6">
              <Card className="flex min-h-[45svh] w-full items-center justify-center p-6 md:min-h-96">
                <Spinner className="text-muted-foreground size-6" />
              </Card>
            </div>
          )}

          {selectedPlanId && planDetailQuery.isSuccess && planDetailQuery.data && (
            <div className="min-h-0 flex-1 px-4 lg:px-6">
              <Card className="h-full min-h-0 overflow-auto py-0">
                <MemoizedCurriculumBoard planDetail={planDetailQuery.data} />
              </Card>
            </div>
          )}

          {isPendingFilters && (
            <div className="flex flex-1 px-4 lg:px-6">
              <Card className="flex min-h-[45svh] w-full items-center justify-center p-6 md:min-h-96">
                <Spinner className="text-muted-foreground size-6" />
              </Card>
            </div>
          )}

          {!selectedPlanId && !planDetailQuery.isLoading && !isPendingFilters && (
            <div className="flex flex-1 px-4 lg:px-6">
              <Card className="flex min-h-[45svh] w-full items-center justify-center p-6 text-center md:min-h-96">
                <p className="text-muted-foreground max-w-sm text-sm md:text-base">
                  Selecciona una carrera para visualizar el plan de estudios del TEC.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
