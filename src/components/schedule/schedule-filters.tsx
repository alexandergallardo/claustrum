import { useEffect, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { User } from 'lucide-react'
import type { CatalogUniversity, CatalogCampus, CatalogCareerProgram, CatalogStudyPlan, AcademicTerm } from '@/lib/types'
import { FiltersPanel } from '@/components/filters/filters-panel'

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
  showAllDisabled?: boolean
  showAllDisabledTooltip?: string
  showOtherCampuses?: boolean
  onShowOtherCampusesChange?: (checked: boolean) => void
  canUseProfileDefaults?: boolean
  isUsingProfileDefaults?: boolean
  onUseProfileDefaults?: () => void
}

const truncateText = (text: string, maxLength = 35) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

const normalizeText = (text: string) => text.toUpperCase()

const FILTERS_PANEL_STORAGE_KEY = 'schedule-filters-panel-open'

function getInitialFiltersPanelOpen(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(FILTERS_PANEL_STORAGE_KEY)
  return stored !== 'false'
}

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
  showCode = false,
}: {
  label: string
  value: string
  placeholder: string
  items: { id: number; code?: string; name: string }[]
  onChange: (val: string) => void
  isLoading: boolean
  isVisible: boolean
  showCode?: boolean
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
                  const fullText = showCode && item.code
                    ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
                    : normalizeText(item.name)
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
  showAllDisabled = false,
  showAllDisabledTooltip,
  showOtherCampuses,
  onShowOtherCampusesChange,
  canUseProfileDefaults = false,
  isUsingProfileDefaults = false,
  onUseProfileDefaults,
}: ScheduleFiltersProps) {
  const [isFiltersVisible, setIsFiltersVisible] = useState(getInitialFiltersPanelOpen)
  const hasUniversities = universities.length > 0

  useEffect(() => {
    localStorage.setItem(FILTERS_PANEL_STORAGE_KEY, isFiltersVisible.toString())
  }, [isFiltersVisible])

  if (!hasUniversities && isLoadingUniversities) {
    return (
      <Card className="sticky top-[calc(var(--header-height)+0.75rem)] z-30 border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-4">
            <FilterSkeleton />
            <FilterSkeleton />
            <FilterSkeleton />
            <FilterSkeleton />
            <FilterSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const showSwitches = !!selectedTermId
  const isShowAllDisabled = !!showAllDisabled

  const showAllControl = (
    <div className="flex items-center space-x-2 pb-2">
      <Switch
        id="showAll"
        checked={showAll ?? true}
        onCheckedChange={onShowAllChange}
        disabled={isShowAllDisabled}
      />
      <Label htmlFor="showAll">Mostrar todos los cursos</Label>
    </div>
  )

  return (
    <FiltersPanel
      isExpanded={isFiltersVisible}
      onExpandedChange={setIsFiltersVisible}
      headerActions={
        canUseProfileDefaults && onUseProfileDefaults ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onUseProfileDefaults}
            disabled={isUsingProfileDefaults}
          >
            <User className="h-4 w-4" />
            {isUsingProfileDefaults ? 'Perfil activo' : 'Usar mi perfil'}
          </Button>
        ) : null
      }
    >
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
        showCode={true}
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
          isShowAllDisabled && showAllDisabledTooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    {showAllControl}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{showAllDisabledTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            showAllControl
          )
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
    </FiltersPanel>
  )
}
