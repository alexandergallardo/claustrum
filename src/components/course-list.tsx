import { User, Clock, MapPin, Users } from "lucide-react";
import { useMemo, useCallback, memo, useEffect, useRef, useState } from "react";

import type { ScheduleCourse, ScheduleGroup } from "@/lib/types";

import { colorOptions } from "@/components/calendar/calendar-tailwind-classes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getGroupId } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";

type SelectedGroups = Set<string>;

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const formatWeekday = (weekday: number): string => WEEKDAYS[weekday] || "";

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
};

const formatClassroom = (classroom: string | null | undefined): string | null => {
  if (!classroom) return null;
  const normalized = classroom.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase().includes("no disponible")) return null;
  return normalized;
};

const COLOR_STYLE_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "rgb(30 58 138 / 0.2)", border: "rgb(59 130 246)", text: "rgb(147 197 253)" },
  emerald: { bg: "rgb(6 78 59 / 0.2)", border: "rgb(16 185 129)", text: "rgb(110 231 183)" },
  yellow: { bg: "rgb(113 63 18 / 0.2)", border: "rgb(234 179 8)", text: "rgb(254 240 138)" },
  red: { bg: "rgb(153 27 27 / 0.2)", border: "rgb(239 68 68)", text: "rgb(252 165 165)" },
  orange: { bg: "rgb(154 52 18 / 0.2)", border: "rgb(249 115 22)", text: "rgb(253 186 116)" },
  fuchsia: { bg: "rgb(112 26 117 / 0.2)", border: "rgb(217 70 239)", text: "rgb(245 208 254)" },
  violet: { bg: "rgb(76 29 149 / 0.2)", border: "rgb(139 92 246)", text: "rgb(221 214 254)" },
  slate: { bg: "rgb(51 65 85 / 0.2)", border: "rgb(100 116 139)", text: "rgb(203 213 225)" },
};

const getColorStyles = (color: string) => COLOR_STYLE_MAP[color] || COLOR_STYLE_MAP.blue;

interface CourseListProps {
  courses: ScheduleCourse[];
  selectedGroups: SelectedGroups;
  onSelectionChange: (selectedGroups: SelectedGroups) => void;
  campusById?: Map<number, string>;
  showCampus?: boolean;
}

interface GroupView {
  group: ScheduleGroup;
  groupId: string;
  campusLabel: string | null;
  meetingViews: Array<{ id: string; label: string; classroom: string | null }>;
  sharedClassroom: string | null;
  professorLabels: string[];
}

interface CourseViewData {
  course: ScheduleCourse;
  groupViews: GroupView[];
}

function createGroupView(
  course: ScheduleCourse,
  group: ScheduleGroup,
  showCampus: boolean,
  campusById?: Map<number, string>,
): GroupView {
  const campusId = group.campus_id ?? course.campus_id ?? null;
  const groupId = getGroupId(course.course_code, group.group_code);
  const campusLabel = showCampus
    ? campusId
      ? (campusById?.get(campusId) ?? `Sede ${campusId}`)
      : null
    : null;

  const meetings = group.meetings ?? [];
  const professorLabels = group.professors?.filter(Boolean);
  const meetingViews = meetings.map((session, idx) => {
    const classroom = formatClassroom(session.classroom);
    const label = `${formatWeekday(session.weekday)} ${formatTime(session.starts_at)}-${formatTime(session.ends_at)}`;
    return { id: `${groupId}-${idx}`, label, classroom };
  });

  const classrooms = meetingViews.map((meeting) => meeting.classroom);
  const sharedClassroom =
    meetings.length > 1 &&
    classrooms.every((classroom): classroom is string => classroom !== null) &&
    classrooms.every((classroom) => classroom === classrooms[0])
      ? classrooms[0]
      : null;

  return {
    group,
    groupId,
    campusLabel,
    meetingViews,
    sharedClassroom,
    professorLabels: professorLabels?.length ? professorLabels : ["Sin asignar"],
  };
}

