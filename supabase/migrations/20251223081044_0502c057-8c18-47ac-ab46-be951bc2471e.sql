-- Add auto_save_content column for draft saving
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS auto_save_content TEXT;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS last_auto_save TIMESTAMP WITH TIME ZONE;

-- Create note_history table for version history
CREATE TABLE public.note_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  visibility TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_summary TEXT
);

-- Enable RLS on note_history
ALTER TABLE public.note_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history of their own notes
CREATE POLICY "Users can view their own note history"
ON public.note_history
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can insert history for their own notes
CREATE POLICY "Users can insert their own note history"
ON public.note_history
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Index for faster queries
CREATE INDEX idx_note_history_note_id ON public.note_history(note_id);
CREATE INDEX idx_note_history_saved_at ON public.note_history(saved_at DESC);