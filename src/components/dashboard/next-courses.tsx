"use client";

import { Link } from "@tanstack/react-router";

import type { NextCourse } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NextCoursesProps {
  courses: NextCourse[];
  universityId: number | null;
  campusId: number | null;
  academicUnitId: number | null;
  studyPlanId: number | null;
}

export function NextCourses({
  courses,
  universityId,
  campusId,
  academicUnitId,
  studyPlanId,
}: NextCoursesProps) {
  const searchParams =
    studyPlanId && universityId && campusId && academicUnitId
      ? { university: universityId, campus: campusId, career: academicUnitId, plan: studyPlanId }
      : null;

  const CourseLink = ({ course }: { course: NextCourse }) => {
    if (searchParams) {
      return (
        <Link to="/curriculum" search={searchParams} className="block cursor-pointer">
          <div className="bg-muted/50 hover:bg-muted flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs">{course.code}</span>
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">
                  {course.levelLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm font-medium">{course.name}</p>
              <p className="text-muted-foreground text-xs">{course.credits} créditos</p>
            </div>
          </div>
        </Link>
      );
    }
    return (
      <div className="bg-muted/50 flex items-center justify-between rounded-lg p-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">{course.code}</span>
            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">
              {course.levelLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{course.name}</p>
          <p className="text-muted-foreground text-xs">{course.credits} créditos</p>
        </div>
      </div>
    );
  };

  return (
    <Card className="flex h-full w-full flex-col overflow-hidden">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-base">Próximos cursos</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-0">
        {courses.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay cursos disponibles para mostrar.</p>
        ) : (
          <ScrollArea className="h-full pr-3">
            <div className="space-y-2">
              {courses.map((course) => (
                <CourseLink key={course.id} course={course} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
