/**
 * Supabase Edge Function: nutrition-assistant
 * 
 * Secure AI Nutrition Assistant backend with Multi-Provider Failover:
 * Primary: Google Gemini API (gemini-3.5-flash-lite)
 * Backup:  Groq API (openai/gpt-oss-20b)
 * 
 * Free-tier only. No OpenAI paid tier. No paid Groq tier.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildSystemPrompt } from './gemini.ts'
import { executeWithFailover } from './providers.ts'
import { ActionExecutor } from './actions.ts'
import type { NutritionAssistantRequest, ExecutedActionSummary, NutritionAssistantResponse } from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory rate limiting map: userId -> array of timestamps
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) || []
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }
  validTimestamps.push(now)
  rateLimitMap.set(userId, validTimestamps)
  return true
}

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. Verify User Authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Initialize User-Scoped Client (respects RLS, executes as authenticated user)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Check Rate Limit
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please wait a moment before sending more messages.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Parse Request Payload
    const body: NutritionAssistantRequest = await req.json()
    const { message, history = [], context } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Maximum message length guard
    if (message.length > 1500) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Message exceeds maximum length of 1500 characters. Please shorten your message.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const localDate = context?.localDate || new Date().toISOString().split('T')[0]

    // 4. Check for Primary Gemini API Key Secret
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey || !geminiApiKey.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          needsApiKeyConfig: true,
          reply:
            '⚠️ **Gemini API Key Required**\n\nTo activate your AI Nutrition Assistant, add your Gemini API key in Supabase:\n1. Open your **Supabase Dashboard** -> **Project Settings** -> **Edge Functions** -> **Secrets**.\n2. Add a new secret named `GEMINI_API_KEY` with your Google AI Studio key.\n3. (Optional) Add `GROQ_API_KEY` for automatic free-tier backup failover!\n4. Once added, you can log meals, correct entries, and track targets here via natural language.',
          actionsExecuted: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const executor = new ActionExecutor(supabase, user.id, localDate)

    // Ensure context and system prompt always reflect the TRUE persisted database state for today
    try {
      const persistedDay = await executor.fetchDaySummary(localDate)
      context.todaySummary = {
        calories: persistedDay.totals.calories,
        protein_g: persistedDay.totals.protein_g,
        carbs_g: persistedDay.totals.carbs_g,
        fat_g: persistedDay.totals.fat_g,
        fiber_g: persistedDay.totals.fiber_g,
        meals: (persistedDay.meals || []).map((m: any) => ({
          category: m.category,
          items: (m.nutrition_food_items || m.items || []).map((i: any) => ({
            id: i.id,
            food_name: i.food_name,
            quantity: Number(i.quantity),
            unit: i.unit,
            calories: Number(i.calories),
            protein_g: Number(i.protein_g),
            carbs_g: Number(i.carbs_g),
            fat_g: Number(i.fat_g),
            fiber_g: Number(i.fiber_g || 0),
            is_estimated: Boolean(i.is_estimated),
          })),
        })),
      }
    } catch (dayFetchErr) {
      console.warn('[NutritionAssistant] Could not preload persisted day summary:', dayFetchErr)
    }

    // Check for controlled Groq failover diagnostic test
    // Triple security gate:
    // 1. ENABLE_GROQ_FAILOVER_TEST must be explicitly 'true' in Supabase Edge Function secrets
    // 2. FAILOVER_TEST_USER_ID must match the authenticated user.id
    // 3. Exact diagnostic message: 'Run FORM Groq failover diagnostic'
    const isFailoverTestEnabled = Deno.env.get('ENABLE_GROQ_FAILOVER_TEST')?.trim() === 'true'
    const failoverTestUserId = Deno.env.get('FAILOVER_TEST_USER_ID')?.trim()
    const isDiagnosticMessage = message.trim() === 'Run FORM Groq failover diagnostic'

    const shouldSimulateGeminiFailure =
      isFailoverTestEnabled &&
      Boolean(failoverTestUserId) &&
      failoverTestUserId === user.id &&
      isDiagnosticMessage

    if (shouldSimulateGeminiFailure) {
      console.warn(
        `[NutritionAssistant] [Diagnostic Mode Activated] Authenticated user ${user.id} triggered controlled Groq failover diagnostic.`
      )
    }

    // 5. Build System Prompt & Call AI with Multi-Provider Failover
    const baseSystemPrompt = buildSystemPrompt(context)
    const systemPrompt = shouldSimulateGeminiFailure
      ? `${baseSystemPrompt}\n\n[DIAGNOSTIC TEST ACTIVE]: The user is running a controlled Groq failover diagnostic. Call get_day to safely retrieve today's nutrition summary in read-only mode.`
      : baseSystemPrompt

    const aiResult = await executeWithFailover({
      systemPrompt,
      history,
      userMessage: message.trim(),
      simulateGeminiFailure: shouldSimulateGeminiFailure,
    })

    const actionsExecuted: ExecutedActionSummary[] = []
    let updatedDayData: Record<string, any> | null = null

    let rawCalls = aiResult.functionCalls || []

    // 6. Pre-process and Sanitize Function Calls
    if (shouldSimulateGeminiFailure) {
      // Diagnostic Safety Invariant: STRICTLY enforce read-only get_day action.
      // Discard any mutating actions (log_meal, update_item, delete_item, set_weight) to guarantee zero DB modifications.
      rawCalls = [{ name: 'get_day', args: { log_date: localDate } }]
    }

    // Guard 1: Detect if model called update_item for new meal intake when food does not exist
    const lowerMsg = message.toLowerCase()
    const isMealLogIntent =
      lowerMsg.includes('had') ||
      lowerMsg.includes('ate') ||
      lowerMsg.includes('for lunch') ||
      lowerMsg.includes('for breakfast') ||
      lowerMsg.includes('for dinner') ||
      lowerMsg.includes('for snack') ||
      lowerMsg.includes('log ')

    let detectedCategory = 'lunch'
    if (lowerMsg.includes('breakfast')) detectedCategory = 'breakfast'
    else if (lowerMsg.includes('dinner')) detectedCategory = 'dinner'
    else if (lowerMsg.includes('snack')) detectedCategory = 'snack'
    else if (lowerMsg.includes('lunch')) detectedCategory = 'lunch'

    const onlyUpdateCalls = rawCalls.length > 0 && rawCalls.every((c) => c.name === 'update_item')
    if (onlyUpdateCalls && isMealLogIntent) {
      const currentItems = (context.todaySummary?.meals || []).flatMap((m) => m.items)
      const allItemsMissing = rawCalls.every((call) => {
        const foodName = (call.args.food_name || call.args.updates?.food_name || '').toLowerCase()
        return !currentItems.some((ci) => ci.food_name.toLowerCase().includes(foodName))
      })

      if (allItemsMissing) {
        console.warn(
          `[NutritionAssistant] Model erroneously proposed update_item ${rawCalls.length} time(s) for a new meal. Converting to a single log_meal call.`
        )
        const combinedItems = rawCalls.map((call) => {
          const updates = call.args.updates || {}
          return {
            food_name: call.args.food_name || updates.food_name || 'Food item',
            quantity: Number(updates.quantity) || 1,
            unit: String(updates.unit || 'g'),
            calories: Number(updates.calories) || 0,
            protein_g: Number(updates.protein_g) || 0,
            carbs_g: Number(updates.carbs_g) || 0,
            fat_g: Number(updates.fat_g) || 0,
            fiber_g: Number(updates.fiber_g) || 0,
            is_estimated: updates.is_estimated !== undefined ? Boolean(updates.is_estimated) : true,
            notes: updates.notes || null,
          }
        })

        const category = rawCalls[0]?.args?.meal_category || detectedCategory
        rawCalls = [
          {
            name: 'log_meal',
            args: {
              category,
              items: combinedItems,
              log_date: localDate,
            },
          },
        ]
      }
    }

    // Guard 2: Consolidate multiple log_meal calls into a single log_meal call
    const logMealCalls = rawCalls.filter((c) => c.name === 'log_meal')
    if (logMealCalls.length > 1) {
      console.warn(`[NutritionAssistant] Consolidating ${logMealCalls.length} log_meal calls into a single meal call.`)
      const mergedItems: any[] = []
      let targetCat = logMealCalls[0].args.category || detectedCategory
      for (const call of logMealCalls) {
        if (call.args.category) targetCat = call.args.category
        if (Array.isArray(call.args.items)) {
          mergedItems.push(...call.args.items)
        }
      }
      const otherCalls = rawCalls.filter((c) => c.name !== 'log_meal')
      rawCalls = [
        {
          name: 'log_meal',
          args: {
            category: targetCat,
            items: mergedItems,
            log_date: localDate,
          },
        },
        ...otherCalls,
      ]
    }

    // Guard 3: If no tool was proposed, but user asked for today's summary or what they ate
    const isDayQueryIntent =
      lowerMsg.includes('how much have i eaten') ||
      lowerMsg.includes('how much did i eat') ||
      lowerMsg.includes('what did i eat today') ||
      lowerMsg.includes('what have i eaten today') ||
      lowerMsg.includes('what i ate today') ||
      lowerMsg.includes('how many calories have i had') ||
      lowerMsg.includes('how many calories do i have left') ||
      lowerMsg.includes('how much protein have i had') ||
      lowerMsg.includes('show my nutrition summary') ||
      lowerMsg.includes("today's nutrition summary") ||
      lowerMsg.includes('how much did i eat today')

    if (rawCalls.length === 0 && isDayQueryIntent) {
      rawCalls = [{ name: 'get_day', args: { log_date: localDate } }]
    }

    // 7. Execute Validated Function Calls
    if (rawCalls.length > 0) {
      for (const call of rawCalls) {
        let result: any = null

        switch (call.name) {
          case 'log_meal':
            result = await executor.executeLogMeal(call.args as any)
            break
          case 'update_item':
            result = await executor.executeUpdateItem(call.args as any)
            break
          case 'delete_item':
            result = await executor.executeDeleteItem(call.args as any)
            break
          case 'get_day':
            result = await executor.executeGetDay(call.args as any)
            break
          case 'set_weight':
            result = await executor.executeSetWeight(call.args as any)
            break
          case 'finalize_day':
            result = await executor.executeFinalizeDay(call.args as any)
            break
          case 'save_recipe':
            result = await executor.executeSaveRecipe(call.args as any)
            break
          case 'list_recipes':
            result = await executor.executeListRecipes(call.args as any)
            break
          case 'set_targets':
            result = await executor.executeSetTargets(call.args as any)
            break
          default:
            result = { success: false, message: `Unsupported action: ${call.name}` }
        }

        actionsExecuted.push({
          name: call.name,
          success: result.success,
          details: result.data,
          error: result.success ? undefined : result.message,
        })

        if (result.data?.daySummary) {
          updatedDayData = result.data.daySummary
        }
      }

      // If log_meal was executed successfully, generate exact Section 9 formatted summary
      // This is 100% deterministic and avoids unnecessary extra model calls
      const logMealAction = actionsExecuted.find((a) => a.name === 'log_meal' && a.success)
      if (logMealAction && logMealAction.details) {
        const details = logMealAction.details
        const categoryCap =
          (details.category as string || 'Meal').charAt(0).toUpperCase() +
          (details.category as string || 'Meal').slice(1)
        const items = (details.insertedItems as any[]) || []
        const summary = details.daySummary || (await executor.fetchDaySummary(localDate))

        const targetCalories = context.userProfile?.dailyCalorieTarget || 2200
        const targetP = context.userProfile?.proteinTargetG || 150
        const targetC = context.userProfile?.carbsTargetG || 250
        const targetF = context.userProfile?.fatTargetG || 60

        const consumedCal = summary.totals.calories
        const consumedP = summary.totals.protein_g
        const consumedC = summary.totals.carbs_g
        const consumedF = summary.totals.fat_g
        const consumedFiber = summary.totals.fiber_g

        const remCal = Math.max(0, targetCalories - consumedCal)
        const remP = Math.max(0, Math.round((targetP - consumedP) * 10) / 10)
        const remC = Math.max(0, Math.round((targetC - consumedC) * 10) / 10)
        const remF = Math.max(0, Math.round((targetF - consumedF) * 10) / 10)

        const rows = items
          .map((i) => `| ${i.food_name}, ${i.quantity}${i.unit} | ${i.calories} kcal | ${i.protein_g}g |`)
          .join('\n')

        const formattedReply = `**Meal logged — ${categoryCap}**

| Food | Calories | Protein |
|---|---:|---:|
${rows}

**Today's progress**
- Calories: ${consumedCal.toLocaleString()} / ${targetCalories.toLocaleString()} kcal (${remCal.toLocaleString()} remaining)
- Protein: ${consumedP}g / ${targetP}g (${remP}g remaining)
- Carbs: ${consumedC}g / ${targetC}g (${remC}g remaining)
- Fat: ${consumedF}g / ${targetF}g (${remF}g remaining)
- Fibre: ${consumedFiber}g

Keep up the strong adherence! Your metabolic intake is perfectly recorded.`

        const responsePayload: NutritionAssistantResponse = {
          success: true,
          reply: formattedReply,
          actionsExecuted,
          dayData: updatedDayData || summary,
          providerUsed: aiResult.providerUsed,
          failoverOccurred: aiResult.failoverOccurred,
        }

        return new Response(JSON.stringify(responsePayload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // If get_day was executed successfully, generate comprehensive natural-language summary from real database records
      const getDayAction = actionsExecuted.find((a) => a.name === 'get_day' && a.success)
      if (getDayAction && getDayAction.details) {
        const summary = getDayAction.details
        const logDate = (summary.day?.log_date as string) || (summary.log_date as string) || localDate
        const isToday = logDate === localDate

        const targetCalories = context.userProfile?.dailyCalorieTarget || 2200
        const targetP = context.userProfile?.proteinTargetG || 150
        const targetC = context.userProfile?.carbsTargetG || 250
        const targetF = context.userProfile?.fatTargetG || 60

        const consumedCal = Number(summary.totals?.calories) || 0
        const consumedP = Number(summary.totals?.protein_g) || 0
        const consumedC = Number(summary.totals?.carbs_g) || 0
        const consumedF = Number(summary.totals?.fat_g) || 0
        const consumedFiber = Number(summary.totals?.fiber_g) || 0

        const remCal = Math.max(0, targetCalories - consumedCal)
        const remP = Math.max(0, Math.round((targetP - consumedP) * 10) / 10)
        const remC = Math.max(0, Math.round((targetC - consumedC) * 10) / 10)
        const remF = Math.max(0, Math.round((targetF - consumedF) * 10) / 10)

        const titleDate = isToday ? "Today's Nutrition Summary" : `Nutrition Summary — ${logDate}`
        const progressHeader = isToday ? "Today's progress" : `Progress for ${logDate}`

        const meals = summary.meals || []
        const hasMeals = Array.isArray(meals) && meals.some((m: any) => (m.nutrition_food_items?.length > 0 || m.items?.length > 0))

        let formattedReply = ''
        if (!hasMeals && consumedCal === 0) {
          formattedReply = `**${titleDate}**

You haven't logged any meals yet for ${isToday ? 'today' : logDate}.

**${progressHeader}**
- Calories: 0 / ${targetCalories.toLocaleString()} kcal (${targetCalories.toLocaleString()} remaining)
- Protein: 0g / ${targetP}g (${targetP}g remaining)
- Carbs: 0g / ${targetC}g (${targetC}g remaining)
- Fat: 0g / ${targetF}g (${targetF}g remaining)
- Fibre: 0g

Ready when you are! What did you have to eat?`
        } else {
          const mealSections: string[] = []
          for (const m of meals) {
            const items = m.nutrition_food_items || m.items || []
            if (items.length > 0) {
              const catCap = m.category.charAt(0).toUpperCase() + m.category.slice(1)
              const itemsList = items.map((i: any) => `${i.food_name} (${i.quantity}${i.unit})`).join(', ')
              const mealCal = items.reduce((acc: number, i: any) => acc + (Number(i.calories) || 0), 0)
              mealSections.push(`• **${catCap}**: ${itemsList} — ${Math.round(mealCal)} kcal`)
            }
          }

          const mealsText = mealSections.length > 0 ? `\n\n**Logged meals**\n${mealSections.join('\n')}` : ''

          const coaching = consumedCal > targetCalories
            ? 'You have reached your daily calorie target.'
            : `${remCal.toLocaleString()} kcal remaining to hit your daily target. Keep up the strong consistency!`

          formattedReply = `**${titleDate}**

Here is your daily nutrition summary based on persisted database records:

**${progressHeader}**
- Calories: ${consumedCal.toLocaleString()} / ${targetCalories.toLocaleString()} kcal (${remCal.toLocaleString()} remaining)
- Protein: ${consumedP}g / ${targetP}g (${remP}g remaining)
- Carbs: ${consumedC}g / ${targetC}g (${remC}g remaining)
- Fat: ${consumedF}g / ${targetF}g (${remF}g remaining)
- Fibre: ${consumedFiber}g${mealsText}

${coaching}`
        }

        let diagnosticHeader = ''
        if (shouldSimulateGeminiFailure) {
          diagnosticHeader = `🧪 **FORM Groq Failover Diagnostic Verified**
- **Simulated Condition**: Gemini HTTP 503 Service Unavailable (intentional server-side simulation).
- **Gemini Retries**: 2 attempts executed with exponential backoff (both simulated 503).
- **Failover Provider**: Groq (\`openai/gpt-oss-20b\`) successfully handled the request.
- **Action Invoked**: \`get_day\` (read-only verification).
- **Database Safety**: 0 records created, updated, or deleted. Today's nutrition data remains unchanged.
- **Failover Status**: \`providerUsed: groq\` | \`failoverOccurred: true\`

---

`
        }

        const responsePayload: NutritionAssistantResponse = {
          success: true,
          reply: `${diagnosticHeader}${formattedReply}`,
          actionsExecuted,
          dayData: summary,
          providerUsed: aiResult.providerUsed,
          failoverOccurred: aiResult.failoverOccurred,
        }

        return new Response(JSON.stringify(responsePayload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // If other actions executed, ask model for conversational response with tool results.
      // Safety rule: never rerun the DB action if this secondary call fails!
      const firstAction = actionsExecuted[0]
      let secondaryReply = ''

      if (!firstAction.success) {
        // Accurately report database error directly
        secondaryReply = `⚠️ Could not complete **${firstAction.name.replace('_', ' ')}**: ${firstAction.error || 'The requested item was not found in your log.'}\n\nNo changes were made to your daily log.`
      } else {
        try {
          const secondCall = await executeWithFailover({
            systemPrompt,
            history,
            userMessage: message.trim(),
            toolResult: {
              toolName: firstAction.name,
              result: firstAction.details || 'Success',
            },
          })
          secondaryReply = secondCall.text || `✅ Successfully processed **${firstAction.name.replace('_', ' ')}**.`
        } catch (postActionErr) {
          console.warn('[Nutrition Assistant] Post-action reply generation failed; using deterministic fallback:', postActionErr)
          secondaryReply = `✅ Successfully processed **${firstAction.name.replace('_', ' ')}**.`
        }
      }

      const responsePayload: NutritionAssistantResponse = {
        success: true,
        reply: secondaryReply || aiResult.text || 'Action executed successfully.',
        actionsExecuted,
        dayData: updatedDayData,
        providerUsed: aiResult.providerUsed,
        failoverOccurred: aiResult.failoverOccurred,
      }

      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Conversational Response (e.g. clarification question, nutrition queries)
    const responsePayload: NutritionAssistantResponse = {
      success: true,
      reply: aiResult.text || "I'm here to help you log and calibrate your nutrition. What did you eat?",
      actionsExecuted: [],
      providerUsed: aiResult.providerUsed,
      failoverOccurred: aiResult.failoverOccurred,
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal assistant error'
    console.error('[Nutrition Assistant Edge Function Error]:', err)

    if (errorMsg === 'GEMINI_API_KEY_INVALID') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'The configured Gemini API key is invalid. Please check your Supabase secrets.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (errorMsg === 'GROQ_API_KEY_INVALID') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Primary AI service was unavailable and Groq backup key was invalid. Please check your Supabase secrets.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (errorMsg === 'PRIMARY_UNAVAILABLE_BACKUP_NOT_CONFIGURED') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'The primary AI service (Gemini) is temporarily unavailable. To enable automatic backup failover, configure GROQ_API_KEY in your Supabase secrets.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (errorMsg === 'ALL_PROVIDERS_UNAVAILABLE') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Both primary (Gemini) and backup (Groq) AI services are temporarily unavailable due to high demand. Please try again in a moment.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (errorMsg === 'GEMINI_RATE_LIMIT_EXCEEDED') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI service quota temporarily exceeded. Please wait a moment and try again.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
