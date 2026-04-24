import { useEffect, useRef, useState } from 'react'
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
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
}

const normalizeText = (text: string) => text.toUpperCase()

const FILTERS_PANEL_STORAGE_KEY = 'schedule-filters-panel-open'

function getInitialFiltersPanelOpen(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(FILTERS_PANEL_STORAGE_KEY)
  return stored !== 'false'
}

function FilterSkeleton() {
  return <Skeleton className="h-8 w-full sm:w-[160px]" />
}

function FilterCombobox({
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
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  if (!isVisible) return null

  const hasData = items.length > 0
  const showSkeleton = isLoading && !hasData
  const selectedItem = items.find((item) => item.id.toString() === value) ?? null
  const selectedText = selectedItem
    ? (showCode && selectedItem.code
      ? `${normalizeText(selectedItem.code)} - ${normalizeText(selectedItem.name)}`
      : normalizeText(selectedItem.name))
    : null

  return (
    <div className={`min-w-0 ${showSkeleton ? 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200' : ''}`}>
      {showSkeleton ? (
        <FilterSkeleton />
      ) : (
        <Combobox
          items={items}
          value={selectedItem}
          onValueChange={(item) => onChange(item ? String(item.id) : '')}
          itemToStringValue={(item) =>
            showCode && item.code
              ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
              : normalizeText(item.name)
          }
        >
          <ComboboxTrigger
            ref={triggerRef}
            render={<Button variant="outline" className="w-full min-w-0 justify-between font-normal h-8 text-xs sm:min-w-[160px] sm:max-w-[280px]" />}
          >
            <span className={`block min-w-0 flex-1 truncate text-left ${!selectedText ? 'text-muted-foreground' : ''}`}>
              {selectedText ?? placeholder}
            </span>
          </ComboboxTrigger>
          <ComboboxContent
            anchor={triggerRef}
            className="w-[var(--anchor-width)] min-w-[var(--anchor-width)] max-w-[calc(var(--available-width)-1rem)]"
          >
            <ComboboxInput showTrigger={false} placeholder={`Buscar ${label.toLowerCase()}`} />
            <ComboboxEmpty>No se encontraron resultados.</ComboboxEmpty>
            <ComboboxList className="max-h-56 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(item) => (
                <ComboboxItem key={item.id} value={item}>
                  <span className="block w-full min-w-0 truncate">
                    {showCode && item.code
                      ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
                      : normalizeText(item.name)}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </div>
  )
}

function FilterSelect({
  value,
  placeholder,
  items,
  onChange,
  isLoading,
  isVisible,
  showCode = false,
}: {
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
    <div className={`min-w-0 ${showSkeleton ? 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200' : ''}`}>
      {showSkeleton ? (
        <FilterSkeleton />
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="w-full min-w-0 h-8 text-xs sm:min-w-[160px] sm:max-w-[280px]">
            <SelectValue placeholder={placeholder} className="block min-w-0 max-w-full truncate text-left" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]" position="popper" align="start" sideOffset={4}>
            <SelectGroup>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id.toString()}>
                  <span className="block w-full min-w-0 truncate">
                    {showCode && item.code
                      ? `${normalizeText(item.code)} - ${normalizeText(item.name)}`
                      : normalizeText(item.name)}
                  </span>
                </SelectItem>
              ))}
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
}: ScheduleFiltersProps) {
  const [isFiltersVisible, setIsFiltersVisible] = useState(getInitialFiltersPanelOpen)
  const hasUniversities = universities.length > 0
  const shouldShowUniversityFilter = universities.length > 1
  const canSelectCampus = shouldShowUniversityFilter ? !!selectedUniversityId : hasUniversities

  useEffect(() => {
    localStorage.setItem(FILTERS_PANEL_STORAGE_KEY, isFiltersVisible.toString())
  }, [isFiltersVisible])

  if (!hasUniversities && isLoadingUniversities) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 bg-muted/30 rounded-lg px-3 py-2">
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
        <FilterSkeleton />
      </div>
    )
  }

  const showSwitches = !!selectedTermId
  const isShowAllDisabled = !!showAllDisabled

  const showAllControl = (
    <div className="flex items-center gap-2">
      <Switch
        id="showAll"
        checked={showAll ?? true}
        onCheckedChange={onShowAllChange}
        disabled={isShowAllDisabled}
      />
      <Label htmlFor="showAll" className="text-xs font-normal cursor-pointer">Todos los cursos</Label>
    </div>
  )

  return (
    <FiltersPanel
      isExpanded={isFiltersVisible}
      onExpandedChange={setIsFiltersVisible}
    >
      <FilterCombobox
        label="Universidad"
        value={selectedUniversityId?.toString() || ''}
        placeholder="Universidad"
        items={universities}
        onChange={(val) => onUniversityChange(val ? parseInt(val) : null)}
        isLoading={!hasUniversities && isLoadingUniversities}
        isVisible={shouldShowUniversityFilter}
      />

      <FilterSelect
        value={selectedCampusId?.toString() || ''}
        placeholder="Sede"
        items={campuses}
        onChange={(val) => onCampusChange(val ? parseInt(val) : null)}
        isLoading={!campuses.length && isLoadingCampuses}
        isVisible={canSelectCampus}
      />

      <FilterCombobox
        label="Carrera"
        value={selectedCareerId?.toString() || ''}
        placeholder="Carrera"
        items={careers}
        onChange={(val) => onCareerChange(val ? parseInt(val) : null)}
        isLoading={!careers.length && isLoadingCareers}
        isVisible={!!selectedCampusId}
        showCode={true}
      />

      <FilterCombobox
        label="Plan"
        value={selectedPlanId?.toString() || ''}
        placeholder="Plan de estudios"
        items={plans}
        onChange={(val) => onPlanChange(val ? parseInt(val) : null)}
        isLoading={!plans.length && isLoadingPlans}
        isVisible={!!selectedCareerId}
      />

      <FilterCombobox
        label="Período"
        value={selectedTermId?.toString() || ''}
        placeholder="Período académico"
        items={terms.map(t => ({ id: t.id, name: t.display_name }))}
        onChange={(val) => onTermChange(val ? parseInt(val) : null)}
        isLoading={!terms.length && isLoadingTerms}
        isVisible={!!selectedCampusId}
      />

      {showSwitches && (onShowAllChange !== undefined || onShowOtherCampusesChange !== undefined) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {onShowAllChange !== undefined && (
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

          {onShowOtherCampusesChange !== undefined && (
            <div className="flex items-center gap-2">
              <Switch
                id="otherCampuses"
                checked={showOtherCampuses ?? false}
                onCheckedChange={onShowOtherCampusesChange}
              />
              <Label htmlFor="otherCampuses" className="text-xs font-normal cursor-pointer">Otras sedes</Label>
            </div>
          )}
        </div>
      )}
    </FiltersPanel>
  )
}
