-- Create a security definer function to lookup email by student_id
-- This allows unauthenticated users to find email for login purposes
CREATE OR REPLACE FUNCTION public.get_email_by_student_id(_student_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE student_id = _student_id LIMIT 1;
$$;

-- Create a function to check if a user is a leader in any group
CREATE OR REPLACE FUNCTION public.is_leader(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'leader'
  )
$$;