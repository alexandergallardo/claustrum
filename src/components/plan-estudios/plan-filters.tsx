import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CatalogUniversity, CatalogCampus, CatalogCareerProgram, CatalogStudyPlan } from '@/lib/types'

interface PlanFiltersProps {
  universities: CatalogUniversity[]
  campuses: CatalogCampus[]
  careerPrograms: CatalogCareerProgram[]
  plans: CatalogStudyPlan[]
  selectedUniversityId: number | null
  selectedCampusId: number | null
  selectedCareerProgramId: number | null
  selectedPlanId: number | null
  onUniversityChange: (id: number | null) => void
  onCampusChange: (id: number | null) => void
  onCareerProgramChange: (id: number | null) => void
  onPlanChange: (id: number | null) => void
  isLoadingUniversities: boolean
  isLoadingCampuses?: boolean
  isLoadingCareerPrograms: boolean
  isLoadingPlans: boolean
}

const truncateText = (text: string, maxLength = 35) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

const normalizeText = (text: string) => text.toUpperCase()

export function PlanFilters({
  universities,
  campuses,
  careerPrograms,
  plans,
  selectedUniversityId,
  selectedCampusId,
  selectedCareerProgramId,
  selectedPlanId,
  onUniversityChange,
  onCampusChange,
  onCareerProgramChange,
  onPlanChange,
  isLoadingUniversities,
  isLoadingCampuses = false,
  isLoadingCareerPrograms,
  isLoadingPlans,
}: PlanFiltersProps) {
  if (isLoadingUniversities) {
    return <Skeleton className="h-12 w-full" />
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Universities */}
      <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        <label className="text-sm font-medium">Universidad</label>
        <Select value={selectedUniversityId?.toString() || ''} onValueChange={(val) => onUniversityChange(val ? parseInt(val) : null)}>
          <SelectTrigger className="w-auto min-w-[200px] max-w-[500px]">
            <SelectValue placeholder="Selecciona una universidad" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
            <SelectGroup>
              <TooltipProvider>
                {universities.map((uni) => {
                  const fullText = normalizeText(uni.name)
                  const displayText = truncateText(fullText)
                  return (
                    <Tooltip key={uni.id}>
                      <TooltipTrigger asChild>
                        <SelectItem value={uni.id.toString()}>
                          {displayText}
                        </SelectItem>
                      </TooltipTrigger>
                      {displayText !== fullText && (
                        <TooltipContent side="right">
                          <p>{fullText}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </TooltipProvider>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Campuses - Only show if university is selected AND data is loaded */}
      {selectedUniversityId && !isLoadingCampuses && campuses.length > 0 && (
        <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <label className="text-sm font-medium">Sede</label>
          <Select value={selectedCampusId?.toString() || ''} onValueChange={(val) => onCampusChange(val ? parseInt(val) : null)}>
            <SelectTrigger className="w-auto min-w-[200px] max-w-[500px]">
              <SelectValue placeholder="Selecciona una sede" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
              <SelectGroup>
                <TooltipProvider>
                  {campuses.map((campus) => {
                    const fullText = normalizeText(campus.name)
                    const displayText = truncateText(fullText)
                    return (
                      <Tooltip key={campus.id}>
                        <TooltipTrigger asChild>
                          <SelectItem value={campus.id.toString()}>
                            {displayText}
                          </SelectItem>
                        </TooltipTrigger>
                        {displayText !== fullText && (
                          <TooltipContent side="right">
                            <p>{fullText}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )
                  })}
                </TooltipProvider>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Career programs - Only show if campus is selected AND data is loaded */}
      {selectedCampusId && !isLoadingCareerPrograms && careerPrograms.length > 0 && (
        <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <label className="text-sm font-medium">Carrera</label>
          <Select value={selectedCareerProgramId?.toString() || ''} onValueChange={(val) => onCareerProgramChange(val ? parseInt(val) : null)}>
            <SelectTrigger className="w-auto min-w-[200px] max-w-[500px]">
              <SelectValue placeholder="Selecciona una carrera" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
              <SelectGroup>
                <TooltipProvider>
                  {careerPrograms.map((program) => {
                    const fullText = normalizeText(program.name)
                    const displayText = truncateText(fullText)
                    return (
                      <Tooltip key={program.id}>
                        <TooltipTrigger asChild>
                          <SelectItem value={program.id.toString()}>
                            {displayText}
                          </SelectItem>
                        </TooltipTrigger>
                        {displayText !== fullText && (
                          <TooltipContent side="right">
                            <p>{fullText}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )
                  })}
                </TooltipProvider>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Plans - Only show if career program is selected AND data is loaded */}
      {selectedCareerProgramId && !isLoadingPlans && plans.length > 0 && (
        <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <label className="text-sm font-medium">Plan de estudios</label>
          <Select value={selectedPlanId?.toString() || ''} onValueChange={(val) => onPlanChange(val ? parseInt(val) : null)}>
            <SelectTrigger className="w-auto min-w-[200px] max-w-[500px]">
              <SelectValue placeholder="Selecciona un plan" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
              <SelectGroup>
                <TooltipProvider>
                  {plans.map((plan) => {
                    // name already comes formatted as "external_plan_id - name" from RPC
                    const fullText = normalizeText(plan.name)
                    const displayText = truncateText(fullText)
                    return (
                      <Tooltip key={plan.id}>
                        <TooltipTrigger asChild>
                          <SelectItem value={plan.id.toString()}>
                            {displayText}
                          </SelectItem>
                        </TooltipTrigger>
                        {displayText !== fullText && (
                          <TooltipContent side="right">
                            <p>{fullText}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )
                  })}
                </TooltipProvider>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
