-- Enable realtime for tables (only if not already added)
DO $$ 
BEGIN
  -- user_roles
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
  
  -- appointments
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appointments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
  
  -- patients
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'patients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
  END IF;
  
  -- doctors
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'doctors') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;
  END IF;
  
  -- medical_records
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'medical_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_records;
  END IF;
  
  -- notifications
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Enable REPLICA IDENTITY FULL for complete row data
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.doctors REPLICA IDENTITY FULL;
ALTER TABLE public.medical_records REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add DELETE policy for profiles (admin only) if not exists
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (is_admin(auth.uid()));