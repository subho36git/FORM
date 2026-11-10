/**
 * Groq Provider Service & Tool Calling Implementation
 * Supabase Edge Function: nutrition-assistant
 * 
 * Free-tier backup provider using Groq API (OpenAI-compatible format)
 * Default Model: openai/gpt-oss-20b
 */

// deno-lint-ignore-file no-explicit-any
import type { ChatMessagePayload } from './types.ts'

export interface GroqFunctionCall {
  name: string
  args: Record<string, unknown>
}

export interface GroqResponse {
  text?: string
  functionCalls?: GroqFunctionCall[]
}

export const GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'log_meal',
      description:
        'PRIMARY ACTION TO LOG MEALS OR FOODS. Call this whenever the user reports eating food or asks to log food (e.g. "For lunch I had 200g rice and 2 boiled eggs", "I ate...", "Log 3 eggs", "Add 150g chicken to dinner"). Logs a meal with all its food items in the single "items" array. Always call log_meal (NEVER update_item) when the user describes food they ate.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'snack', 'dinner'],
            description: 'The meal category (breakfast, lunch, snack, dinner).',
          },
          items: {
            type: 'array',
            description: 'List of individual food items in the meal.',
            items: {
              type: 'object',
              properties: {
                food_name: {
                  type: 'string',
                  description: 'Name of the food item (e.g. "Cooked basmati rice", "Boiled eggs", "Dal tadka").',
                },
                quantity: {
                  type: 'number',
                  description: 'Numeric quantity (e.g. 250, 3, 100). Must be positive.',
                },
                unit: {
                  type: 'string',
                  description: 'Unit of measure (e.g. "g", "ml", "large", "piece", "bowl", "tbsp", "cup").',
                },
                calories: {
                  type: 'number',
                  description: 'Estimated or user-specified total calories in kcal. Must be >= 0.',
                },
                protein_g: {
                  type: 'number',
                  description: 'Estimated or user-specified protein in grams. Must be >= 0.',
                },
                carbs_g: {
                  type: 'number',
                  description: 'Estimated or user-specified carbohydrates in grams. Must be >= 0.',
                },
                fat_g: {
                  type: 'number',
                  description: 'Estimated or user-specified dietary fat in grams. Must be >= 0.',
                },
                fiber_g: {
                  type: 'number',
                  description: 'Estimated dietary fibre in grams. Defaults to 0 if unknown.',
                },
                is_estimated: {
                  type: 'boolean',
                  description: 'True if calculated via standard nutrition estimates; False if user provided exact nutrition facts.',
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes (e.g. "Cooked with 1 tsp ghee", "Homemade").',
                },
              },
              required: ['food_name', 'quantity', 'unit', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'is_estimated'],
            },
          },
          log_date: {
            type: 'string',
            description: 'Local date (YYYY-MM-DD) for logging. Defaults to the user active date if omitted.',
          },
          meal_name: {
            type: 'string',
            description: 'Optional custom meal title (e.g. "Post-Workout Lunch").',
          },
        },
        required: ['category', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item',
      description:
        'STRICTLY FOR EDITING AN EXISTING FOOD ITEM THAT IS ALREADY IN THE DATABASE. Use ONLY when the user explicitly modifies or corrects an already-logged food item (e.g. "Actually the rice was 150g not 200g", "Change the eggs to 3"). NEVER call this to add or log new food! If the food does not already appear in Today\'s Logged Meals, you MUST NOT use this tool.',
      parameters: {
        type: 'object',
        properties: {
          item_id: {
            type: 'string',
            description: 'Exact UUID of the item if known from conversation context.',
          },
          food_name: {
            type: 'string',
            description: 'Name or partial name of the food item to locate (e.g. "ghee", "cooked rice", "egg").',
          },
          meal_category: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'snack', 'dinner'],
            description: 'Meal category to search within (optional).',
          },
          updates: {
            type: 'object',
            description: 'Fields to update.',
            properties: {
              food_name: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string' },
              calories: { type: 'number' },
              protein_g: { type: 'number' },
              carbs_g: { type: 'number' },
              fat_g: { type: 'number' },
              fiber_g: { type: 'number' },
              is_estimated: { type: 'boolean' },
              notes: { type: 'string' },
              target_meal_category: {
                type: 'string',
                enum: ['breakfast', 'lunch', 'snack', 'dinner'],
                description: 'If moving the item to another meal (e.g. from lunch to dinner).',
              },
            },
          },
        },
        required: ['updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_item',
      description:
        'STRICTLY FOR REMOVING AN EXISTING FOOD ITEM FROM THE DATABASE. Use ONLY when the user explicitly asks to remove a previously logged food (e.g. "Remove the banana", "Delete the eggs from lunch"). If the food does not already exist in Today\'s Logged Meals, do not call this.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'Exact UUID of the item if known.' },
          food_name: { type: 'string', description: 'Food name to search and delete.' },
          meal_category: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_day',
      description:
        'Fetch full meals and nutritional totals for a specific local calendar date. Call this whenever the user asks how much they have eaten, how many calories or macros they had/have left, or asks for a nutrition summary (e.g. "How much have I eaten today?", "How many calories left?", "What did I eat today?", "Show my nutrition summary", "What did I eat yesterday?").',
      parameters: {
        type: 'object',
        properties: {
          log_date: {
            type: 'string',
            description: 'Calendar date formatted as YYYY-MM-DD. Defaults to today if omitted.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_weight',
      description:
        'Log athlete bodyweight in kg (e.g. "My weight today is 78kg", "Weighed in at 75.5"). Updates weight entries and profile current weight.',
      parameters: {
        type: 'object',
        properties: {
          weight_kg: {
            type: 'number',
            description: 'Bodyweight in kilograms (between 25.0 and 350.0).',
          },
          measured_at: {
            type: 'string',
            description: 'ISO timestamp of measurement if specified.',
          },
          notes: {
            type: 'string',
            description: 'Optional note (e.g. "Morning fasted", "Post-workout").',
          },
        },
        required: ['weight_kg'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_day',
      description:
        'Finalize (close) or reopen a nutrition day (e.g. "Finalize my day", "Reopen today\'s log"). Closed days become read-only.',
      parameters: {
        type: 'object',
        properties: {
          log_date: { type: 'string', description: 'Calendar date YYYY-MM-DD.' },
          action: {
            type: 'string',
            enum: ['finalize', 'reopen'],
            description: 'Action to execute: "finalize" to close, "reopen" to open.',
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_recipe',
      description:
        'Save a multi-ingredient recipe to the user’s catalog for quick reuse (e.g. "Save this shake as a recipe", "Save my overnight oats").',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Recipe name (e.g. "Standard Post-Workout Shake").' },
          description: { type: 'string', description: 'Optional instructions or description.' },
          servings: { type: 'number', description: 'Number of servings this recipe yields (>= 1).' },
          items: {
            type: 'array',
            description: 'List of ingredient items.',
            items: {
              type: 'object',
              properties: {
                food_name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                calories: { type: 'number' },
                protein_g: { type: 'number' },
                carbs_g: { type: 'number' },
                fat_g: { type: 'number' },
                fiber_g: { type: 'number' },
              },
              required: ['food_name', 'quantity', 'unit', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
            },
          },
        },
        required: ['name', 'servings', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recipes',
      description:
        'Browse user saved recipes (e.g. "Show my saved recipes", "What recipes do I have?").',
      parameters: {
        type: 'object',
        properties: {
          search_query: { type: 'string', description: 'Optional search keyword.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_targets',
      description:
        'Update the user’s daily nutritional goals or target goal weight (e.g. "Change my calorie target to 2600", "Set protein target to 160g", "My new goal weight is 72kg").',
      parameters: {
        type: 'object',
        properties: {
          daily_calories: { type: 'number', description: 'Daily calorie target in kcal.' },
          protein_g: { type: 'number', description: 'Daily protein target in grams.' },
          carbs_g: { type: 'number', description: 'Daily carbohydrates target in grams.' },
          fat_g: { type: 'number', description: 'Daily dietary fat target in grams.' },
          goal_weight_kg: { type: 'number', description: 'Athlete target goal weight in kg.' },
        },
        required: [],
      },
    },
  },
]

export async function callGroq(params: {
  apiKey: string
  modelName?: string
  systemPrompt: string
  history?: ChatMessagePayload[]
  userMessage?: string
  toolResult?: {
    toolName: string
    result: unknown
  }
}): Promise<GroqResponse> {
  const { apiKey, modelName, systemPrompt, history = [], userMessage, toolResult } = params
  const model = modelName || Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-20b'
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

  const messages: Array<{ role: string; content?: string | null }> = [
    { role: 'system', content: systemPrompt },
  ]

  // Add conversation history (up to last 10 messages)
  const recentHistory = history.slice(-10)
  for (const h of recentHistory) {
    messages.push({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content,
    })
  }

  // Add current user message
  if (userMessage) {
    messages.push({
      role: 'user',
      content: userMessage,
    })
  }

  // If returning a tool result back to the model:
  if (toolResult) {
    messages.push({
      role: 'user',
      content: `Tool Execution Result for [${toolResult.toolName}]: ${JSON.stringify(toolResult.result)}. Please provide a clear, concise confirmation to the user.`,
    })
  }

  const requestBody = {
    model,
    messages,
    tools: GROQ_TOOLS,
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 1024,
  }

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    })
  } catch (netErr: unknown) {
    const error = new Error(`Groq network or timeout error: ${netErr instanceof Error ? netErr.message : String(netErr)}`)
    ;(error as any).isTransient = true
    throw error
  }

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[Groq API Error] status ${res.status}:`, errorText)

    if (res.status === 401 || (res.status === 400 && errorText.toLowerCase().includes('invalid_api_key'))) {
      const err = new Error('GROQ_API_KEY_INVALID')
      ;(err as any).status = res.status
      ;(err as any).isTransient = false
      throw err
    }
    if (res.status === 429 || errorText.toLowerCase().includes('rate_limit')) {
      const err = new Error('GROQ_RATE_LIMIT_EXCEEDED')
      ;(err as any).status = 429
      ;(err as any).isTransient = true
      throw err
    }
    const isTransient = [500, 502, 503, 504].includes(res.status)
    const err = new Error(`Groq API error (${res.status}): ${errorText}`)
    ;(err as any).status = res.status
    ;(err as any).isTransient = isTransient
    throw err
  }

  const json = await res.json()
  const choice = json.choices?.[0]
  if (!choice || !choice.message) {
    return { text: "I couldn't generate a response. Please try again." }
  }

  const message = choice.message
  const text = (message.content || '').trim()
  const functionCalls: GroqFunctionCall[] = []

  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function) {
        let args: Record<string, unknown> = {}
        try {
          args = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function.arguments || {})
        } catch (argErr) {
          console.error('[Groq] Failed to parse function arguments JSON:', tc.function.arguments, argErr)
        }
        functionCalls.push({
          name: tc.function.name,
          args,
        })
      }
    }
  }

  return { text, functionCalls }
}
