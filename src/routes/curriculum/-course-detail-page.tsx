import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useCallback } from "react";

import type { CatalogStudyPlan, CourseStatus } from "@/lib/types";

import { CourseDetails } from "@/components/course-details";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useAuthUser,
  useCreateCourseAttempt,
  useStudyPlanDetail,
  useStudyPlans,
  useStudentCourseStatuses,
} from "@/lib/hooks/use-queries";
import { useCurriculumViewModel } from "@/lib/hooks/useCurriculumViewModel";
import { saveLocalCourseStatus } from "@/lib/utils/local-storage-utils";

export function CourseDetailPage() {
  const params = useParams({ from: "/curriculum/$courseId" });
  const search = useSearch({ from: "/curriculum/$courseId" });
  const navigate = useNavigate({ from: "/curriculum/$courseId" });
  const queryClient = useQueryClient();

  const selectedAcademicUnitId = search.career ?? null;
  const selectedPlanId = search.plan ?? null;

  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const plansQuery = useStudyPlans(selectedAcademicUnitId);
  const selectedPlanData = plansQuery.data?.find(
    (plan: CatalogStudyPlan) => plan.id === selectedPlanId,
  );
  const planDetailQuery = useStudyPlanDetail(selectedPlanId, selectedPlanData);
  const { data: statusMap } = useStudentCourseStatuses(authUser?.id ?? null, selectedPlanId);
  const createCourseAttempt = useCreateCourseAttempt();

  const { courseById } = useCurriculumViewModel(planDetailQuery.data ?? null, statusMap);
  const selectedCourse = courseById.get(params.courseId);

  const handleBack = useCallback(() => {
    void navigate({
      to: "/curriculum",
      search,
      viewTransition: {
        types: ["course-close"],
      },
    });
  }, [navigate, search]);

  const handleCreateAttempt = useCallback(
    async (
      courseId: string,
      attempt: {
        status: Exclude<CourseStatus, "not_taken">;
        grade: number | null;
        academicTermId: number;
      },
    ) => {
      if (!authUser?.id || !selectedPlanId) {
        saveLocalCourseStatus(parseInt(courseId), selectedPlanId ?? null, attempt.status);
        void queryClient.invalidateQueries({ queryKey: ["studentCourseStatuses"] });
        void queryClient.invalidateQueries({ queryKey: ["scheduleCourses"] });
        return "local" as const;
      }

      await createCourseAttempt.mutateAsync({
        userId: authUser.id,
        studyPlanId: selectedPlanId,
        courseId: parseInt(courseId),
        status: attempt.status,
        grade: attempt.grade,
        academicTermId: attempt.academicTermId,
      });

      return "success" as const;
    },
    [authUser?.id, createCourseAttempt, queryClient, selectedPlanId],
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <Button variant="ghost" onClick={handleBack} className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al plan
            </Button>
          </div>

          {planDetailQuery.isError ? (
            <div className="px-4 lg:px-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Error al cargar el plan de estudios. Intenta de nuevo.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {!selectedPlanId && !planDetailQuery.isLoading ? (
            <div className="px-4 lg:px-6">
              <Card className="flex min-h-72 items-center justify-center p-6">
                <p className="text-muted-foreground">
                  No hay plan seleccionado. Vuelve y selecciona uno para abrir cursos.
                </p>
              </Card>
            </div>
          ) : null}

          {planDetailQuery.isLoading || isAuthLoading ? (
            <div className="px-4 lg:px-6">
              <Card className="min-h-72 animate-pulse" />
            </div>
          ) : null}

          {selectedPlanId && !planDetailQuery.isLoading && !selectedCourse ? (
            <div className="px-4 lg:px-6">
              <Card className="flex min-h-72 items-center justify-center p-6">
                <p className="text-muted-foreground">
                  No encontramos este curso en el plan seleccionado.
                </p>
              </Card>
            </div>
          ) : null}

          {selectedPlanId && selectedCourse ? (
            <div className="px-4 pb-4 lg:px-6">
              <CourseDetails
                course={selectedCourse}
                courseById={courseById}
                userId={authUser?.id}
                studyPlanId={selectedPlanId}
                campusId={search.campus ?? undefined}
                modalityName={planDetailQuery.data?.plan?.modality_name}
                transitionName={`course-name-${selectedCourse.id}`}
                onCreateAttempt={handleCreateAttempt}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
