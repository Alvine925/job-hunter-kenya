CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('feedback', 'suggestion', 'feature', 'bug')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Index for searching/listing feedback by user
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx
  ON public.user_feedback (user_id);

-- Policy to allow authenticated users to submit feedback
CREATE POLICY "user_feedback_insert_own"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy to allow users to view their own submitted feedback
CREATE POLICY "user_feedback_select_own"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);
