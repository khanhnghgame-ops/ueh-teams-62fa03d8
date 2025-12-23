-- Create notes table for personal notes feature
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'pinned')),
  tags TEXT[] DEFAULT '{}',
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
  links TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notes (private)
CREATE POLICY "Users can view their own notes"
ON public.notes
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can view public/pinned notes in their groups
CREATE POLICY "Members can view public notes in group"
ON public.notes
FOR SELECT
USING (
  visibility IN ('public', 'pinned') 
  AND is_group_member(auth.uid(), group_id)
);

-- Policy: Users can create their own notes
CREATE POLICY "Users can create their own notes"
ON public.notes
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND is_group_member(auth.uid(), group_id)
);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes"
ON public.notes
FOR UPDATE
USING (user_id = auth.uid());

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON public.notes
FOR DELETE
USING (user_id = auth.uid());

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_notes_group_id ON public.notes(group_id);
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_visibility ON public.notes(visibility);
CREATE INDEX idx_notes_task_id ON public.notes(task_id);
CREATE INDEX idx_notes_stage_id ON public.notes(stage_id);