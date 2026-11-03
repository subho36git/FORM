import React from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { theme, setTheme } = useTheme()

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { value: 'system', label: 'Auto', icon: <Monitor className="w-3.5 h-3.5" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
  ]

  return (
    <div
      role="group"
      aria-label="Theme selector"
      className={cn(
        'inline-flex items-center p-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
              isActive
                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
            title={`Switch to ${opt.label} mode`}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
