-- Create activity_logs table for tracking user activities
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'task', 'group', 'member', 'score', 'auth'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_group_id ON public.activity_logs(group_id);

-- RLS Policies
-- Leaders and admins can view all activity logs
CREATE POLICY "Leaders and admins can view activity logs"
ON public.activity_logs
FOR SELECT
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'leader'::app_role));

-- Leaders and admins can insert activity logs
CREATE POLICY "Leaders and admins can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'leader'::app_role) OR user_id = auth.uid());

-- Leaders and admins can delete activity logs
CREATE POLICY "Leaders and admins can delete activity logs"
ON public.activity_logs
FOR DELETE
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'leader'::app_role));