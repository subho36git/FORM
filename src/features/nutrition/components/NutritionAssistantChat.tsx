import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  CornerDownLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FormattedChatMessage } from './FormattedChatMessage'
import {
  nutritionAssistantService,
  type AssistantChatMessage,
} from '../services/nutritionAssistantService'
import { useNutrition } from '../context/NutritionContext'
import { useGoals } from '@/features/goals'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'

const INITIAL_MESSAGES: AssistantChatMessage[] = [
  {
    id: 'intro-welcome',
    role: 'assistant',
    content: `Hello! I'm your FORM Nutrition Assistant.

I can help you track and calibrate your nutrition via natural language:
• **Log meals**: *"For lunch I had 250g rice, 3 boiled eggs and 150g dal"*
• **Make corrections**: *"The ghee was 10g not 20g"* or *"Remove the banana"*
• **Check progress**: *"How much protein do I have left today?"*
• **Log bodyweight & goals**: *"My weight today is 78kg"* or *"Change calorie target to 2600"*

What would you like to log or calibrate today?`,
    timestamp: 'Just now',
  },
]

export const NutritionAssistantChat: React.FC = () => {
  const { selectedDate, dailyTotals, meals, refreshCurrentDay, refreshSaved } = useNutrition()
  const { goals, refreshWeightEntries } = useGoals()
  const { profile, refreshProfile } = useAuth()

  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(`form_chat_history_${selectedDate}`)
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES
    } catch {
      return INITIAL_MESSAGES
    }
  })

  const [isTyping, setIsTyping] = useState(false)
  const [input, setInput] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)

  const chatScrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isInitialMount = useRef(true)
  const msgIdRef = useRef(messages.length + 1)

  // Persist session messages
  useEffect(() => {
    try {
      sessionStorage.setItem(`form_chat_history_${selectedDate}`, JSON.stringify(messages))
    } catch (e) {
      console.warn('[NutritionAssistantChat] Could not persist session messages:', e)
    }
  }, [messages, selectedDate])

  // Format today's display date
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  // Auto-scroll inside chat container ONLY when new message is added, never on initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const container = chatScrollContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, isTyping])

  // Build context payload for Edge Function
  const buildContext = () => ({
    localDate: selectedDate,
    userProfile: {
      goal: profile?.fitness_goal || undefined,
      currentWeightKg: goals.currentWeightKg,
      goalWeightKg: goals.goalWeightKg,
      dailyCalorieTarget: goals.dailyCalories,
      proteinTargetG: goals.proteinG,
      carbsTargetG: goals.carbsG,
      fatTargetG: goals.fatG,
    },
    todaySummary: {
      calories: dailyTotals.calories,
      protein_g: dailyTotals.protein_g,
      carbs_g: dailyTotals.carbs_g,
      fat_g: dailyTotals.fat_g,
      fiber_g: dailyTotals.fiber_g,
      meals: meals.map((m) => ({
        category: m.category,
        items: m.items.map((i) => ({
          id: i.id,
          food_name: i.food_name,
          quantity: i.quantity,
          unit: i.unit,
          calories: i.calories,
          protein_g: i.protein_g,
          carbs_g: i.carbs_g,
          fat_g: i.fat_g,
          fiber_g: i.fiber_g,
          is_estimated: i.is_estimated,
        })),
      })),
    },
  })

  const sendMessageToAssistant = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return

    setErrorMessage(null)
    setLastUserMessage(textToSend)

    msgIdRef.current += 1
    const userMsg: AssistantChatMessage = {
      id: `user-${msgIdRef.current}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(new Date()),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    // Build history for backend context (last 8 messages)
    const historyPayload = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const result = await nutritionAssistantService.sendMessage({
        message: textToSend.trim(),
        history: historyPayload,
        context: buildContext(),
      })

      // If database actions were executed, synchronize application state immediately
      if (result.actionsExecuted && result.actionsExecuted.length > 0) {
        const hasDayActions = result.actionsExecuted.some(
          (a) => ['log_meal', 'update_item', 'delete_item', 'finalize_day'].includes(a.name) && a.success
        )
        if (hasDayActions) {
          await refreshCurrentDay()
        }

        const hasRecipeActions = result.actionsExecuted.some(
          (a) => ['save_recipe'].includes(a.name) && a.success
        )
        if (hasRecipeActions) {
          await refreshSaved()
        }

        const hasProfileActions = result.actionsExecuted.some(
          (a) => ['set_weight', 'set_targets'].includes(a.name) && a.success
        )
        if (hasProfileActions) {
          await refreshProfile()
          await refreshWeightEntries()
        }
      }

      msgIdRef.current += 1
      const assistantMsg: AssistantChatMessage = {
        id: `assistant-${msgIdRef.current}`,
        role: 'assistant',
        content: result.reply || "I've processed your request.",
        timestamp: new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true,
        }).format(new Date()),
        actionsExecuted: result.actionsExecuted,
        providerUsed: result.providerUsed,
        failoverOccurred: result.failoverOccurred,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach nutrition assistant'
      setErrorMessage(msg)

      msgIdRef.current += 1
      const errorMsg: AssistantChatMessage = {
        id: `assistant-err-${msgIdRef.current}`,
        role: 'assistant',
        content: `⚠️ **Unable to complete request**\n\n${msg}\n\nPlease try again or use the retry button below.`,
        timestamp: 'Just now',
        isError: true,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSend = async () => {
    const text = input
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    await sendMessageToAssistant(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleExecutePrompt = async (promptText: string) => {
    setInput('')
    await sendMessageToAssistant(promptText)
  }

  const handleRetryLast = async () => {
    if (lastUserMessage) {
      await sendMessageToAssistant(lastUserMessage)
    }
  }

  const clearChat = () => {
    setMessages([])
    sessionStorage.removeItem(`form_chat_history_${selectedDate}`)
  }

  const resetChat = () => {
    setMessages(INITIAL_MESSAGES)
    sessionStorage.setItem(`form_chat_history_${selectedDate}`, JSON.stringify(INITIAL_MESSAGES))
  }

  const suggestedPrompts = [
    'For lunch I had 250g rice, 3 boiled eggs and 150g dal',
    'How much protein have I had today?',
    'My weight today is 78kg',
    'Change my calorie target to 2600',
  ]

  return (
    <div className="flex flex-col h-[700px] md:h-[780px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
      {/* 1. Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] border border-[var(--color-accent)]/20 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight">
                AI Nutrition Assistant
              </h2>
              <Badge variant="accent" className="text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Gemini Active
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {todayFormatted} • Log Date: {selectedDate}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetChat}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-xs flex items-center gap-1 cursor-pointer"
            title="Reset to default guide"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Reset</span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors text-xs cursor-pointer"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Feed */}
      <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.length === 0 ? (
          /* Empty state with suggested prompts */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                AI Nutrition Assistant
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Log meals via natural language, make portion corrections, and check your remaining macros against your active Goals Engine targets.
              </p>
            </div>

            <div className="w-full pt-2 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block">
                Suggested Prompts
              </span>
              <div className="grid grid-cols-1 gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleExecutePrompt(prompt)}
                    className="p-3 text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent)]/40 transition-all text-xs font-medium text-[var(--color-text-primary)] flex items-center justify-between group cursor-pointer"
                  >
                    <span>&ldquo;{prompt}&rdquo;</span>
                    <CornerDownLeft className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Messages list */
          messages.map((message) => {
            const isUser = message.role === 'user'

            return (
              <div
                key={message.id}
                className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] border border-[var(--color-accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    'max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 text-xs transition-all',
                    isUser
                      ? 'bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-tr-xs'
                      : message.isError
                        ? 'bg-red-500/10 border border-red-500/20 text-[var(--color-text-primary)] rounded-tl-xs'
                        : 'bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-tl-xs'
                  )}
                >
                  {/* Sender & Timestamp Header */}
                  <div className="flex items-center justify-between gap-3 mb-2 text-[10.5px] text-[var(--color-text-muted)]">
                    <span className="font-semibold text-[var(--color-text-secondary)]">
                      {isUser ? 'You' : 'Assistant'}
                    </span>
                    <span>{message.timestamp}</span>
                  </div>

                  {/* Message Content with Markdown Formatting */}
                  <FormattedChatMessage content={message.content} />

                  {/* Executed Action Pills */}
                  {((message.actionsExecuted && message.actionsExecuted.length > 0) || message.failoverOccurred) && (
                    <div className="mt-3 pt-2.5 border-t border-[var(--color-border)]/60 flex flex-wrap gap-1.5 items-center">
                      {message.failoverOccurred && (
                        <span className="text-[10px] font-semibold py-0.5 px-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <span>⚡ Groq backup failover</span>
                        </span>
                      )}
                      {message.actionsExecuted?.map((act, actIdx) => (
                        <span
                          key={actIdx}
                          className={cn(
                            'text-[10px] font-semibold py-0.5 px-2 rounded-md flex items-center gap-1',
                            act.success
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 border border-red-500/20 text-red-500'
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Action: {act.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-xs bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">
                AI Assistant is analyzing nutrition...
              </span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Retry Button if last message errored */}
        {errorMessage && !isTyping && lastUserMessage && (
          <div className="flex justify-start pl-11">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleRetryLast}
              className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
            >
              Retry Last Message
            </Button>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips (when conversation has messages) */}
      {messages.length > 0 && !isTyping && (
        <div className="px-4 py-2 bg-[var(--color-surface)] border-t border-[var(--color-border)]/60 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider shrink-0">
            Quick Log:
          </span>
          {suggestedPrompts.slice(0, 3).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleExecutePrompt(p)}
              className="px-2.5 py-1 rounded-full text-[11px] bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/50 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* 3. Fixed Bottom Input Bar */}
      <div className="p-3.5 md:p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="relative flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accent)] transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your meal (e.g. 'For lunch I had 250g rice, 3 boiled eggs and dal')..."
            disabled={isTyping}
            className="w-full py-3 pl-3.5 pr-12 text-xs md:text-sm bg-transparent border-0 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none resize-none max-h-32 leading-relaxed"
          />

          <div className="absolute right-2 flex items-center">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!input.trim() || isTyping}
              onClick={handleSend}
              className="h-8 w-8 !p-0 rounded-lg shrink-0 cursor-pointer"
              title="Send message (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 text-[10.5px] text-[var(--color-text-muted)] px-1">
          <span>Press Enter to send, Shift + Enter for new line</span>
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-[var(--color-accent-text)]" />
            Estimates are calibrated against dynamic targets
          </span>
        </div>
      </div>
    </div>
  )
}
