-- Add free return period column to doctors table
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS free_return_days integer DEFAULT 7;

-- Add doctor_name column to doctors table for display name
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS doctor_name text;

COMMENT ON COLUMN public.doctors.free_return_days IS 'Number of days for free return visit';
COMMENT ON COLUMN public.doctors.doctor_name IS 'Display name for the doctor';

-- Update existing doctors to have a default doctor name from profiles
UPDATE public.doctors d
SET doctor_name = p.full_name
FROM public.profiles p
WHERE d.user_id = p.user_id AND d.doctor_name IS NULL;