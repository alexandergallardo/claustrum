import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { CatalogCampus, CatalogStudyPlan } from "@/lib/types";

import { MemoizedCurriculumBoard } from "@/components/curriculum/curriculum-board";
import { CurriculumFilters } from "@/components/curriculum/curriculum-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAuthUser,
  useUniversities,
  useCampuses,
  useAcademicUnits,
  useStudyPlans,
  useStudyPlanDetail,
  useUserStudyPlan,
} from "@/lib/hooks/use-queries";

const MAIN_CAMPUS_CODES = new Set(["AL", "CA", "LM", "SC", "SJ"]);

export function CurriculumPage() {
  const search = useSearch({ from: "/curriculum/" });
  const navigate = useNavigate({ from: "/curriculum/" });

  const selectedUniversityId = search.university ?? null;
  const selectedCampusId = search.campus ?? null;
  const selectedAcademicUnitId = search.career ?? null;
  const selectedPlanId = search.plan ?? null;
  const [isUsingProfileDefaults, setIsUsingProfileDefaults] = useState(
    () => !search.university && !search.campus && !search.career && !search.plan,
  );

  const { data: universities, isLoading: isLoadingUniversities } = useUniversities();
  const campusesQuery = useCampuses(selectedUniversityId);
  const academicUnitsQuery = useAcademicUnits(selectedCampusId);
  const plansQuery = useStudyPlans(selectedAcademicUnitId);

  const selectedPlanData = plansQuery.data?.find((p: CatalogStudyPlan) => p.id === selectedPlanId);

  const planDetailQuery = useStudyPlanDetail(selectedPlanId, selectedPlanData);
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const { data: userStudyPlan } = useUserStudyPlan(
    authUser?.id ?? null,
    !!authUser?.id && !isAuthLoading,
  );

  const campuses = campusesQuery.data ?? [];
  const academicUnits = academicUnitsQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  const mainCampuses = campuses.filter(
    (c: CatalogCampus) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId,
  );

  useEffect(() => {
    if (!isLoadingUniversities && universities?.length === 1 && !selectedUniversityId) {
      void navigate({
        search: {
          ...search,
          university: universities[0].id,
        },
      });
    }
  }, [isLoadingUniversities, universities, selectedUniversityId, navigate, search]);

  useEffect(() => {
    if (!userStudyPlan) return;

    const hasAnySearch =
      !!selectedUniversityId || !!selectedCampusId || !!selectedAcademicUnitId || !!selectedPlanId;
    const isEmptySearch =
      !selectedUniversityId && !selectedCampusId && !selectedAcademicUnitId && !selectedPlanId;

    // Case 1: no params at all → load full profile
    if (isEmptySearch) {
      setIsUsingProfileDefaults(true);
      void navigate({
        to: "/curriculum",
        search: {
          university: userStudyPlan.universityId ?? undefined,
          campus: userStudyPlan.campusId ?? undefined,
          career: userStudyPlan.academicUnitId ?? undefined,
          plan: userStudyPlan.studyPlanId ?? undefined,
        },
      });
      return;
    }

    // Case 2: some params exist, university matches profile, but missing campus/career/plan
    // → fill in the missing ones from profile
    if (hasAnySearch && selectedUniversityId === userStudyPlan.universityId) {
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
            career: selectedAcademicUnitId ?? userStudyPlan.academicUnitId ?? undefined,
            plan: selectedPlanId ?? userStudyPlan.studyPlanId ?? undefined,
          },
        });
      }
    }
  }, [
    userStudyPlan,
    selectedUniversityId,
    selectedCampusId,
    selectedAcademicUnitId,
    selectedPlanId,
    navigate,
    search,
  ]);

  useEffect(() => {
    if (!authUser) {
      setIsUsingProfileDefaults(false);
      return;
    }
    if (!userStudyPlan) return;
    const hasSearch = !!search.university || !!search.campus || !!search.career || !!search.plan;
    if (!hasSearch) {
      setIsUsingProfileDefaults(true);
      return;
    }

    const matchesProfile =
      search.university === userStudyPlan.universityId &&
      search.campus === userStudyPlan.campusId &&
      search.career === userStudyPlan.academicUnitId &&
      search.plan === userStudyPlan.studyPlanId;

    setIsUsingProfileDefaults(matchesProfile);
  }, [authUser, search, userStudyPlan]);

  const handleUniversityChange = useCallback(
    (id: number | null) => {
      setIsUsingProfileDefaults(false);
      void navigate({
        search: {
          university: id ?? undefined,
          campus: undefined,
          career: undefined,
          plan: undefined,
        },
      });
    },
    [navigate],
  );

  const handleCampusChange = useCallback(
    (id: number | null) => {
      setIsUsingProfileDefaults(false);
      void navigate({
        search: {
          ...search,
          campus: id ?? undefined,
          career: undefined,
          plan: undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleAcademicUnitChange = useCallback(
    (id: number | null) => {
      setIsUsingProfileDefaults(false);
      void navigate({
        search: {
          ...search,
          career: id ?? undefined,
          plan: undefined,
        },
      });
    },
    [navigate, search],
  );

  const handlePlanChange = useCallback(
    (id: number | null) => {
      setIsUsingProfileDefaults(false);
      void navigate({
        search: {
          ...search,
          plan: id ?? undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleUseProfileDefaults = useCallback(() => {
    if (!userStudyPlan) return;
    setIsUsingProfileDefaults(true);
    void navigate({
      to: "/curriculum",
      search: {
        ...search,
        university: userStudyPlan.universityId ?? undefined,
        campus: userStudyPlan.campusId ?? undefined,
        career: userStudyPlan.academicUnitId ?? undefined,
        plan: userStudyPlan.studyPlanId ?? undefined,
      },
    });
  }, [navigate, search, userStudyPlan]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
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
                  isLoadingPlans={plansQuery.isFetching && plansQuery.data?.length === 0}
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
            <div className="space-y-4 px-4 lg:px-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-48" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </div>
          )}

          {selectedPlanId && planDetailQuery.isSuccess && planDetailQuery.data && (
            <div className="min-h-0 flex-1 px-4 lg:px-6">
              <Card className="h-full min-h-0 overflow-auto py-0">
                <MemoizedCurriculumBoard planDetail={planDetailQuery.data} />
              </Card>
            </div>
          )}

          {!selectedPlanId && !planDetailQuery.isLoading && (
            <div className="flex flex-1 px-4 lg:px-6">
              <Card className="flex min-h-[45svh] w-full items-center justify-center p-6 text-center md:min-h-96">
                <p className="text-muted-foreground max-w-sm text-sm md:text-base">
                  Selecciona una carrera para visualizar el plan de estudios
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
