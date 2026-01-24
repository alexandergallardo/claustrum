import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function CalendarBodyHeader({
  date,
  onlyDay = false,
}: {
  date: Date
  onlyDay?: boolean
}) {
  const isToday = isSameDay(date, new Date())

  return (
    <div className="flex items-center justify-center gap-1 h-[33px] w-full sticky top-0 bg-background z-10 border-b">
      <span
        className={cn(
          'text-xs font-medium capitalize',
          isToday ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {format(date, 'EEE', { locale: es })}
      </span>
      {!onlyDay && (
        <span
          className={cn(
            'text-xs font-medium',
            isToday ? 'text-primary font-bold' : 'text-foreground'
          )}
        >
          {format(date, 'dd')}
        </span>
      )}
    </div>
  )
}
