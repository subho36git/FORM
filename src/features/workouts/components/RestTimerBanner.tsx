import React, { useEffect, useRef } from 'react'
import { Play, Pause, X, Plus, Minus, Timer } from 'lucide-react'
import { useWorkout } from '../hooks/useWorkout'

export const RestTimerBanner: React.FC = () => {
  const {
    restTimerRemaining,
    isRestTimerActive,
    pauseRestTimer,
    resumeRestTimer,
    stopRestTimer,
    adjustRestTimer,
  } = useWorkout()

  const audioPlayedRef = useRef(false)

  // Play a soft double-beep using Web Audio API when countdown reaches 0
  useEffect(() => {
    if (restTimerRemaining === 0 && !audioPlayedRef.current) {
      audioPlayedRef.current = true
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
          gain.gain.setValueAtTime(0.1, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.3)
        }
      } catch {
        // AudioContext disabled or blocked by autoplay policy
      }
    } else if (restTimerRemaining > 0) {
      audioPlayedRef.current = false
    }
  }, [restTimerRemaining])

  if (restTimerRemaining <= 0) return null

  const minutes = Math.floor(restTimerRemaining / 60)
  const seconds = restTimerRemaining % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--color-surface)] border-2 border-[var(--color-accent)] shadow-2xl">
        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
          <Timer className="w-4 h-4 animate-pulse" />
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Rest Interval
          </span>
          <span className="text-lg font-black tracking-tight text-[var(--color-text-primary)] font-mono">
            {formatted}
          </span>
        </div>

        <div className="flex items-center gap-1 pl-2 border-l border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => adjustRestTimer(-15)}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] text-xs flex items-center gap-0.5"
            title="Minus 15s"
          >
            <Minus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">15</span>
          </button>

          <button
            type="button"
            onClick={() => adjustRestTimer(30)}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] text-xs flex items-center gap-0.5"
            title="Plus 30s"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">30</span>
          </button>

          {isRestTimerActive ? (
            <button
              type="button"
              onClick={pauseRestTimer}
              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
              title="Pause Timer"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={resumeRestTimer}
              className="p-1.5 rounded-lg text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors"
              title="Resume Timer"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={stopRestTimer}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Dismiss Timer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
