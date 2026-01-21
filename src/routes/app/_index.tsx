import { createFileRoute } from "@tanstack/react-router";
import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { DashboardStatsCards, CourseStatusChart } from "@/components/dashboard/dashboard-stats";
import { ProgressTimeline } from "@/components/dashboard/progress-timeline";
import { NextCourses } from "@/components/dashboard/next-courses";
import { EmptyDashboard, DashboardSkeleton } from "@/components/dashboard/empty-state";
import { useUserStudyPlan } from "@/lib/hooks/use-queries";
import { useDashboardStats } from "@/lib/hooks/use-queries";

export const Route = createFileRoute("/app/_index")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: userStudyPlan, isLoading: isLoadingUserPlan } = useUserStudyPlan();
  const { data: dashboardData, isLoading: isLoadingStats } = useDashboardStats(
    userStudyPlan?.userId ?? null,
    userStudyPlan?.studyPlanId ?? null
  );

  const isAuthenticated = !!userStudyPlan?.userId;
  const isLoading = isLoadingUserPlan || isLoadingStats;

  return (
    <AppLayoutWrapper>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {isLoading ? (
              <DashboardSkeleton />
            ) : !isAuthenticated || !dashboardData?.stats ? (
              <EmptyDashboard isAuthenticated={isAuthenticated} />
            ) : (
              <>
                <div className="px-4 lg:px-6">
                  <h1 className="text-2xl font-bold">Tu Progreso Académico</h1>
                  <p className="text-muted-foreground">
                    {userStudyPlan?.studyPlanName || "Plan de estudios"}
                  </p>
                </div>

                <div className="px-4 lg:px-6">
                  <DashboardStatsCards stats={dashboardData.stats} />
                </div>

                <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-7">
                  <div className="col-span-4">
                    <CourseStatusChart stats={dashboardData.stats} />
                  </div>
                  <div className="col-span-3">
                    <NextCourses
                      courses={dashboardData.nextCourses}
                      studyPlanId={userStudyPlan?.studyPlanId ?? null}
                    />
                  </div>
                </div>

                <div className="px-4 lg:px-6">
                  <ProgressTimeline semesters={dashboardData.semesters} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayoutWrapper>
  );
}
