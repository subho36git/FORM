-- ==============================================================================
-- FORM Application — Phase 6.2: Nutrition Tracking Database Architecture
-- Migration: 007_nutrition_tracking.sql
-- Description:
--   1. Creates core daily logging tables in strict dependency order:
--        • public.nutrition_days (Single log per user per calendar date)
--        • public.nutrition_meals (Chronological meals with category & sort order)
--        • public.nutrition_food_items (Granular food entries with decimal macros)
--   2. Creates athlete food repository tables:
--        • public.saved_foods (Reusable custom/frequent food templates)
--        • public.saved_recipes (Composite recipe templates with servings)
--        • public.saved_recipe_items (Ingredient components of saved recipes)
--   3. Enforces multi-tenant ownership at the constraint level using composite
--      foreign keys (user_id + parent_id) to eliminate cross-tenant references.
--   4. Grants explicit least-privilege permissions and enables Row Level Security (RLS).
--   5. Configures hardened RLS policies with cross-table ownership validation.
--   6. Enforces field immutability triggers (SET search_path = '') preventing
--      user_id or parent reference hijacking.
--   7. Configures updated_at synchronization triggers.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PHASE 1: Create Core Tables in Strict Dependency Order
-- ==============================================================================

-- 1. Daily Nutrition Logs
-- Enforces one log per user per date. Stores day status (open/closed) and finalization.
CREATE TABLE IF NOT EXISTS public.nutrition_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One log per user per date
  CONSTRAINT uq_nutrition_days_user_date UNIQUE (user_id, log_date),

  -- Composite unique key to support composite foreign keys from child tables
  CONSTRAINT uq_nutrition_days_id_user UNIQUE (id, user_id),

  -- Integrity check: closed days should record finalization timestamp
  CONSTRAINT chk_nutrition_days_finalized CHECK (
    (status = 'closed' AND finalized_at IS NOT NULL) OR
    (status = 'open')
  )
);

COMMENT ON TABLE public.nutrition_days IS 
  'Daily nutrition tracking logs. Represents an athlete''s intake for a specific calendar date.';
COMMENT ON COLUMN public.nutrition_days.log_date IS 
  'Calendar date for the log (YYYY-MM-DD). Strictly unique per user.';
COMMENT ON COLUMN public.nutrition_days.status IS 
  'Status of the daily log: open (active tracking) or closed (finalized review).';
COMMENT ON COLUMN public.nutrition_days.finalized_at IS 
  'Timestamp when the daily intake log was finalized/closed by the athlete.';


