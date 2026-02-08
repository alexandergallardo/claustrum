import { useMemo, useRef, useCallback, memo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ScheduleCourse, ScheduleGroup } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Clock, AlertTriangle, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGroupId } from '@/lib/calendar-utils'
import { colorOptions } from '@/components/calendar/calendar-tailwind-classes'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type SelectedGroups = Set<string>

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const formatWeekday = (weekday: number): string => WEEKDAYS[weekday] || ''

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':')
  return `${hours.padStart(2, '0')}:${minutes}`
}

const formatClassroom = (classroom: string | null | undefined): string | null => {
  if (!classroom) return null
  const normalized = classroom.trim()
  if (!normalized) return null
  if (normalized.toLowerCase().includes('no disponible')) return null
  return normalized
}

const COLOR_STYLE_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'rgb(30 58 138 / 0.2)', border: 'rgb(59 130 246)', text: 'rgb(147 197 253)' },
  emerald: { bg: 'rgb(6 78 59 / 0.2)', border: 'rgb(16 185 129)', text: 'rgb(110 231 183)' },
  yellow: { bg: 'rgb(113 63 18 / 0.2)', border: 'rgb(234 179 8)', text: 'rgb(254 240 138)' },
  red: { bg: 'rgb(153 27 27 / 0.2)', border: 'rgb(239 68 68)', text: 'rgb(252 165 165)' },
  orange: { bg: 'rgb(154 52 18 / 0.2)', border: 'rgb(249 115 22)', text: 'rgb(253 186 116)' },
  fuchsia: { bg: 'rgb(112 26 117 / 0.2)', border: 'rgb(217 70 239)', text: 'rgb(245 208 254)' },
  violet: { bg: 'rgb(76 29 149 / 0.2)', border: 'rgb(139 92 246)', text: 'rgb(221 214 254)' },
  slate: { bg: 'rgb(51 65 85 / 0.2)', border: 'rgb(100 116 139)', text: 'rgb(203 213 225)' },
}

const getColorStyles = (color: string) => COLOR_STYLE_MAP[color] || COLOR_STYLE_MAP.blue

interface CourseListProps {
  courses: ScheduleCourse[]
  selectedGroups: SelectedGroups
  onSelectionChange: (selectedGroups: SelectedGroups) => void
  campusById?: Map<number, string>
  showCampus?: boolean
}

interface GroupView {
  group: ScheduleGroup
  groupId: string
  campusLabel: string | null
  meetingLabels: Array<{ id: string; label: string }>
  professorLabel: string
}

interface CourseViewData {
  course: ScheduleCourse
  groupViews: GroupView[]
}

const BASE_HEIGHT = 232
const LINE_HEIGHT = 18
const CAMPUS_LINE_SHOW = 1
const CAMPUS_LINE_HIDE = 0

function calculateEstimatedHeight(course: ScheduleCourse, showCampus: boolean): number {
  const groups = course.groups ?? []
  const maxMeetings = groups.reduce((max, group) => {
    const count = group.meetings?.length ?? 0
    return Math.max(max, count)
  }, 0)
  const campusLine = showCampus ? CAMPUS_LINE_SHOW : CAMPUS_LINE_HIDE
  const estimatedLines = 3 + campusLine + maxMeetings
  return BASE_HEIGHT + estimatedLines * LINE_HEIGHT
}

function createGroupView(
  course: ScheduleCourse,
  group: ScheduleGroup,
  showCampus: boolean,
  campusById?: Map<number, string>
): GroupView {
  const campusId = group.campus_id ?? course.campus_id ?? null
  const groupId = getGroupId(course.course_code, parseInt(group.group_code, 10), campusId)
  const campusLabel = showCampus
    ? (campusId ? campusById?.get(campusId) ?? `Sede ${campusId}` : null)
    : null

  const meetingLabels = (group.meetings ?? []).map((session, idx) => {
    const classroom = formatClassroom(session.classroom)
    const label = `${formatWeekday(session.weekday)} ${formatTime(session.starts_at)}-${formatTime(session.ends_at)}${classroom ? ` • Aula ${classroom}` : ''}`
    return { id: `${groupId}-${idx}`, label }
  })

  return {
    group,
    groupId,
    campusLabel,
    meetingLabels,
    professorLabel: group.professors?.join(', ') || 'Sin asignar',
  }
}

function createCourseViewData(course: ScheduleCourse, showCampus: boolean, campusBy?: Map<number, string>): CourseViewData {
  const groupViews = (course.groups ?? []).map(g => createGroupView(course, g, showCampus, campusBy))
  return { course, groupViews }
}

