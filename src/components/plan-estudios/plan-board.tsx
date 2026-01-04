import { CurriculumGrid } from '@/components/curriculum-grid'
import type { StudyPlanDetail } from '@/lib/types'

interface PlanBoardProps {
  planDetail: StudyPlanDetail
}

export function PlanBoard({ planDetail }: PlanBoardProps) {
  return <CurriculumGrid planDetail={planDetail} />
}

