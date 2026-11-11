import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'outline' | 'warning' | 'danger' | 'cyan' | 'lavender'
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default:
      'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
    accent:
      'bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] border border-[var(--color-accent)]/20',
    cyan:
      'bg-[var(--color-accent-secondary-subtle)] text-[var(--color-accent-secondary-text)] border border-[var(--color-accent-secondary)]/20',
    lavender:
      'bg-[var(--color-lavender-surface)] text-[var(--color-lavender-text)] border border-[var(--color-lavender)]/20',
    outline:
      'bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)]',
    warning:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    danger:
      'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tracking-wide',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
