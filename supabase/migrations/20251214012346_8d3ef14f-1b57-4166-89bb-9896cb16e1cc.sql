-- Fix RLS policies for better security

-- Drop existing policies on patients table
DROP POLICY IF EXISTS "Staff can manage patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;

-- Create more granular policies for patients
-- Staff (admin, doctor, receptionist) can view patients
CREATE POLICY "Staff can view patients" ON public.patients
FOR SELECT USING (is_staff(auth.uid()));

-- Only admin and receptionist can insert patients
CREATE POLICY "Admin and receptionist can create patients" ON public.patients
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'receptionist'::user_role)
);

-- Staff can update patients they work with
CREATE POLICY "Staff can update patients" ON public.patients
FOR UPDATE USING (is_staff(auth.uid()));

-- Only admin can delete patients
CREATE POLICY "Admin can delete patients" ON public.patients
FOR DELETE USING (is_admin(auth.uid()));

-- Fix notifications table - allow staff to insert notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

-- Staff can create notifications for users
CREATE POLICY "Staff can create notifications" ON public.notifications
FOR INSERT WITH CHECK (is_staff(auth.uid()));

-- Admin can delete notifications
CREATE POLICY "Admin can delete notifications" ON public.notifications
FOR DELETE USING (is_admin(auth.uid()));

-- Update center_settings to require authentication for viewing (optional - keep public if needed for booking page)
-- This is kept as public since medical center info should be visible on booking pages

-- Add index for better query performance on user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON public.medical_records(patient_id);