function calculateConflictMap(courses: ScheduleCourse[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const allGroupsList: Array<{ course: ScheduleCourse; group: ScheduleGroup }> = []

  courses.forEach((course) => {
    if (!course.groups) return
    course.groups.forEach((group) => {
      allGroupsList.push({ course, group })
    })
  })

  const length = allGroupsList.length
  for (let i = 0; i < length; i++) {
    const { course: course1, group: group1 } = allGroupsList[i]
    const id1 = getGroupId(course1.course_code, parseInt(group1.group_code, 10), group1.campus_id)
    const meetings1 = group1.meetings

    if (!meetings1) continue

    for (let j = i + 1; j < length; j++) {
      const { course: course2, group: group2 } = allGroupsList[j]
      const meetings2 = group2.meetings

      if (!meetings2) continue

      const id2 = getGroupId(course2.course_code, parseInt(group2.group_code, 10), group2.campus_id)

      for (const s1 of meetings1) {
        for (const s2 of meetings2) {
          if (s1.weekday !== s2.weekday) continue
          if (s1.starts_at < s2.ends_at && s1.ends_at > s2.starts_at) {
            if (!map.has(id1)) map.set(id1, new Set())
            if (!map.has(id2)) map.set(id2, new Set())
            map.get(id1)!.add(id2)
            map.get(id2)!.add(id1)
            break
          }
        }
      }
    }
  }

  return map
}

function createConflictReasons(
  selectedGroups: SelectedGroups,
  conflictMap: Map<string, Set<string>>,
  courses: ScheduleCourse[],
  showCampus: boolean,
  campusById?: Map<number, string>
): { conflictReasons: Map<string, string[]>; disabledSet: Set<string> } {
  const conflictReasons = new Map<string, string[]>()
  const disabledSet = new Set<string>()
  const courseByCode = new Map(courses.map(c => [c.course_code, c] as [string, ScheduleCourse]))

  selectedGroups.forEach((selectedId) => {
    const conflicts = conflictMap.get(selectedId)
    if (!conflicts) return

    conflicts.forEach((conflictId) => {
      if (selectedGroups.has(conflictId)) return
      disabledSet.add(conflictId)

      const [courseCode, groupNum, campusIdStr] = selectedId.split('-')
      const course = courseByCode.get(courseCode)
      if (!course) return

      const campusId = campusIdStr ? parseInt(campusIdStr, 10) : null
      const campusLabel = showCampus ? (campusId ? campusById?.get(campusId) ?? `Sede ${campusId}` : null) : null
      const campusSuffix = campusLabel ? ` • ${campusLabel}` : ''
      const label = `${course.course_name} (Grupo ${groupNum}${campusSuffix})`

      const existing = conflictReasons.get(conflictId) ?? []
      conflictReasons.set(conflictId, [...existing, label])
    })
  })

  return { conflictReasons, disabledSet }
}

export default function CourseList({
  courses,
  selectedGroups,
  onSelectionChange,
  campusById,
  showCampus = false,
}: CourseListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const itemCountRef = useRef(courses.length)
  const measuredHeightsRef = useRef<number[]>([])
  const conflictMapRef = useRef<Map<string, Set<string>> | null>(null)

  const courseCountRef = useRef(courses.length)

  useEffect(() => {
    if (courses.length !== itemCountRef.current) {
      measuredHeightsRef.current = []
      itemCountRef.current = courses.length
    }
    if (courses.length !== courseCountRef.current) {
      conflictMapRef.current = null
      courseCountRef.current = courses.length
    }
  }, [courses.length])

  const estimatedHeights = useMemo(() => {
    return courses.map(course => calculateEstimatedHeight(course, showCampus))
  }, [courses, showCampus])

  const courseColors = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach((course, index) => {
      const color = colorOptions[index % colorOptions.length].value
      map.set(course.course_code, color)
    })
    return map
  }, [courses])

  const courseColorStyles = useMemo(() => {
    const map = new Map<string, { bg: string; border: string; text: string }>()
    courses.forEach((course) => {
      const color = courseColors.get(course.course_code) || 'blue'
      map.set(course.course_code, getColorStyles(color))
    })
    return map
  }, [courses, courseColors])

  const viewData = useMemo(() => {
    return courses.map(course => createCourseViewData(course, showCampus, campusById))
  }, [courses, showCampus, campusById])

  const conflictMap = useMemo(() => {
    if (conflictMapRef.current) return conflictMapRef.current
    const result = calculateConflictMap(courses)
    conflictMapRef.current = result
    return result
  }, [courses])

  const { conflictReasons, disabledSet } = useMemo(() => {
    return createConflictReasons(selectedGroups, conflictMap, courses, showCampus, campusById)
  }, [selectedGroups, conflictMap, courses, showCampus, campusById])

  const rowVirtualizer = useVirtualizer({
    count: courses.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => measuredHeightsRef.current[index] ?? estimatedHeights[index] ?? 320,
    overscan: 1,
    getItemKey: (index) => courses[index]?.offering_id ?? index,
  })

  const handleItemMounted = useCallback((index: number, element: HTMLElement | null) => {
    if (element && measuredHeightsRef.current[index] === undefined) {
      const height = element.getBoundingClientRect().height
      measuredHeightsRef.current[index] = height
    }
  }, [])

  const handleGroupToggle = useCallback(
    (courseCode: string, groupCode: string, campusId?: number | null) => {
      const groupId = getGroupId(courseCode, parseInt(groupCode, 10), campusId)
      const newSelection = new Set(selectedGroups)

      if (newSelection.has(groupId)) {
        newSelection.delete(groupId)
      } else {
        newSelection.forEach((selectedId) => {
          const [selectedCourseCode] = selectedId.split('-')
          if (selectedCourseCode === courseCode) {
            newSelection.delete(selectedId)
          }
        })
        newSelection.add(groupId)
      }

      onSelectionChange(newSelection)
    },
    [onSelectionChange, selectedGroups]
  )

  return (
    <TooltipProvider>
      <div ref={scrollRef} className="h-full overflow-auto">
        <div
          className="relative w-full"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const courseData = viewData[virtualRow.index]
            const course = courseData.course
            const colorStyles = courseColorStyles.get(course.course_code) ?? getColorStyles('blue')

            return (
              <div
                key={course.offering_id}
                ref={(el) => {
                  rowVirtualizer.measureElement(el)
                  handleItemMounted(virtualRow.index, el)
                }}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full px-4 py-2"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <CourseCard
                  course={courseData.course}
                  groupViews={courseData.groupViews}
                  colorStyles={colorStyles}
                  selectedGroupIds={selectedGroups}
                  disabledGroupIdSet={disabledSet}
                  conflictReasonsByGroupId={conflictReasons}
                  onGroupToggle={handleGroupToggle}
                />
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
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
  course: ScheduleCourse
  groupViews: GroupView[]
  colorStyles: { bg: string; border: string; text: string }
  selectedGroupIds: SelectedGroups
  disabledGroupIdSet: Set<string>
  conflictReasonsByGroupId: Map<string, string[]>
  onGroupToggle: (courseCode: string, groupCode: string, campusId?: number | null) => void
}) {
  return (
    <Card className="w-full" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}>
      <CardHeader>
        <CardTitle className="text-lg">{course.course_name}</CardTitle>
        <CardDescription>
          {course.course_code} • {course.credits} créditos
          {course.level_number !== null && course.level_number !== undefined && course.level_number < 999 && (
            <> • {course.level_label ?? `Nivel ${course.level_number}`}</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full" scrollbarOrientation="horizontal">
          <div className="flex gap-3 pt-1 pb-2 snap-x snap-mandatory">
            {groupViews.map((groupView) => {
              const isSelected = selectedGroupIds.has(groupView.groupId)
              const disabled = disabledGroupIdSet.has(groupView.groupId)
              const reasons = conflictReasonsByGroupId.get(groupView.groupId) ?? []

              return (
                <Tooltip key={groupView.groupId}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'flex flex-col min-w-[240px] p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer snap-start relative',
                        'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm',
                        disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none',
                        !disabled && !isSelected && 'hover:bg-muted/50 border-border',
                        isSelected && 'shadow-lg -translate-y-0.5'
                      )}
                      style={
                        isSelected
                          ? {
                              backgroundColor: colorStyles.bg,
                              borderColor: colorStyles.border,
                            }
                          : undefined
                      }
                      onClick={() => !disabled && onGroupToggle(course.course_code, groupView.group.group_code, groupView.group.campus_id ?? course.campus_id)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            isSelected && 'border',
                            isSelected && 'bg-background/50'
                          )}
                          style={isSelected ? { borderColor: colorStyles.border } : undefined}
                        >
                          Grupo {groupView.group.group_code}
                        </Badge>
                        <span className={cn('text-xs text-foreground', isSelected && 'opacity-80')}>
                          {groupView.group.group_type}
                        </span>
                      </div>

                      {groupView.campusLabel && (
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className={cn('h-3.5 w-3.5', isSelected ? 'opacity-70' : 'text-muted-foreground')} />
                          <span className={cn('text-xs text-foreground', isSelected && 'opacity-80')}>
                            {groupView.campusLabel}
                          </span>
                        </div>
                      )}

                      <Separator className="mb-2" />

                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <User className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'opacity-70' : 'text-muted-foreground')} />
                          <span className={cn('text-xs text-foreground', isSelected && 'opacity-80')}>
                            {groupView.professorLabel}
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <Clock className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'opacity-70' : 'text-muted-foreground')} />
                          <div className="flex flex-col gap-1">
                            {groupView.meetingLabels.map((meeting) => (
                              <span key={meeting.id} className={cn('text-xs text-foreground', isSelected && 'opacity-80')}>
                                {meeting.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Users className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'opacity-70' : 'text-muted-foreground')} />
                          <span className={cn('text-xs text-foreground', isSelected && 'opacity-70')}>
                            {groupView.group.capacity} cupos
                          </span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  {disabled && reasons.length > 0 && (
                    <TooltipContent className="max-w-xs bg-destructive text-destructive-foreground">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Grupo bloqueado</p>
                          <p className="text-sm">Choque con:</p>
                          <ul className="text-sm list-disc list-inside">
                            {reasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
})
