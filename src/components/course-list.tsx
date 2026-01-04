import { useState, useMemo } from 'react'
import type { Course, Group } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { groupsHaveConflict, getGroupId } from '@/lib/calendar-utils'
import { colorOptions } from '@/components/calendar/calendar-tailwind-classes'

type SelectedGroups = Set<string>

interface CourseListProps {
  courses: Course[]
  selectedGroups: SelectedGroups
  onSelectionChange: (selectedGroups: SelectedGroups) => void
}

export default function CourseList({
  courses,
  selectedGroups,
  onSelectionChange,
}: CourseListProps) {
  const [courseColors] = useState<Map<string, string>>(() => {
    const map = new Map()
    courses.forEach((course, index) => {
      const color = colorOptions[index % colorOptions.length].value
      map.set(course.courseId, color)
    })
    return map
  })

  const conflictMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const allGroups: Array<{ course: Course; group: Group }> = []

    courses.forEach((course) => {
      course.groups.forEach((group) => {
        allGroups.push({ course, group })
      })
    })

    allGroups.forEach(({ course: course1, group: group1 }, index1) => {
      const id1 = getGroupId(course1.courseId, group1.group)
      allGroups.slice(index1 + 1).forEach(({ course: course2, group: group2 }) => {
        const id2 = getGroupId(course2.courseId, group2.group)
        if (groupsHaveConflict(group1, group2)) {
          if (!map.has(id1)) map.set(id1, new Set())
          if (!map.has(id2)) map.set(id2, new Set())
          map.get(id1)!.add(id2)
          map.get(id2)!.add(id1)
        }
      })
    })

    return map
  }, [courses])

  const isGroupDisabled = (courseId: string, group: number): boolean => {
    const groupId = getGroupId(courseId, group)
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

  const handleGroupToggle = (courseId: string, group: number) => {
    const groupId = getGroupId(courseId, group)
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

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      {courses.map((course) => {
        const color = courseColors.get(course.courseId) || 'blue'
        const colorStyles = getColorStyles(color)

        return (
          <Card key={course.courseId} className="w-full">
            <CardHeader>
              <CardTitle className="text-lg">{course.name}</CardTitle>
              <CardDescription>
                {course.courseId} • {course.credits} créditos • Nivel {course.level}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pt-1 pb-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.3)_transparent] hover:[scrollbar-color:hsl(var(--muted-foreground)/0.5)_transparent]">
                {course.groups.map((group) => {
                  const groupId = getGroupId(course.courseId, group.group)
                  const isSelected = selectedGroups.has(groupId)
                  const isDisabled = isGroupDisabled(course.courseId, group.group)

                  return (
                    <div
                      key={groupId}
                      className={cn(
                        'flex flex-col min-w-[240px] p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer snap-start',
                        'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm',
                        isDisabled && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none',
                        !isDisabled && !isSelected && 'hover:bg-muted/50 border-border',
                        isSelected && 'shadow-lg -translate-y-0.5 ring-1 ring-offset-1 ring-offset-background'
                      )}
                      style={
                        isSelected
                          ? {
                              backgroundColor: colorStyles.bg,
                              borderColor: colorStyles.border,
                              // @ts-expect-error CSS custom property for ring color
                              '--tw-ring-color': colorStyles.border,
                            }
                          : undefined
                      }
                      onClick={() => !isDisabled && handleGroupToggle(course.courseId, group.group)}
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
                          Grupo {group.group}
                        </Badge>
                        <span className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-muted-foreground')}>
                          {group.type}
                        </span>
                      </div>

                      <Separator className="mb-2" />

                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <User className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                          <span className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                            {group.professor}
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <Clock className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                          <div className="flex flex-col">
                            {group.sessions.map((session, idx) => (
                              <span key={idx} className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                                {session.day} {session.startTime}-{session.endTime}
                              </span>
                            ))}
                          </div>
                        </div>

                        {(() => {
                          const classrooms = group.sessions
                            .map((s) => s.classroom)
                            .filter((c): c is string => !!c)
                          const uniqueClassrooms = [...new Set(classrooms)]
                          
                          if (uniqueClassrooms.length === 0) {
                            return (
                              <div className="flex items-start gap-2">
                                <MapPin className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                                <span className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                                  Sin aula
                                </span>
                              </div>
                            )
                          }
                          
                          if (uniqueClassrooms.length === 1) {
                            return (
                              <div className="flex items-start gap-2">
                                <MapPin className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                                <span className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                                  {uniqueClassrooms[0]}
                                </span>
                              </div>
                            )
                          }
                          
                          return (
                            <div className="flex items-start gap-2">
                              <MapPin className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')} />
                              <div className="flex flex-col">
                                {uniqueClassrooms.map((classroom, idx) => (
                                  <span key={idx} className={cn('text-xs', isSelected ? 'text-muted-foreground/80' : 'text-foreground')}>
                                    {classroom}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      <p className={cn('text-xs mt-2', isSelected ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
                        {group.capacity} cupos
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
