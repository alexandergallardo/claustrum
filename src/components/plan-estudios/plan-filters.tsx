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

function FilterSkeleton() {
  return <Skeleton className="h-10 w-[200px]" />
}

function FilterSelect({
  label,
  value,
  placeholder,
  items,
  onChange,
  isLoading,
  isVisible,
}: {
  label: string
  value: string
  placeholder: string
  items: { id: number; name: string }[]
  onChange: (val: string) => void
  isLoading: boolean
  isVisible: boolean
}) {
  if (!isVisible) return null

  const hasData = items.length > 0
  const showSkeleton = isLoading && !hasData

  return (
    <div className={`flex flex-col gap-2 ${showSkeleton ? 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200' : ''}`}>
      <label className="text-sm font-medium">{label}</label>
      {showSkeleton ? (
        <FilterSkeleton />
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="w-auto min-w-[200px] max-w-[500px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
            <SelectGroup>
              <TooltipProvider>
                {items.map((item) => {
                  const fullText = normalizeText(item.name)
                  const displayText = truncateText(fullText)
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <SelectItem value={item.id.toString()}>
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
      )}
    </div>
  )
}

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
  const hasUniversities = universities.length > 0

  if (!hasUniversities && isLoadingUniversities) {
    return (
      <div className="flex flex-wrap items-end gap-4">
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <FilterSelect
        label="Universidad"
        value={selectedUniversityId?.toString() || ''}
        placeholder="Selecciona una universidad"
        items={universities}
        onChange={(val) => onUniversityChange(val ? parseInt(val) : null)}
        isLoading={!hasUniversities && isLoadingUniversities}
        isVisible={true}
      />

      <FilterSelect
        label="Sede"
        value={selectedCampusId?.toString() || ''}
        placeholder="Selecciona una sede"
        items={campuses}
        onChange={(val) => onCampusChange(val ? parseInt(val) : null)}
        isLoading={!campuses.length && isLoadingCampuses}
        isVisible={!!selectedUniversityId}
      />

      <FilterSelect
        label="Carrera"
        value={selectedCareerProgramId?.toString() || ''}
        placeholder="Selecciona una carrera"
        items={careerPrograms}
        onChange={(val) => onCareerProgramChange(val ? parseInt(val) : null)}
        isLoading={!careerPrograms.length && isLoadingCareerPrograms}
        isVisible={!!selectedCampusId}
      />

      <FilterSelect
        label="Plan de estudios"
        value={selectedPlanId?.toString() || ''}
        placeholder="Selecciona un plan"
        items={plans}
        onChange={(val) => onPlanChange(val ? parseInt(val) : null)}
        isLoading={!plans.length && isLoadingPlans}
        isVisible={!!selectedCareerProgramId}
      />
    </div>
  )
}
