import { Suspense, lazy, useLayoutEffect, useRef, useState } from "react";

import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { EmptyDashboard, DashboardSkeleton } from "@/components/dashboard/empty-state";
import { NextCourses } from "@/components/dashboard/next-courses";
import { ProgressTimeline } from "@/components/dashboard/progress-timeline";
import { useAuthUser, useDashboardStats, useUserStudyPlan } from "@/lib/hooks/use-queries";

const DashboardStatsCards = lazy(() =>
  import("@/components/dashboard/dashboard-stats").then((module) => ({ default: module.DashboardStatsCards })),
);

const CourseStatusChart = lazy(() =>
  import("@/components/dashboard/dashboard-stats").then((module) => ({ default: module.CourseStatusChart })),
);

export function DashboardPage() {
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const { data: userStudyPlan, isLoading: isLoadingUserPlan } = useUserStudyPlan(
    authUser?.id ?? null,
    !!authUser?.id && !isAuthLoading,
  );
  const { data: dashboardData, isLoading: isLoadingStats } = useDashboardStats(
    userStudyPlan?.userId ?? null,
    userStudyPlan?.studyPlanId ?? null,
  );

  const distributionRef = useRef<HTMLDivElement>(null);
  const [distributionHeight, setDistributionHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (distributionRef.current) {
      setDistributionHeight(distributionRef.current.offsetHeight);
    }
  }, [dashboardData]);

  const isAuthenticated = !!authUser;
  const hasProfile = !!userStudyPlan?.studyPlanId;
  const isDataLoading = isAuthenticated && (isLoadingUserPlan || isLoadingStats);

  return (
    <AppLayoutWrapper>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {isAuthLoading ? (
              <div className="px-4 py-6 lg:px-6" />
            ) : isDataLoading ? (
              <DashboardSkeleton />
            ) : !isAuthenticated || !dashboardData?.stats ? (
              <EmptyDashboard isAuthenticated={isAuthenticated} hasProfile={hasProfile} />
            ) : (
              <>
                <div className="px-4 lg:px-6">
                  <Suspense fallback={<div className="h-[132px] w-full rounded-lg border bg-muted/20" />}>
                    <DashboardStatsCards stats={dashboardData.stats} />
                  </Suspense>
                </div>

                <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-7">
                  <div ref={distributionRef} className="w-full min-w-0 lg:col-span-4 h-fit">
                    <Suspense fallback={<div className="h-[360px] w-full rounded-lg border bg-muted/20" />}>
                      <CourseStatusChart stats={dashboardData.stats} />
                    </Suspense>
                  </div>
                  <div className="w-full min-w-0 lg:col-span-3" style={distributionHeight ? { maxHeight: distributionHeight } : undefined}>
                    <NextCourses
                      courses={dashboardData.nextCourses}
                      universityId={userStudyPlan?.universityId ?? null}
                      campusId={userStudyPlan?.campusId ?? null}
                      academicUnitId={userStudyPlan?.academicUnitId ?? null}
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
