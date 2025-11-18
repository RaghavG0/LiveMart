-- Allow users to view all user roles (needed for retailers to find wholesalers)
CREATE POLICY "Users can view all user roles"
ON public.user_roles
FOR SELECT
USING (true);