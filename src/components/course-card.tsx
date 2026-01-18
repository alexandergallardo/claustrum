import type { Course, CourseStatus } from "@/components/curriculum-grid"
import { cn } from "@/lib/utils"
import { ArrowRight, Lock, Unlock, Link } from "lucide-react"

export type RelationType = 'prerequisite' | 'corequisite' | 'postrequisite' | null

interface CourseCardProps {
  course: Course
  isHovered: boolean
  relationType?: RelationType
  id?: string
}

const statusConfig: Record<CourseStatus, { label: string; bgClassName: string; borderClassName: string }> = {
  approved: {
    label: "Aprobado",
    bgClassName: "bg-chart-2/20",
    borderClassName: "border-chart-2/30 hover:border-chart-2/50",
  },
  failed: {
    label: "Reprobado",
    bgClassName: "bg-destructive/20",
    borderClassName: "border-destructive/30 hover:border-destructive/50",
  },
  not_taken: {
    label: "No cursado",
    bgClassName: "bg-muted",
    borderClassName: "border-border hover:border-muted-foreground/30",
  },
  withdrawn: {
    label: "Retirado",
    bgClassName: "bg-muted/50",
    borderClassName: "border-muted-foreground/20 hover:border-muted-foreground/40",
  },
  in_progress: {
    label: "En curso",
    bgClassName: "bg-chart-1/20",
    borderClassName: "border-chart-1/30 hover:border-chart-1/50",
  },
}

const relationConfig: Record<string, { ringClass: string; icon: React.ReactNode; label: string }> = {
  prerequisite: {
    ringClass: "ring-2 ring-amber-500 shadow-md",
    icon: <Lock className="w-3 h-3 text-amber-600" />,
    label: "Requisito",
  },
  corequisite: {
    ringClass: "ring-2 ring-blue-500 shadow-md",
    icon: <Link className="w-3 h-3 text-blue-600" />,
    label: "Correquisito",
  },
  postrequisite: {
    ringClass: "ring-2 ring-emerald-500 shadow-md",
    icon: <Unlock className="w-3 h-3 text-emerald-600" />,
    label: "Desbloquea",
  },
}

export function CourseCard({ course, isHovered, relationType, id }: CourseCardProps) {
  const config = statusConfig[course.status]
  const relation = relationType ? relationConfig[relationType] : null

  return (
    <div
      id={id}
      className={cn(
        "relative rounded-lg border-2 transition-all duration-200 cursor-pointer shadow-sm overflow-hidden",
        config.borderClassName,
        isHovered && "ring-2 ring-primary shadow-lg scale-105 z-10",
        relation?.ringClass,
        !isHovered && !relationType && "hover:border-primary/50"
      )}
    >
      {relation && (
        <div className="absolute -top-1 -right-1 z-20 bg-background rounded-full p-1 shadow-sm border border-border">
          {relation.icon}
        </div>
      )}
      
      <div className="bg-card px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="min-w-[3ch] text-right">{course.credits} cr</span>
          <span className="font-semibold flex-1 text-center px-2">{course.code}</span>
          <span className="min-w-[4ch] text-left">{course.hours} h</span>
        </div>
      </div>

      <div className={cn("px-3 py-2 min-h-16 flex items-center justify-center text-center relative", config.bgClassName)}>
        <h3 className="w-full font-semibold text-foreground text-xs leading-tight line-clamp-2">{course.name}</h3>
        
        {relation && (
          <div className="absolute bottom-1 right-2 text-[10px] font-medium opacity-80">
            {/* Optional: Show label if needed, or just rely on color/icon */}
          </div>
        )}
      </div>
    </div>
  )
}
