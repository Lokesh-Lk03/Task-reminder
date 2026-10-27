-- Taskly Supabase Database Schema
-- Copy and run this entire file in your Supabase SQL Editor (SQL Editor > New query > Run)

-- 1. Create Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  due_time TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  category TEXT NOT NULL DEFAULT 'Personal',
  reminder TEXT NOT NULL DEFAULT 'at-time',
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

-- 2. Create Settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  notifications BOOLEAN NOT NULL DEFAULT false,
  default_priority TEXT NOT NULL DEFAULT 'Medium'
);

-- 3. Insert default settings
INSERT INTO public.settings (id, notifications, default_priority)
VALUES (1, false, 'Medium')
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies allowing access via your Supabase API keys
DROP POLICY IF EXISTS "Allow all access on tasks" ON public.tasks;
CREATE POLICY "Allow all access on tasks" ON public.tasks
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access on settings" ON public.settings;
CREATE POLICY "Allow all access on settings" ON public.settings
  FOR ALL USING (true) WITH CHECK (true);
