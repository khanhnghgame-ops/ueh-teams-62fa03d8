-- Fix RLS policy to allow assignees to update task status and submission_link
DROP POLICY IF EXISTS "Leaders can update all task fields" ON public.tasks;

-- Leaders can update all task fields
CREATE POLICY "Leaders can update all task fields" 
ON public.tasks 
FOR UPDATE 
USING (is_group_leader(auth.uid(), group_id));

-- Assignees can update status and submission_link
CREATE POLICY "Assignees can update task status and submission" 
ON public.tasks 
FOR UPDATE 
USING (is_task_assignee(auth.uid(), id))
WITH CHECK (is_task_assignee(auth.uid(), id));