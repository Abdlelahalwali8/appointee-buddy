-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'doctor', 'receptionist', 'patient');

-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'waiting', 'completed', 'return', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (secure role management)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'patient',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create doctors table
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  specialization TEXT NOT NULL,
  license_number TEXT,
  bio TEXT,
  experience_years INTEGER DEFAULT 0,
  consultation_fee NUMERIC(10, 2) DEFAULT 0,
  return_consultation_fee NUMERIC(10, 2) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  working_days TEXT[] DEFAULT ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  address TEXT,
  medical_history TEXT,
  allergies TEXT,
  blood_type TEXT,
  emergency_contact TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  diagnosis TEXT,
  treatment TEXT,
  prescription TEXT,
  cost NUMERIC(10, 2) DEFAULT 0,
  is_return_visit BOOLEAN DEFAULT false,
  follow_up_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medical_records table
CREATE TABLE public.medical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id),
  diagnosis TEXT NOT NULL,
  treatment TEXT,
  prescription TEXT,
  notes TEXT,
  attachments TEXT[],
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create center_settings table
CREATE TABLE public.center_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_name TEXT NOT NULL DEFAULT 'المركز الطبي',
  center_name_en TEXT DEFAULT 'Medical Center',
  address TEXT,
  phone TEXT,
  email TEXT,
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  working_days TEXT[] DEFAULT ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
  currency_code TEXT DEFAULT 'SAR',
  currency_symbol TEXT DEFAULT 'ر.س',
  currency_name TEXT DEFAULT 'ريال سعودي',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role user_role NOT NULL,
  permission_name TEXT NOT NULL,
  is_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission_name)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Create function to check if user is staff (admin, doctor, or receptionist)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'doctor', 'receptionist')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff(auth.uid()));

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for doctors
CREATE POLICY "Staff can view doctors" ON public.doctors
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage doctors" ON public.doctors
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for patients
CREATE POLICY "Staff can view patients" ON public.patients
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage patients" ON public.patients
  FOR ALL USING (public.is_staff(auth.uid()));

-- RLS Policies for appointments
CREATE POLICY "Staff can view appointments" ON public.appointments
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage appointments" ON public.appointments
  FOR ALL USING (public.is_staff(auth.uid()));

-- RLS Policies for medical_records
CREATE POLICY "Staff can view medical records" ON public.medical_records
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Doctors can manage medical records" ON public.medical_records
  FOR ALL USING (public.has_role(auth.uid(), 'doctor') OR public.is_admin(auth.uid()));

-- RLS Policies for center_settings
CREATE POLICY "Everyone can view center settings" ON public.center_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage center settings" ON public.center_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for role_permissions
CREATE POLICY "Everyone can view permissions" ON public.role_permissions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage permissions" ON public.role_permissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_center_settings_updated_at
  BEFORE UPDATE ON public.center_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default center settings
INSERT INTO public.center_settings (center_name, center_name_en, currency_code, currency_symbol, currency_name)
VALUES ('المركز الطبي', 'Medical Center', 'SAR', 'ر.س', 'ريال سعودي');

-- Insert default role permissions
INSERT INTO public.role_permissions (role, permission_name, is_allowed) VALUES
  ('admin', 'manage_users', true),
  ('admin', 'manage_doctors', true),
  ('admin', 'manage_patients', true),
  ('admin', 'manage_appointments', true),
  ('admin', 'view_reports', true),
  ('admin', 'manage_settings', true),
  ('doctor', 'view_patients', true),
  ('doctor', 'manage_appointments', true),
  ('doctor', 'create_medical_records', true),
  ('doctor', 'view_reports', true),
  ('receptionist', 'view_patients', true),
  ('receptionist', 'manage_appointments', true),
  ('receptionist', 'create_patients', true),
  ('patient', 'view_own_appointments', true),
  ('patient', 'view_own_records', true);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;