-- 2. Nutrition Meals
-- Represents a meal grouping within a day (e.g. Breakfast, Lunch, Post-Workout Snack, Dinner).
-- Allows multiple meals of the same category per day.
CREATE TABLE IF NOT EXISTS public.nutrition_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutrition_day_id uuid NOT NULL REFERENCES public.nutrition_days(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('breakfast', 'lunch', 'snack', 'dinner')),
  meal_name text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite unique key to support composite foreign keys from food items
  CONSTRAINT uq_nutrition_meals_id_user UNIQUE (id, user_id),

  -- Database-enforced tenant isolation: guarantees meal belongs to the same user as the day
  CONSTRAINT fk_nutrition_meals_day_user FOREIGN KEY (nutrition_day_id, user_id)
    REFERENCES public.nutrition_days (id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.nutrition_meals IS 
  'Meal groupings for a nutrition day (e.g. Breakfast, Lunch, Snacks, Dinner). Multiple meals per category are permitted.';
COMMENT ON COLUMN public.nutrition_meals.category IS 
  'Primary meal classification: breakfast, lunch, snack, or dinner.';
COMMENT ON COLUMN public.nutrition_meals.meal_name IS 
  'Optional custom label (e.g., "Post-Workout Recovery Shake", "Team Dinner").';
COMMENT ON COLUMN public.nutrition_meals.sort_order IS 
  'Display sequence order within the day (0-indexed).';


-- 3. Nutrition Food Items
-- Individual logged foods within a meal. Supports high-precision decimal values.
CREATE TABLE IF NOT EXISTS public.nutrition_food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id uuid NOT NULL REFERENCES public.nutrition_meals(id) ON DELETE CASCADE,
  food_name text NOT NULL CHECK (char_length(trim(food_name)) > 0),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL CHECK (char_length(trim(unit)) > 0),
  calories numeric NOT NULL CHECK (calories >= 0),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  is_estimated boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Database-enforced tenant isolation: guarantees food item belongs to the same user as the meal
  CONSTRAINT fk_nutrition_food_items_meal_user FOREIGN KEY (meal_id, user_id)
    REFERENCES public.nutrition_meals (id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.nutrition_food_items IS 
  'Individual food item logs within a meal. Stores decimal nutritional quantities and macronutrients.';
COMMENT ON COLUMN public.nutrition_food_items.is_estimated IS 
  'Flag indicating whether nutritional values were approximate/AI-estimated vs verified label values.';


-- 4. Saved Foods (Custom / Frequent Food Catalog)
-- Reusable foods configured by the athlete for rapid future logging.
CREATE TABLE IF NOT EXISTS public.saved_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  default_quantity numeric NOT NULL DEFAULT 100 CHECK (default_quantity > 0),
  default_unit text NOT NULL DEFAULT 'g' CHECK (char_length(trim(default_unit)) > 0),
  calories numeric NOT NULL CHECK (calories >= 0),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_saved_foods_id_user UNIQUE (id, user_id)
);

COMMENT ON TABLE public.saved_foods IS 
  'Athlete-specific catalog of saved custom foods and frequent staples for rapid meal logging.';


-- 5. Saved Recipes (Composite Meal Templates)
-- Multi-ingredient recipe templates created by the athlete.
CREATE TABLE IF NOT EXISTS public.saved_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  description text,
  servings numeric NOT NULL DEFAULT 1 CHECK (servings > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_saved_recipes_id_user UNIQUE (id, user_id)
);

COMMENT ON TABLE public.saved_recipes IS 
  'Custom recipe templates containing multiple ingredients and specified yield servings.';


-- 6. Saved Recipe Items (Recipe Ingredients)
-- Component ingredients belonging to a saved recipe.
CREATE TABLE IF NOT EXISTS public.saved_recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.saved_recipes(id) ON DELETE CASCADE,
  food_name text NOT NULL CHECK (char_length(trim(food_name)) > 0),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL CHECK (char_length(trim(unit)) > 0),
  calories numeric NOT NULL CHECK (calories >= 0),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Database-enforced tenant isolation: guarantees ingredient belongs to the same user as the recipe
  CONSTRAINT fk_saved_recipe_items_recipe_user FOREIGN KEY (recipe_id, user_id)
    REFERENCES public.saved_recipes (id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.saved_recipe_items IS 
  'Ingredients comprising a saved recipe. Automatically cascades on recipe deletion.';


-- ==============================================================================
-- PHASE 2: Performance Indexes
-- ==============================================================================

-- 1. nutrition_days indexes
CREATE INDEX IF NOT EXISTS idx_nutrition_days_user_date 
  ON public.nutrition_days (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_days_user_status 
  ON public.nutrition_days (user_id, status);

-- 2. nutrition_meals indexes
CREATE INDEX IF NOT EXISTS idx_nutrition_meals_day_sort 
  ON public.nutrition_meals (nutrition_day_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_nutrition_meals_user_logged 
  ON public.nutrition_meals (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_meals_user_category 
  ON public.nutrition_meals (user_id, category);

-- 3. nutrition_food_items indexes
CREATE INDEX IF NOT EXISTS idx_nutrition_food_items_meal 
  ON public.nutrition_food_items (meal_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_items_user_name 
  ON public.nutrition_food_items (user_id, food_name);

-- 4. saved_foods indexes
CREATE INDEX IF NOT EXISTS idx_saved_foods_user_name 
  ON public.saved_foods (user_id, name);

-- 5. saved_recipes indexes
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_name 
  ON public.saved_recipes (user_id, name);

-- 6. saved_recipe_items indexes
CREATE INDEX IF NOT EXISTS idx_saved_recipe_items_recipe 
  ON public.saved_recipe_items (recipe_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_saved_recipe_items_user_food 
  ON public.saved_recipe_items (user_id, food_name);


-- ==============================================================================
-- PHASE 3: Permissions & Row Level Security Configuration
-- ==============================================================================

REVOKE ALL ON TABLE 
  public.nutrition_days,
  public.nutrition_meals,
  public.nutrition_food_items,
  public.saved_foods,
  public.saved_recipes,
  public.saved_recipe_items
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE 
  public.nutrition_days,
  public.nutrition_meals,
  public.nutrition_food_items,
  public.saved_foods,
  public.saved_recipes,
  public.saved_recipe_items
TO authenticated;

ALTER TABLE public.nutrition_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipe_items ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- PHASE 4: Hardened Cross-Table Row Level Security Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. public.nutrition_days Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own nutrition days" ON public.nutrition_days;
CREATE POLICY "Users can view own nutrition days"
  ON public.nutrition_days FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own nutrition days" ON public.nutrition_days;
CREATE POLICY "Users can insert own nutrition days"
  ON public.nutrition_days FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own nutrition days" ON public.nutrition_days;
CREATE POLICY "Users can update own nutrition days"
  ON public.nutrition_days FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own nutrition days" ON public.nutrition_days;
CREATE POLICY "Users can delete own nutrition days"
  ON public.nutrition_days FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- B. public.nutrition_meals Policies (Cross-validated against nutrition_days)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own nutrition meals" ON public.nutrition_meals;
CREATE POLICY "Users can view own nutrition meals"
  ON public.nutrition_meals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own nutrition meals" ON public.nutrition_meals;
CREATE POLICY "Users can insert own nutrition meals"
  ON public.nutrition_meals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.nutrition_days d
      WHERE d.id = nutrition_meals.nutrition_day_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own nutrition meals" ON public.nutrition_meals;
CREATE POLICY "Users can update own nutrition meals"
  ON public.nutrition_meals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.nutrition_days d
      WHERE d.id = nutrition_meals.nutrition_day_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own nutrition meals" ON public.nutrition_meals;
CREATE POLICY "Users can delete own nutrition meals"
  ON public.nutrition_meals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- C. public.nutrition_food_items Policies (Cross-validated against nutrition_meals)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own nutrition food items" ON public.nutrition_food_items;
CREATE POLICY "Users can view own nutrition food items"
  ON public.nutrition_food_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own nutrition food items" ON public.nutrition_food_items;
CREATE POLICY "Users can insert own nutrition food items"
  ON public.nutrition_food_items FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.nutrition_meals m
      WHERE m.id = nutrition_food_items.meal_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own nutrition food items" ON public.nutrition_food_items;
CREATE POLICY "Users can update own nutrition food items"
  ON public.nutrition_food_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.nutrition_meals m
      WHERE m.id = nutrition_food_items.meal_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own nutrition food items" ON public.nutrition_food_items;
CREATE POLICY "Users can delete own nutrition food items"
  ON public.nutrition_food_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- D. public.saved_foods Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own saved foods" ON public.saved_foods;
CREATE POLICY "Users can view own saved foods"
  ON public.saved_foods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved foods" ON public.saved_foods;
CREATE POLICY "Users can insert own saved foods"
  ON public.saved_foods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own saved foods" ON public.saved_foods;
CREATE POLICY "Users can update own saved foods"
  ON public.saved_foods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved foods" ON public.saved_foods;
CREATE POLICY "Users can delete own saved foods"
  ON public.saved_foods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- E. public.saved_recipes Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own saved recipes" ON public.saved_recipes;
CREATE POLICY "Users can view own saved recipes"
  ON public.saved_recipes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved recipes" ON public.saved_recipes;
CREATE POLICY "Users can insert own saved recipes"
  ON public.saved_recipes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own saved recipes" ON public.saved_recipes;
CREATE POLICY "Users can update own saved recipes"
  ON public.saved_recipes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved recipes" ON public.saved_recipes;
CREATE POLICY "Users can delete own saved recipes"
  ON public.saved_recipes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- F. public.saved_recipe_items Policies (Cross-validated against saved_recipes)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own saved recipe items" ON public.saved_recipe_items;
CREATE POLICY "Users can view own saved recipe items"
  ON public.saved_recipe_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved recipe items" ON public.saved_recipe_items;
CREATE POLICY "Users can insert own saved recipe items"
  ON public.saved_recipe_items FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.saved_recipes r
      WHERE r.id = saved_recipe_items.recipe_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own saved recipe items" ON public.saved_recipe_items;
CREATE POLICY "Users can update own saved recipe items"
  ON public.saved_recipe_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.saved_recipes r
      WHERE r.id = saved_recipe_items.recipe_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own saved recipe items" ON public.saved_recipe_items;
CREATE POLICY "Users can delete own saved recipe items"
  ON public.saved_recipe_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ==============================================================================
-- PHASE 5: Immutability Functions & Triggers (SET search_path = '')
-- ==============================================================================

-- 1. Helper function to maintain updated_at timestamps safely
CREATE OR REPLACE FUNCTION public.handle_nutrition_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to all 6 tables
DROP TRIGGER IF EXISTS trg_nutrition_days_updated_at ON public.nutrition_days;
CREATE TRIGGER trg_nutrition_days_updated_at
  BEFORE UPDATE ON public.nutrition_days
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nutrition_updated_at();

DROP TRIGGER IF EXISTS trg_nutrition_meals_updated_at ON public.nutrition_meals;
CREATE TRIGGER trg_nutrition_meals_updated_at
  BEFORE UPDATE ON public.nutrition_meals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nutrition_updated_at();

DROP TRIGGER IF EXISTS trg_nutrition_food_items_updated_at ON public.nutrition_food_items;
CREATE TRIGGER trg_nutrition_food_items_updated_at
  BEFORE UPDATE ON public.nutrition_food_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nutrition_updated_at();

DROP TRIGGER IF EXISTS trg_saved_foods_updated_at ON public.saved_foods;
CREATE TRIGGER trg_saved_foods_updated_at
  BEFORE UPDATE ON public.saved_foods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nutrition_updated_at();

DROP TRIGGER IF EXISTS trg_saved_recipes_updated_at ON public.saved_recipes;
CREATE TRIGGER trg_saved_recipes_updated_at
  BEFORE UPDATE ON public.saved_recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nutrition_updated_at();

DROP TRIGGER IF EXISTS trg_saved_recipe_items_updated_at ON public.saved_recipe_items;
CREATE TRIGGER trg_saved_recipe_items_updated_at
  BEFORE UPDATE ON public.saved_recipe_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nutrition_updated_at();


-- 2. Nutrition Days Ownership Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_nutrition_day_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying nutrition_days user_id ownership is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_nutrition_day_ownership ON public.nutrition_days;
CREATE TRIGGER trg_protect_nutrition_day_ownership
  BEFORE UPDATE ON public.nutrition_days
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_nutrition_day_ownership();


-- 3. Nutrition Meals Ownership & Parent Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_nutrition_meal_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying nutrition_meals user_id ownership is strictly prohibited.';
  END IF;
  IF NEW.nutrition_day_id IS DISTINCT FROM OLD.nutrition_day_id THEN
    RAISE EXCEPTION 'Moving a nutrition_meal to a different nutrition_day_id is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_nutrition_meal_ownership ON public.nutrition_meals;
CREATE TRIGGER trg_protect_nutrition_meal_ownership
  BEFORE UPDATE ON public.nutrition_meals
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_nutrition_meal_ownership();


-- 4. Nutrition Food Items Ownership & Parent Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_nutrition_food_item_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying nutrition_food_items user_id ownership is strictly prohibited.';
  END IF;
  IF NEW.meal_id IS DISTINCT FROM OLD.meal_id THEN
    RAISE EXCEPTION 'Moving a nutrition_food_item to a different meal_id is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_nutrition_food_item_ownership ON public.nutrition_food_items;
CREATE TRIGGER trg_protect_nutrition_food_item_ownership
  BEFORE UPDATE ON public.nutrition_food_items
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_nutrition_food_item_ownership();


-- 5. Saved Foods Ownership Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_saved_food_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying saved_foods user_id ownership is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_saved_food_ownership ON public.saved_foods;
CREATE TRIGGER trg_protect_saved_food_ownership
  BEFORE UPDATE ON public.saved_foods
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_saved_food_ownership();


-- 6. Saved Recipes Ownership Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_saved_recipe_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying saved_recipes user_id ownership is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_saved_recipe_ownership ON public.saved_recipes;
CREATE TRIGGER trg_protect_saved_recipe_ownership
  BEFORE UPDATE ON public.saved_recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_saved_recipe_ownership();


-- 7. Saved Recipe Items Ownership & Parent Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_saved_recipe_item_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Modifying saved_recipe_items user_id ownership is strictly prohibited.';
  END IF;
  IF NEW.recipe_id IS DISTINCT FROM OLD.recipe_id THEN
    RAISE EXCEPTION 'Moving a saved_recipe_item to a different recipe_id is strictly prohibited.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_saved_recipe_item_ownership ON public.saved_recipe_items;
CREATE TRIGGER trg_protect_saved_recipe_item_ownership
  BEFORE UPDATE ON public.saved_recipe_items
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_saved_recipe_item_ownership();

-- ==============================================================================
-- PHASE 6: Transaction Commit
-- ==============================================================================

COMMIT;
