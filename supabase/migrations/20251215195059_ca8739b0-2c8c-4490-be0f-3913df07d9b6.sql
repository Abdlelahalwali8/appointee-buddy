-- Fix role_permissions: Restrict SELECT to staff only (not public)
DROP POLICY IF EXISTS "Everyone can view permissions" ON public.role_permissions;

CREATE POLICY "Staff can view permissions" 
ON public.role_permissions 
FOR SELECT 
USING (is_staff(auth.uid()));

-- Fix doctors: Allow public SELECT for available doctors (needed for booking)
DROP POLICY IF EXISTS "Staff can view doctors" ON public.doctors;

CREATE POLICY "Authenticated users can view available doctors" 
ON public.doctors 
FOR SELECT 
USING (
  is_available = true OR is_staff(auth.uid())
);

-- Update profiles full_name in the profiles table for the admin user
UPDATE public.profiles 
SET full_name = 'مدير النظام' 
WHERE user_id = '9eca5ecb-3885-477f-ab03-9fd59d8c5b4a';