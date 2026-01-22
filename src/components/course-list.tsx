import { useState, useMemo } from 'react'
import type { ScheduleCourse, ScheduleGroup } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Clock, AlertTriangle } from 'lucide-react'
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

interface CourseListProps {
  courses: ScheduleCourse[]
  selectedGroups: SelectedGroups
  onSelectionChange: (selectedGroups: SelectedGroups) => void
}

export default function CourseList({
  courses,
  selectedGroups,
  onSelectionChange,
}: CourseListProps) {
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)

  const courseColors = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach((course, index) => {
      const color = colorOptions[index % colorOptions.length].value
      map.set(course.course_code, color)
    })
    return map
  }, [courses])

  const conflictMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const allGroupsList: Array<{ course: ScheduleCourse; group: ScheduleGroup }> = []

    courses.forEach((course) => {
      if (course.groups) {
        course.groups.forEach((group) => {
          allGroupsList.push({ course, group })
        })
      }
    })

    allGroupsList.forEach(({ course: course1, group: group1 }, index1) => {
      const id1 = getGroupId(course1.course_code, parseInt(group1.group_code, 10))
      allGroupsList.slice(index1 + 1).forEach(({ course: course2, group: group2 }) => {
        const id2 = getGroupId(course2.course_code, parseInt(group2.group_code, 10))
        if (group1.meetings && group2.meetings) {
          for (const s1 of group1.meetings) {
            for (const s2 of group2.meetings) {
              if (s1.weekday !== s2.weekday) continue
              if (s1.starts_at < s2.ends_at && s1.ends_at > s2.starts_at) {
                if (!map.has(id1)) map.set(id1, new Set())
                if (!map.has(id2)) map.set(id2, new Set())
                map.get(id1)!.add(id2)
                map.get(id2)!.add(id1)
              }
            }
          }
        }
      })
    })

    return map
  }, [courses])

  const getConflictReasons = (courseCode: string, groupCode: string): string[] => {
    const reasons: string[] = []
    const groupId = getGroupId(courseCode, parseInt(groupCode, 10))
    const conflictingIds = conflictMap.get(groupId)

    if (!conflictingIds) return reasons

    for (const otherId of conflictingIds) {
      if (selectedGroups.has(otherId)) {
        const [otherCourseCode, otherGroupNum] = otherId.split('-')
        const otherCourse = courses.find((c) => c.course_code === otherCourseCode)
        if (otherCourse) {
          reasons.push(`${otherCourse.course_name} (Grupo ${otherGroupNum})`)
        }
      }
    }

    return reasons
  }

  const isGroupDisabled = (courseCode: string, groupCode: string): boolean => {
    const groupId = getGroupId(courseCode, parseInt(groupCode, 10))
    if (selectedGroups.has(groupId)) return false

    const conflicts = conflictMap.get(groupId)
    if (!conflicts) return false

    for (const selectedId of selectedGroups) {
      if (conflicts.has(selectedId)) {
        return true
      }
    }

    return false
  }

  const handleGroupToggle = (courseCode: string, groupCode: string) => {
    const groupId = getGroupId(courseCode, parseInt(groupCode, 10))
    const newSelection = new Set(selectedGroups)

    if (newSelection.has(groupId)) {
      newSelection.delete(groupId)
    } else {
      newSelection.add(groupId)
    }

    onSelectionChange(newSelection)
  }

  const getColorStyles = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      blue: { bg: 'rgb(30 58 138 / 0.2)', border: 'rgb(59 130 246)', text: 'rgb(147 197 253)' },
      indigo: { bg: 'rgb(55 48 163 / 0.2)', border: 'rgb(99 102 241)', text: 'rgb(165 180 252)' },
      pink: { bg: 'rgb(157 23 77 / 0.2)', border: 'rgb(236 72 153)', text: 'rgb(249 168 212)' },
      red: { bg: 'rgb(153 27 27 / 0.2)', border: 'rgb(239 68 68)', text: 'rgb(252 165 165)' },
      orange: { bg: 'rgb(154 52 18 / 0.2)', border: 'rgb(249 115 22)', text: 'rgb(253 186 116)' },
      amber: { bg: 'rgb(146 64 14 / 0.2)', border: 'rgb(245 158 11)', text: 'rgb(253 224 71)' },
      emerald: { bg: 'rgb(6 78 59 / 0.2)', border: 'rgb(16 185 129)', text: 'rgb(110 231 183)' },
    }
    return colorMap[color] || colorMap.blue
  }

  const formatWeekday = (weekday: number): string => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return days[weekday] || ''
  }

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':')
    return `${hours.padStart(2, '0')}:${minutes}`
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 h-full overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
        {courses.map((course) => {
          const color = courseColors.get(course.course_code) || 'blue'
          const colorStyles = getColorStyles(color)

          return (
            <Card key={course.offering_id} className="w-full">
              <CardHeader>
                <CardTitle className="text-lg">{course.course_name}</CardTitle>
                <CardDescription>
                  {course.course_code} • {course.credits} créditos
                  {course.level_number !== null && course.level_number !== undefined && course.level_number < 999 && (
                    <> • Nivel {course.level_number}</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 overflow-x-auto pt-1 pb-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.3)_transparent] hover:[scrollbar-color:hsl(var(--muted-foreground)/0.5)_transparent]">
                  {course.groups?.map((group) => {
                    const groupId = getGroupId(course.course_code, parseInt(group.group_code, 10))
                    const isSelected = selectedGroups.has(groupId)
                    const disabled = isGroupDisabled(course.course_code, group.group_code)
                    const reasons = disabled ? getConflictReasons(course.course_code, group.group_code) : []
                    const showBlockedTooltip = disabled && hoveredGroupId === groupId && reasons.length > 0

                    return (
                      <Tooltip key={groupId}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'flex flex-col min-w-[240px] p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer snap-start relative',
                              'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm',
                              disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none',
                              !disabled && !isSelected && 'hover:bg-muted/50 border-border',
                              isSelected && 'shadow-lg -translate-y-0.5 ring-1 ring-offset-1 ring-offset-background'
                            )}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: colorStyles.bg,
                                    borderColor: colorStyles.border,
                                  }
                                : undefined
                            }
                            onClick={() => !disabled && handleGroupToggle(course.course_code, group.group_code)}
                            onMouseEnter={() => setHoveredGroupId(groupId)}
                            onMouseLeave={() => setHoveredGroupId(null)}
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
                                Grupo {group.group_code}
                              </Badge>
                              <span className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-muted-foreground')}>
                                {group.group_type}
                              </span>
                            </div>

                            <Separator className="mb-2" />

                            <div className="space-y-1.5">
                              <div className="flex items-start gap-2">
                                <User className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                                <span className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                                  {group.professors?.join(', ') || 'Sin asignar'}
                                </span>
                              </div>

                              <div className="flex items-start gap-2">
                                <Clock className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                                <div className="flex flex-col">
                                  {group.meetings?.map((session, idx) => (
                                    <span key={idx} className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                                      {formatWeekday(session.weekday)} {formatTime(session.starts_at)}-{formatTime(session.ends_at)}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <p className={cn('text-xs mt-2', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
                                {group.capacity} cupos
                              </p>
                            </div>
                          </div>
                        </TooltipTrigger>
                        {showBlockedTooltip && (
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
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
