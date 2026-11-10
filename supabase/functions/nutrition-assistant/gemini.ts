/**
 * Gemini Provider Abstraction & Function Calling Service
 * Supabase Edge Function: nutrition-assistant
 */

import type { AssistantContext, ChatMessagePayload } from './types.ts'

export interface GeminiFunctionCall {
  name: string
  args: Record<string, unknown>
}

export interface GeminiResponse {
  text?: string
  functionCalls?: GeminiFunctionCall[]
}

const GEMINI_FUNCTION_DECLARATIONS = [
  {
    name: 'log_meal',
    description:
      'PRIMARY ACTION TO LOG MEALS OR FOODS. Call this whenever the user reports eating food or asks to log food (e.g. "For lunch I had 200g rice and 2 boiled eggs", "I ate...", "Log 3 eggs", "Add 150g chicken to dinner"). Logs a meal with all its food items in the single "items" array. Always call log_meal (NEVER update_item) when the user describes food they ate.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: {
          type: 'STRING',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          description: 'The meal category (breakfast, lunch, snack, dinner).',
        },
        items: {
          type: 'ARRAY',
          description: 'List of individual food items in the meal.',
          items: {
            type: 'OBJECT',
            properties: {
              food_name: {
                type: 'STRING',
                description: 'Name of the food item (e.g. "Cooked basmati rice", "Boiled eggs", "Dal tadka").',
              },
              quantity: {
                type: 'NUMBER',
                description: 'Numeric quantity (e.g. 250, 3, 100). Must be positive.',
              },
              unit: {
                type: 'STRING',
                description: 'Unit of measure (e.g. "g", "ml", "large", "piece", "bowl", "tbsp", "cup").',
              },
              calories: {
                type: 'NUMBER',
                description: 'Estimated or user-specified total calories in kcal. Must be >= 0.',
              },
              protein_g: {
                type: 'NUMBER',
                description: 'Estimated or user-specified protein in grams. Must be >= 0.',
              },
              carbs_g: {
                type: 'NUMBER',
                description: 'Estimated or user-specified carbohydrates in grams. Must be >= 0.',
              },
              fat_g: {
                type: 'NUMBER',
                description: 'Estimated or user-specified dietary fat in grams. Must be >= 0.',
              },
              fiber_g: {
                type: 'NUMBER',
                description: 'Estimated dietary fibre in grams. Defaults to 0 if unknown.',
              },
              is_estimated: {
                type: 'BOOLEAN',
                description: 'True if calculated via standard nutrition estimates; False if user provided exact nutrition facts.',
              },
              notes: {
                type: 'STRING',
                description: 'Optional notes (e.g. "Cooked with 1 tsp ghee", "Homemade").',
              },
            },
            required: ['food_name', 'quantity', 'unit', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'is_estimated'],
          },
        },
        log_date: {
          type: 'STRING',
          description: 'Local date (YYYY-MM-DD) for logging. Defaults to the user active date if omitted.',
        },
        meal_name: {
          type: 'STRING',
          description: 'Optional custom meal title (e.g. "Post-Workout Lunch").',
        },
      },
      required: ['category', 'items'],
    },
  },
  {
    name: 'update_item',
    description:
      'STRICTLY FOR EDITING AN EXISTING FOOD ITEM THAT IS ALREADY IN THE DATABASE. Use ONLY when the user explicitly modifies or corrects an already-logged food item (e.g. "Actually the rice was 150g not 200g", "Change the eggs to 3"). NEVER call this to add or log new food! If the food does not already appear in Today\'s Logged Meals, you MUST NOT use this tool.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_id: {
          type: 'STRING',
          description: 'Exact UUID of the item if known from conversation context.',
        },
        food_name: {
          type: 'STRING',
          description: 'Name or partial name of the food item to locate (e.g. "ghee", "cooked rice", "egg").',
        },
        meal_category: {
          type: 'STRING',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          description: 'Meal category to search within (optional).',
        },
        updates: {
          type: 'OBJECT',
          description: 'Fields to update.',
          properties: {
            food_name: { type: 'STRING' },
            quantity: { type: 'NUMBER' },
            unit: { type: 'STRING' },
            calories: { type: 'NUMBER' },
            protein_g: { type: 'NUMBER' },
            carbs_g: { type: 'NUMBER' },
            fat_g: { type: 'NUMBER' },
            fiber_g: { type: 'NUMBER' },
            is_estimated: { type: 'BOOLEAN' },
            notes: { type: 'STRING' },
            target_meal_category: {
              type: 'STRING',
              enum: ['breakfast', 'lunch', 'snack', 'dinner'],
              description: 'If moving the item to another meal (e.g. from lunch to dinner).',
            },
          },
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'delete_item',
    description:
      'STRICTLY FOR REMOVING AN EXISTING FOOD ITEM FROM THE DATABASE. Use ONLY when the user explicitly asks to remove a previously logged food (e.g. "Remove the banana", "Delete the eggs from lunch"). If the food does not already exist in Today\'s Logged Meals, do not call this.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_id: { type: 'STRING', description: 'Exact UUID of the item if known.' },
        food_name: { type: 'STRING', description: 'Food name to search and delete.' },
        meal_category: {
          type: 'STRING',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
        },
      },
      required: [],
    },
  },
  {
    name: 'get_day',
    description:
      'Fetch full meals and nutritional totals for a specific local calendar date. Call this whenever the user asks how much they have eaten, how many calories or macros they had/have left, or asks for a nutrition summary (e.g. "How much have I eaten today?", "How many calories left?", "What did I eat today?", "Show my nutrition summary", "What did I eat yesterday?").',
    parameters: {
      type: 'OBJECT',
      properties: {
        log_date: {
          type: 'STRING',
          description: 'Calendar date formatted as YYYY-MM-DD. Defaults to today if omitted.',
        },
      },
      required: [],
    },
  },
  {
    name: 'set_weight',
    description:
      'Log athlete bodyweight in kg (e.g. "My weight today is 78kg", "Weighed in at 75.5"). Updates weight entries and profile current weight.',
    parameters: {
      type: 'OBJECT',
      properties: {
        weight_kg: {
          type: 'NUMBER',
          description: 'Bodyweight in kilograms (between 25.0 and 350.0).',
        },
        measured_at: {
          type: 'STRING',
          description: 'ISO timestamp of measurement if specified.',
        },
        notes: {
          type: 'STRING',
          description: 'Optional note (e.g. "Morning fasted", "Post-workout").',
        },
      },
      required: ['weight_kg'],
    },
  },
  {
    name: 'finalize_day',
    description:
      'Finalize (close) or reopen a nutrition day (e.g. "Finalize my day", "Reopen today\'s log"). Closed days become read-only.',
    parameters: {
      type: 'OBJECT',
      properties: {
        log_date: { type: 'STRING', description: 'Calendar date YYYY-MM-DD.' },
        action: {
          type: 'STRING',
          enum: ['finalize', 'reopen'],
          description: 'Action to execute: "finalize" to close, "reopen" to open.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'save_recipe',
    description:
      'Save a multi-ingredient recipe to the user’s catalog for quick reuse (e.g. "Save this shake as a recipe", "Save my overnight oats").',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Recipe name (e.g. "Standard Post-Workout Shake").' },
        description: { type: 'STRING', description: 'Optional instructions or description.' },
        servings: { type: 'NUMBER', description: 'Number of servings this recipe yields (>= 1).' },
        items: {
          type: 'ARRAY',
          description: 'List of ingredient items.',
          items: {
            type: 'OBJECT',
            properties: {
              food_name: { type: 'STRING' },
              quantity: { type: 'NUMBER' },
              unit: { type: 'STRING' },
              calories: { type: 'NUMBER' },
              protein_g: { type: 'NUMBER' },
              carbs_g: { type: 'NUMBER' },
              fat_g: { type: 'NUMBER' },
              fiber_g: { type: 'NUMBER' },
            },
            required: ['food_name', 'quantity', 'unit', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
          },
        },
      },
      required: ['name', 'servings', 'items'],
    },
  },
  {
    name: 'list_recipes',
    description:
      'Browse user saved recipes (e.g. "Show my saved recipes", "What recipes do I have?").',
    parameters: {
      type: 'OBJECT',
      properties: {
        search_query: { type: 'STRING', description: 'Optional search keyword.' },
      },
      required: [],
    },
  },
  {
    name: 'set_targets',
    description:
      'Update the user’s daily nutritional goals or target goal weight (e.g. "Change my calorie target to 2600", "Set protein target to 160g", "My new goal weight is 72kg").',
    parameters: {
      type: 'OBJECT',
      properties: {
        daily_calories: { type: 'NUMBER', description: 'Daily calorie target in kcal.' },
        protein_g: { type: 'NUMBER', description: 'Daily protein target in grams.' },
        carbs_g: { type: 'NUMBER', description: 'Daily carbohydrates target in grams.' },
        fat_g: { type: 'NUMBER', description: 'Daily dietary fat target in grams.' },
        goal_weight_kg: { type: 'NUMBER', description: 'Athlete target goal weight in kg.' },
      },
      required: [],
    },
  },
]

export function buildSystemPrompt(context: AssistantContext): string {
  const { localDate, userProfile, todaySummary } = context

  const profileInfo = userProfile
    ? `Athlete Profile:
- Goal: ${userProfile.goal || 'General Health'}
- Current Weight: ${userProfile.currentWeightKg ?? 'Not set'} kg
- Goal Weight: ${userProfile.goalWeightKg ?? 'Not set'} kg
- Daily Target: ${userProfile.dailyCalorieTarget ?? 2200} kcal | ${userProfile.proteinTargetG ?? 150}g Protein | ${userProfile.carbsTargetG ?? 250}g Carbs | ${userProfile.fatTargetG ?? 60}g Fat`
    : 'Athlete profile targets: Not configured yet.'

  let loggedTodayText = 'No meals logged yet today.'
  if (todaySummary && todaySummary.meals && todaySummary.meals.length > 0) {
    const mealLines: string[] = []
    for (const m of todaySummary.meals) {
      const itemsStr = m.items
        .map(
          (i) =>
            `  • [ID: ${i.id}] ${i.food_name} (${i.quantity}${i.unit}) — ${i.calories} kcal, ${i.protein_g}g P, ${i.carbs_g}g C, ${i.fat_g}g F${i.is_estimated ? ' [Est]' : ''}`
        )
        .join('\n')
      mealLines.push(`[${m.category.toUpperCase()}]:\n${itemsStr}`)
    }
    loggedTodayText = `Today's Logged Meals (${localDate}):
${mealLines.join('\n')}
Today's Consumed Totals:
- Calories: ${todaySummary.calories} kcal
- Protein: ${todaySummary.protein_g}g
- Carbs: ${todaySummary.carbs_g}g
- Fat: ${todaySummary.fat_g}g
- Fibre: ${todaySummary.fiber_g}g`
  }

  return `You are FORM's elite personal AI sports nutritionist and metabolic coach.
You help athletes log meals via natural language, track macronutrients, and calibrate nutrition against dynamic targets.

CURRENT APPLICATION CONTEXT:
- Local Calendar Date: ${localDate}
${profileInfo}

CURRENT DATABASE STATE FOR ${localDate}:
${loggedTodayText}

NUTRITIONAL KNOWLEDGE BASE & ESTIMATION RULES:
1. Always prefer user-provided macros over estimates. If the user states "protein shake with 30g protein and 150 calories", use 150 kcal and 30g protein.
2. Cooked-food assumptions:
   - Cooked White / Basmati / Jasmine Rice (100g): ~130 kcal, 2.7g P, 28g C, 0.3g F.
   - Cooked Whole Wheat Roti / Chapati (1 medium ~35g flour, dry): ~80-85 kcal, 3g P, 17g C, 0.5g F, 2.5g fiber.
   - Roti with 1 tsp ghee: ~120 kcal, 3g P, 17g C, 4.5g F.
   - Dal (Cooked Moong/Toor/Masoor dal, 150g bowl): ~150 kcal, 8g P, 20g C, 4g F, 4g fiber.
   - Paneer (raw, 100g): ~280 kcal, 18g P, 4g C, 22g F.
   - Curd / Dahi (plain whole milk, 100g): ~60-65 kcal, 3.5g P, 4.5g C, 3.5g F.
   - Poha (cooked, 1 bowl ~150g): ~220 kcal, 4g P, 40g C, 5g F, 2g fiber.
   - Idli (1 standard ~45g): ~60 kcal, 2g P, 12g C, 0.2g F, 1g fiber.
   - Dosa (1 plain medium ~80g): ~140 kcal, 3g P, 22g C, 4.5g F.
   - Whole Boiled Egg (1 large ~50g): ~72 kcal, 6.3g P, 0.4g C, 5g F.
   - Egg White (1 large): ~17 kcal, 3.6g P, 0.2g C, 0g F.
   - Chicken Breast (cooked skinless, 100g): ~165 kcal, 31g P, 0g C, 3.6g F.
3. Clearly mark is_estimated = true for all nutritional approximations, and false for exact packaged/user-supplied figures.
4. Clarifications: If the user names a food without ANY quantity or portion (e.g. "I had boiled eggs" or "I ate rice"), DO NOT invent a random quantity or log incomplete entries. Instead, reply immediately with ONE short, friendly clarification question (e.g. "How many boiled eggs did you have?" or "How much rice did you have (e.g. 1 bowl or 200g)?").

CRITICAL TOOL SELECTION RULES (STRICTLY ENFORCED):
Rule A — LOGGING WHAT THE USER ATE -> ALWAYS USE log_meal:
- Whenever the user states what they ate, had, or want to log (e.g. "For lunch I had 200g rice and 2 boiled eggs", "I ate 2 apples", "Log 300g chicken and 1 bowl rice for dinner"):
- You MUST call "log_meal" EXACTLY ONCE.
- Put ALL foods mentioned in the meal into the single "items" array of that one "log_meal" call.
- NEVER call "update_item" when the user states what they ate!
- NEVER call "update_item" multiple times to log foods.

Rule B — CORRECTING ALREADY-LOGGED ITEMS -> USE update_item:
- ONLY call "update_item" when the user explicitly modifies or corrects an item that ALREADY EXISTS in "Today's Logged Meals" above (e.g. "Actually the ghee was 10g not 20g", "Change the boiled eggs to 3", "I meant 150g rice").
- If the food does not already exist in "Today's Logged Meals", DO NOT call "update_item". Call "log_meal" instead.
- If multiple existing items match ambiguously, ask which one to update instead of guessing.

Rule C — REMOVING ALREADY-LOGGED ITEMS -> USE delete_item:
- ONLY call "delete_item" when the user asks to remove an item that ALREADY EXISTS in "Today's Logged Meals" above (e.g. "Remove the banana", "Delete the eggs from lunch").

Rule D — DATABASE INTEGRITY:
- You are not writing directly to the database; you are proposing structured actions via tool calls. Backend code validates and executes them.
- Never invent successful writes or fabricate numbers. Real database totals will be provided back to you.`
}

export async function callGemini(params: {
  apiKey: string
  modelName?: string
  systemPrompt: string
  history?: ChatMessagePayload[]
  userMessage?: string
  toolResult?: {
    toolName: string
    result: unknown
  }
}): Promise<GeminiResponse> {
  const { apiKey, modelName, systemPrompt, history = [], userMessage, toolResult } = params
  const model = modelName || Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const contents: Array<Record<string, unknown>> = []

  // Add conversation history (up to last 10 messages for cost and context efficiency)
  const recentHistory = history.slice(-10)
  for (const h of recentHistory) {
    contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })
  }

  // Add current user message if provided
  if (userMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    })
  }

  // If returning a tool result back to the model:
  if (toolResult) {
    contents.push({
      role: 'model',
      parts: [
        {
          functionCall: {
            name: toolResult.toolName,
            args: {},
          },
        },
      ],
    })
    contents.push({
      role: 'function',
      parts: [
        {
          functionResponse: {
            name: toolResult.toolName,
            response: { output: toolResult.result },
          },
        },
      ],
    })
  }

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    tools: [
      {
        functionDeclarations: GEMINI_FUNCTION_DECLARATIONS,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  }

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    })
  } catch (netErr: unknown) {
    const error = new Error(`Gemini network or timeout error: ${netErr instanceof Error ? netErr.message : String(netErr)}`)
    ;(error as any).isTransient = true
    throw error
  }

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[Gemini API Error] status ${res.status}:`, errorText)

    if (res.status === 400 && errorText.includes('API_KEY_INVALID')) {
      const err = new Error('GEMINI_API_KEY_INVALID')
      ;(err as any).status = 400
      ;(err as any).isTransient = false
      throw err
    }
    if (res.status === 401 || res.status === 403) {
      const err = new Error('GEMINI_API_KEY_INVALID')
      ;(err as any).status = res.status
      ;(err as any).isTransient = false
      throw err
    }
    if (res.status === 429 || errorText.includes('RESOURCE_EXHAUSTED')) {
      const err = new Error('GEMINI_RATE_LIMIT_EXCEEDED')
      ;(err as any).status = 429
      ;(err as any).isTransient = true
      throw err
    }
    const isTransient = [500, 502, 503, 504].includes(res.status)
    const err = new Error(`Gemini API error (${res.status}): ${errorText}`)
    ;(err as any).status = res.status
    ;(err as any).isTransient = isTransient
    throw err
  }

  const json = await res.json()
  const candidate = json.candidates?.[0]
  if (!candidate || !candidate.content) {
    return { text: "I couldn't generate a response. Please try again." }
  }

  const parts = candidate.content.parts || []
  let text = ''
  const functionCalls: GeminiFunctionCall[] = []

  for (const part of parts) {
    if (part.text) {
      text += part.text
    }
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      })
    }
  }

  return { text: text.trim(), functionCalls }
}
