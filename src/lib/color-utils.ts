interface ColorClasses {
  bg: string
  hover: string
  border: string
  text: string
}

export function getColorClasses(color: string): ColorClasses {
  const colorMap: Record<string, ColorClasses> = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-950',
      hover: 'hover:bg-blue-200 dark:hover:bg-blue-900',
      border: 'border-blue-300 dark:border-blue-700',
      text: 'text-blue-900 dark:text-blue-100',
    },
    emerald: {
      bg: 'bg-emerald-100 dark:bg-emerald-950',
      hover: 'hover:bg-emerald-200 dark:hover:bg-emerald-900',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-900 dark:text-emerald-100',
    },
    yellow: {
      bg: 'bg-yellow-100 dark:bg-yellow-950',
      hover: 'hover:bg-yellow-200 dark:hover:bg-yellow-900',
      border: 'border-yellow-300 dark:border-yellow-700',
      text: 'text-yellow-900 dark:text-yellow-100',
    },
    red: {
      bg: 'bg-red-100 dark:bg-red-950',
      hover: 'hover:bg-red-200 dark:hover:bg-red-900',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-900 dark:text-red-100',
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-950',
      hover: 'hover:bg-orange-200 dark:hover:bg-orange-900',
      border: 'border-orange-300 dark:border-orange-700',
      text: 'text-orange-900 dark:text-orange-100',
    },
    fuchsia: {
      bg: 'bg-fuchsia-100 dark:bg-fuchsia-950',
      hover: 'hover:bg-fuchsia-200 dark:hover:bg-fuchsia-900',
      border: 'border-fuchsia-300 dark:border-fuchsia-700',
      text: 'text-fuchsia-900 dark:text-fuchsia-100',
    },
    violet: {
      bg: 'bg-violet-100 dark:bg-violet-950',
      hover: 'hover:bg-violet-200 dark:hover:bg-violet-900',
      border: 'border-violet-300 dark:border-violet-700',
      text: 'text-violet-900 dark:text-violet-100',
    },
    slate: {
      bg: 'bg-slate-100 dark:bg-slate-900',
      hover: 'hover:bg-slate-200 dark:hover:bg-slate-800',
      border: 'border-slate-300 dark:border-slate-700',
      text: 'text-slate-900 dark:text-slate-100',
    },
  }

  return colorMap[color] || colorMap.blue
}
