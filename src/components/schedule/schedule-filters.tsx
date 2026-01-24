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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { CatalogUniversity, CatalogCampus, CatalogCareerProgram, CatalogStudyPlan, AcademicTerm } from '@/lib/types'

interface ScheduleFiltersProps {
  universities: CatalogUniversity[]
  campuses: CatalogCampus[]
  careers: CatalogCareerProgram[]
  plans: CatalogStudyPlan[]
  terms: AcademicTerm[]
  selectedUniversityId: number | null
  selectedCampusId: number | null
  selectedCareerId: number | null
  selectedPlanId: number | null
  selectedTermId: number | null
  onUniversityChange: (id: number | null) => void
  onCampusChange: (id: number | null) => void
  onCareerChange: (id: number | null) => void
  onPlanChange: (id: number | null) => void
  onTermChange: (id: number | null) => void
  isLoadingUniversities: boolean
  isLoadingCampuses?: boolean
  isLoadingCareers: boolean
  isLoadingPlans: boolean
  isLoadingTerms: boolean
  showAll?: boolean
  onShowAllChange?: (checked: boolean) => void
  showOtherCampuses?: boolean
  onShowOtherCampusesChange?: (checked: boolean) => void
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

export function ScheduleFilters({
  universities,
  campuses,
  careers,
  plans,
  terms,
  selectedUniversityId,
  selectedCampusId,
  selectedCareerId,
  selectedPlanId,
  selectedTermId,
  onUniversityChange,
  onCampusChange,
  onCareerChange,
  onPlanChange,
  onTermChange,
  isLoadingUniversities,
  isLoadingCampuses = false,
  isLoadingCareers,
  isLoadingPlans,
  isLoadingTerms,
  showAll,
  onShowAllChange,
  showOtherCampuses,
  onShowOtherCampusesChange,
}: ScheduleFiltersProps) {
  const hasUniversities = universities.length > 0

  if (!hasUniversities && isLoadingUniversities) {
    return (
      <div className="flex flex-wrap items-end gap-4">
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
      </div>
    )
  }

  const showSwitches = !!selectedTermId

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
        value={selectedCareerId?.toString() || ''}
        placeholder="Selecciona una carrera"
        items={careers}
        onChange={(val) => onCareerChange(val ? parseInt(val) : null)}
        isLoading={!careers.length && isLoadingCareers}
        isVisible={!!selectedCampusId}
      />

      <FilterSelect
        label="Plan de estudios"
        value={selectedPlanId?.toString() || ''}
        placeholder="Selecciona un plan"
        items={plans}
        onChange={(val) => onPlanChange(val ? parseInt(val) : null)}
        isLoading={!plans.length && isLoadingPlans}
        isVisible={!!selectedCareerId}
      />

      <FilterSelect
        label="Período académico"
        value={selectedTermId?.toString() || ''}
        placeholder="Selecciona un período"
        items={terms.map(t => ({ id: t.id, name: t.display_name }))}
        onChange={(val) => onTermChange(val ? parseInt(val) : null)}
        isLoading={!terms.length && isLoadingTerms}
        isVisible={!!selectedCampusId}
      />

      {showSwitches && onShowAllChange !== undefined && (
        <div className="flex items-center space-x-2 pb-2">
          <Switch
            id="showAll"
            checked={showAll ?? true}
            onCheckedChange={onShowAllChange}
          />
          <Label htmlFor="showAll">Mostrar todos los cursos</Label>
        </div>
      )}

      {showSwitches && onShowOtherCampusesChange !== undefined && (
        <div className="flex items-center space-x-2 pb-2">
          <Switch
            id="otherCampuses"
            checked={showOtherCampuses ?? false}
            onCheckedChange={onShowOtherCampusesChange}
          />
          <Label htmlFor="otherCampuses">Mostrar grupos de otras sedes</Label>
        </div>
      )}
    </div>
  )
}