function createCourseViewData(
  course: ScheduleCourse,
  showCampus: boolean,
  campusBy?: Map<number, string>,
): CourseViewData {
  const uniqueGroups = new Map<string, ScheduleGroup>();
  for (const group of course.groups ?? []) {
    const groupKey = getGroupId(course.course_code, group.group_code);
    if (!uniqueGroups.has(groupKey)) {
      uniqueGroups.set(groupKey, group);
    }
  }

  const groupViews = Array.from(uniqueGroups.values()).map((g) =>
    createGroupView(course, g, showCampus, campusBy),
  );
  return { course, groupViews };
}

function calculateConflictMap(courses: ScheduleCourse[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const allGroupsList: Array<{ course: ScheduleCourse; group: ScheduleGroup }> = [];

  courses.forEach((course) => {
    if (!course.groups) return;
    course.groups.forEach((group) => {
      allGroupsList.push({ course, group });
    });
  });

  const length = allGroupsList.length;
  for (let i = 0; i < length; i++) {
    const { course: course1, group: group1 } = allGroupsList[i];
    const id1 = getGroupId(course1.course_code, group1.group_code);
    const meetings1 = group1.meetings;

    if (!meetings1) continue;

    for (let j = i + 1; j < length; j++) {
      const { course: course2, group: group2 } = allGroupsList[j];
      const meetings2 = group2.meetings;

      if (!meetings2) continue;

      const id2 = getGroupId(course2.course_code, group2.group_code);

      for (const s1 of meetings1) {
        for (const s2 of meetings2) {
          if (s1.weekday !== s2.weekday) continue;
          if (s1.starts_at < s2.ends_at && s1.ends_at > s2.starts_at) {
            if (!map.has(id1)) map.set(id1, new Set());
            if (!map.has(id2)) map.set(id2, new Set());
            map.get(id1)!.add(id2);
            map.get(id2)!.add(id1);
            break;
          }
        }
      }
    }
  }

  return map;
}

function createGroupLabelMap(
  courses: ScheduleCourse[],
  showCampus: boolean,
  campusById?: Map<number, string>,
): Map<string, string> {
  const map = new Map<string, string>();

  courses.forEach((course) => {
    course.groups?.forEach((group) => {
      const groupId = getGroupId(course.course_code, group.group_code);
      const campusId = group.campus_id ?? course.campus_id ?? null;
      const campusLabel = showCampus
        ? campusId
          ? (campusById?.get(campusId) ?? `Sede ${campusId}`)
          : null
        : null;
      const campusSuffix = campusLabel ? ` • ${campusLabel}` : "";

      map.set(
        groupId,
        `${course.course_code}: ${course.course_name} - GRUPO ${group.group_code}${campusSuffix}`,
      );
    });
  });

  return map;
}

function createConflictReasons(
  selectedGroups: SelectedGroups,
  conflictMap: Map<string, Set<string>>,
  courses: ScheduleCourse[],
  showCampus: boolean,
  campusById?: Map<number, string>,
): { conflictReasons: Map<string, string[]>; disabledSet: Set<string> } {
  const conflictReasons = new Map<string, string[]>();
  const disabledSet = new Set<string>();
  const groupLabelsById = createGroupLabelMap(courses, showCampus, campusById);

  selectedGroups.forEach((selectedId) => {
    const conflicts = conflictMap.get(selectedId);
    if (!conflicts) return;

    const label = groupLabelsById.get(selectedId);
    if (!label) return;

    conflicts.forEach((conflictId) => {
      if (selectedGroups.has(conflictId)) return;
      disabledSet.add(conflictId);

      const existing = conflictReasons.get(conflictId) ?? [];
      conflictReasons.set(conflictId, [...existing, label]);
    });
  });

  return { conflictReasons, disabledSet };
}

export default function CourseList({
  courses,
  selectedGroups,
  onSelectionChange,
  campusById,
  showCampus = false,
}: CourseListProps) {
  const scrollAreaRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = scrollAreaRootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const wrapper = viewport?.firstElementChild as HTMLElement | null;
    if (!wrapper) return;

    wrapper.style.display = "block";
    wrapper.style.width = "100%";

    return () => {
      wrapper.style.display = "";
      wrapper.style.width = "";
    };
  }, []);

  const courseColors = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((course, index) => {
      const color = colorOptions[index % colorOptions.length].value;
      map.set(course.course_code, color);
    });
    return map;
  }, [courses]);

  const courseColorStyles = useMemo(() => {
    const map = new Map<string, { bg: string; border: string; text: string }>();
    courses.forEach((course) => {
      const color = courseColors.get(course.course_code) || "blue";
      map.set(course.course_code, getColorStyles(color));
    });
    return map;
  }, [courses, courseColors]);

  const viewData = useMemo(() => {
    return courses.map((course) => createCourseViewData(course, showCampus, campusById));
  }, [courses, showCampus, campusById]);

  const conflictMap = useMemo(() => {
    return calculateConflictMap(courses);
  }, [courses]);

  const { conflictReasons, disabledSet } = useMemo(() => {
    return createConflictReasons(selectedGroups, conflictMap, courses, showCampus, campusById);
  }, [selectedGroups, conflictMap, courses, showCampus, campusById]);

  const handleGroupToggle = useCallback(
    (courseCode: string, groupCode: string) => {
      const groupId = getGroupId(courseCode, groupCode);
      const newSelection = new Set(selectedGroups);

      if (newSelection.has(groupId)) {
        newSelection.delete(groupId);
      } else {
        newSelection.forEach((selectedId) => {
          const [selectedCourseCode] = selectedId.split("-");
          if (selectedCourseCode === courseCode) {
            newSelection.delete(selectedId);
          }
        });
        newSelection.add(groupId);
      }

      onSelectionChange(newSelection);
    },
    [onSelectionChange, selectedGroups],
  );

  return (
    <TooltipProvider>
      <div ref={scrollAreaRootRef} className="h-full">
        <ScrollArea className="h-full w-full">
          <div className="w-full space-y-4 p-4">
            {viewData.map((courseData) => {
              const course = courseData.course;
              const colorStyles =
                courseColorStyles.get(course.course_code) ?? getColorStyles("blue");

              return (
                <CourseCard
                  key={course.offering_id}
                  course={courseData.course}
                  groupViews={courseData.groupViews}
                  colorStyles={colorStyles}
                  selectedGroupIds={selectedGroups}
                  disabledGroupIdSet={disabledSet}
                  conflictReasonsByGroupId={conflictReasons}
                  onGroupToggle={handleGroupToggle}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

const CourseCard = memo(function CourseCard({
  course,
  groupViews,
  colorStyles,
  selectedGroupIds,
  disabledGroupIdSet,
  conflictReasonsByGroupId,
  onGroupToggle,
}: {
  course: ScheduleCourse;
  groupViews: GroupView[];
  colorStyles: { bg: string; border: string; text: string };
  selectedGroupIds: SelectedGroups;
  disabledGroupIdSet: Set<string>;
  conflictReasonsByGroupId: Map<string, string[]>;
  onGroupToggle: (courseCode: string, groupCode: string) => void;
}) {
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  return (
    <Card className="w-full" style={{ contentVisibility: "auto", containIntrinsicSize: "0 280px" }}>
      <CardHeader>
        <CardTitle className="text-lg">{course.course_name}</CardTitle>
        <CardDescription>
          {course.course_code} • {course.credits} créditos
          {course.level_number !== null &&
            course.level_number !== undefined &&
            course.level_number < 999 && (
              <> • {course.level_label ?? `Nivel ${course.level_number}`}</>
            )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="flex snap-x snap-mandatory gap-3 pt-1 pb-2">
            {groupViews.map((groupView) => {
              const isSelected = selectedGroupIds.has(groupView.groupId);
              const disabled = disabledGroupIdSet.has(groupView.groupId);
              const reasons = conflictReasonsByGroupId.get(groupView.groupId) ?? [];

              return (
                <Tooltip
                  key={groupView.groupId}
                  open={disabled && hoveredGroupId === groupView.groupId}
                >
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled}
                      className={cn(
                        "relative flex min-w-[240px] cursor-pointer snap-start flex-col rounded-lg border-2 p-3 text-left transition-all duration-200",
                        "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm",
                        disabled &&
                          "cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-none",
                        !disabled && !isSelected && "hover:bg-muted/50 border-border",
                        isSelected && "-translate-y-0.5 shadow-lg",
                      )}
                      style={
                        isSelected
                          ? {
                              backgroundColor: colorStyles.bg,
                              borderColor: colorStyles.border,
                            }
                          : undefined
                      }
                      onClick={() =>
                        !disabled && onGroupToggle(course.course_code, groupView.group.group_code)
                      }
                      onPointerEnter={() => setHoveredGroupId(groupView.groupId)}
                      onPointerLeave={() =>
                        setHoveredGroupId((current) =>
                          current === groupView.groupId ? null : current,
                        )
                      }
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            isSelected && "border",
                            isSelected && "bg-background/50",
                          )}
                          style={isSelected ? { borderColor: colorStyles.border } : undefined}
                        >
                          Grupo {groupView.group.group_code}
                        </Badge>
                        <span className={cn("text-foreground text-xs", isSelected && "opacity-80")}>
                          {groupView.group.group_type}
                        </span>
                      </div>

                      {groupView.campusLabel && (
                        <div className="mb-2 flex items-center gap-2">
                          <MapPin
                            className={cn(
                              "h-3.5 w-3.5",
                              isSelected ? "opacity-70" : "text-muted-foreground",
                            )}
                          />
                          <span
                            className={cn("text-foreground text-xs", isSelected && "opacity-80")}
                          >
                            {groupView.campusLabel}
                          </span>
                        </div>
                      )}

                      <Separator className="mb-2" />

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <User
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 self-center",
                              isSelected ? "opacity-70" : "text-muted-foreground",
                            )}
                          />
                          <div className="flex flex-col justify-center gap-1">
                            {groupView.professorLabels.map((professor) => (
                              <span
                                key={professor}
                                className={cn(
                                  "text-foreground text-xs",
                                  isSelected && "opacity-80",
                                )}
                              >
                                {professor}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className={cn("relative", groupView.sharedClassroom && "pr-16")}>
                          <div className="flex items-start gap-2">
                            <Clock
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 self-center",
                                isSelected ? "opacity-70" : "text-muted-foreground",
                              )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                              {groupView.meetingViews.map((meeting) => (
                                <div
                                  key={meeting.id}
                                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                                >
                                  <span
                                    className={cn(
                                      "min-w-0 text-xs leading-tight",
                                      isSelected ? "text-foreground opacity-80" : "text-foreground",
                                    )}
                                  >
                                    {meeting.label}
                                  </span>
                                  {!groupView.sharedClassroom && meeting.classroom && (
                                    <span
                                      className={cn(
                                        "text-muted-foreground flex items-center gap-1 justify-self-end text-xs whitespace-nowrap",
                                        isSelected && "opacity-80",
                                      )}
                                    >
                                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                                      <span>{meeting.classroom}</span>
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {groupView.sharedClassroom && (
                            <div
                              className={cn(
                                "text-muted-foreground absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-1 text-xs whitespace-nowrap",
                                isSelected && "opacity-80",
                              )}
                            >
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span>{groupView.sharedClassroom}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-start gap-2">
                          <Users
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              isSelected ? "opacity-70" : "text-muted-foreground",
                            )}
                          />
                          <span
                            className={cn("text-foreground text-xs", isSelected && "opacity-70")}
                          >
                            {groupView.group.capacity} cupos
                          </span>
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  {disabled && reasons.length > 0 && (
                    <TooltipContent className="bg-destructive max-w-xs text-white">
                      <div className="space-y-1.5">
                        <p className="text-base leading-tight font-semibold">
                          Este grupo choca con:
                        </p>
                        <ul className="space-y-1 text-sm">
                          {reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
});
