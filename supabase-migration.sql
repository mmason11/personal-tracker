-- Supabase Migration for Personal Tracker
-- Run this in the Supabase SQL Editor

-- 1. Profiles table (auto-created on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  week1_start TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  fitbit_access_token TEXT,
  fitbit_refresh_token TEXT,
  fitbit_user_id TEXT,
  peloton_session_id TEXT,
  peloton_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Big Three Goals
CREATE TABLE IF NOT EXISTS big_three_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  week_start TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE big_three_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals" ON big_three_goals FOR ALL USING (auth.uid() = user_id);

-- 3. Todo Items
CREATE TABLE IF NOT EXISTS todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TEXT
);

ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own todos" ON todo_items FOR ALL USING (auth.uid() = user_id);

-- 4. Custom Events
CREATE TABLE IF NOT EXISTS custom_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

ALTER TABLE custom_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own events" ON custom_events FOR ALL USING (auth.uid() = user_id);

-- 5. Routine Overrides
CREATE TABLE IF NOT EXISTS routine_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  UNIQUE(user_id, routine_id, date)
);

ALTER TABLE routine_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own overrides" ON routine_overrides FOR ALL USING (auth.uid() = user_id);

-- 6. Routine Completions
CREATE TABLE IF NOT EXISTS routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id TEXT NOT NULL,
  date TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, routine_id, date)
);

ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own completions" ON routine_completions FOR ALL USING (auth.uid() = user_id);

-- 7. Routine Streaks
CREATE TABLE IF NOT EXISTS routine_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id TEXT NOT NULL,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_completed TEXT,
  UNIQUE(user_id, routine_id)
);

ALTER TABLE routine_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own streaks" ON routine_streaks FOR ALL USING (auth.uid() = user_id);

-- 8. Fitbit Daily Activity
CREATE TABLE IF NOT EXISTS fitbit_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  steps INTEGER DEFAULT 0,
  calories_total INTEGER DEFAULT 0,
  calories_active INTEGER DEFAULT 0,
  distance_km REAL DEFAULT 0,
  floors INTEGER DEFAULT 0,
  active_minutes_very INTEGER DEFAULT 0,
  active_minutes_fairly INTEGER DEFAULT 0,
  active_minutes_lightly INTEGER DEFAULT 0,
  sedentary_minutes INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE fitbit_daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own activity" ON fitbit_daily_activity FOR ALL USING (auth.uid() = user_id);

-- 9. Fitbit Heart Rate
CREATE TABLE IF NOT EXISTS fitbit_heart_rate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  resting_hr INTEGER,
  out_of_range_minutes INTEGER DEFAULT 0,
  out_of_range_calories REAL DEFAULT 0,
  fat_burn_minutes INTEGER DEFAULT 0,
  fat_burn_calories REAL DEFAULT 0,
  cardio_minutes INTEGER DEFAULT 0,
  cardio_calories REAL DEFAULT 0,
  peak_minutes INTEGER DEFAULT 0,
  peak_calories REAL DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE fitbit_heart_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own heart rate" ON fitbit_heart_rate FOR ALL USING (auth.uid() = user_id);

-- 10. Fitbit Sleep
CREATE TABLE IF NOT EXISTS fitbit_sleep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  efficiency INTEGER DEFAULT 0,
  deep_minutes INTEGER DEFAULT 0,
  light_minutes INTEGER DEFAULT 0,
  rem_minutes INTEGER DEFAULT 0,
  wake_minutes INTEGER DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE fitbit_sleep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sleep" ON fitbit_sleep FOR ALL USING (auth.uid() = user_id);

-- 11. Peloton Workouts
CREATE TABLE IF NOT EXISTS peloton_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peloton_workout_id TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  discipline TEXT,
  duration_seconds INTEGER DEFAULT 0,
  title TEXT,
  instructor TEXT,
  total_output INTEGER,
  avg_cadence REAL,
  avg_resistance REAL,
  avg_speed REAL,
  avg_heart_rate REAL,
  max_heart_rate REAL,
  calories INTEGER DEFAULT 0,
  distance_miles REAL,
  is_pr BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, peloton_workout_id)
);

ALTER TABLE peloton_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workouts" ON peloton_workouts FOR ALL USING (auth.uid() = user_id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_big_three_user_week ON big_three_goals(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_todo_user ON todo_items(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_events_user_date ON custom_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_routine_overrides_user ON routine_overrides(user_id, routine_id, date);
CREATE INDEX IF NOT EXISTS idx_routine_completions_user ON routine_completions(user_id, routine_id, date);
CREATE INDEX IF NOT EXISTS idx_fitbit_activity_user_date ON fitbit_daily_activity(user_id, date);
CREATE INDEX IF NOT EXISTS idx_fitbit_hr_user_date ON fitbit_heart_rate(user_id, date);
CREATE INDEX IF NOT EXISTS idx_fitbit_sleep_user_date ON fitbit_sleep(user_id, date);
CREATE INDEX IF NOT EXISTS idx_peloton_user ON peloton_workouts(user_id, started_at);
