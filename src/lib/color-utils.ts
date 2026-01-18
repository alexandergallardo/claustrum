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
    indigo: {
      bg: 'bg-indigo-100 dark:bg-indigo-950',
      hover: 'hover:bg-indigo-200 dark:hover:bg-indigo-900',
      border: 'border-indigo-300 dark:border-indigo-700',
      text: 'text-indigo-900 dark:text-indigo-100',
    },
    pink: {
      bg: 'bg-pink-100 dark:bg-pink-950',
      hover: 'hover:bg-pink-200 dark:hover:bg-pink-900',
      border: 'border-pink-300 dark:border-pink-700',
      text: 'text-pink-900 dark:text-pink-100',
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
    amber: {
      bg: 'bg-amber-100 dark:bg-amber-950',
      hover: 'hover:bg-amber-200 dark:hover:bg-amber-900',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-900 dark:text-amber-100',
    },
    emerald: {
      bg: 'bg-emerald-100 dark:bg-emerald-950',
      hover: 'hover:bg-emerald-200 dark:hover:bg-emerald-900',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-900 dark:text-emerald-100',
    },
  }

  return colorMap[color] || colorMap.blue
}
