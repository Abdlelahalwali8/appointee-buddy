import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Calendar, Phone, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { TextInput, TextAreaField } from '@/components/common/FormField';
import { useForm, FormErrors } from '@/hooks/useForm';

interface SearchResult {
  type: 'patient' | 'doctor' | 'appointment';
  id: string;
  name: string;
  phone?: string;
  email?: string;
  specialization?: string;
  data: any;
}

const SmartSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const performSearch = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    try {
      // Sanitize search term to prevent SQL injection
      const { sanitizeSearchInput } = await import('@/utils/sanitizeSearch');
      const sanitizedQuery = sanitizeSearchInput(query.trim());
      
      const searchResults: SearchResult[] = [];

      // Search patients
      const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .or(`full_name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`);

      patients?.forEach(patient => {
        searchResults.push({
          type: 'patient',
          id: patient.id,
          name: patient.full_name,
          phone: patient.phone,
          email: patient.email,
          data: patient,
        });
      });

      // Search doctors
      const { data: doctors } = await supabase
        .from('doctors')
        .select(`
          *,
          profiles (full_name, email)
        `)
        .or(`profiles.full_name.ilike.%${sanitizedQuery}%`);

      doctors?.forEach(doctor => {
        searchResults.push({
          type: 'doctor',
          id: doctor.id,
          name: `د. ${doctor.profiles?.full_name}`,
          specialization: doctor.specialization,
          data: doctor,
        });
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      toast({ title: "خطأ", description: "فشل في البحث", variant: "destructive" });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    performSearch(value);
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setIsOpen(false);
    setIsBookingOpen(true);
  };

  const handleAddNewPatient = () => {
    setIsOpen(false);
    setIsAddPatientOpen(true);
  };

  // Add Patient Form
  const initialAddPatientValues = {
    full_name: '',
    phone: '',
    email: '',
    age: '',
    gender: 'male',
    medical_history: '',
  };

  const validateAddPatient = (values: typeof initialAddPatientValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.full_name) errors.full_name = 'الاسم مطلوب.';
    if (!values.phone) errors.phone = 'رقم الهاتف مطلوب.';
    return errors;
  };

  const handleAddPatient = async (values: typeof initialAddPatientValues) => {
    try {
      const { data: newPatient, error } = await supabase
        .from('patients')
        .insert([{
          full_name: values.full_name,
          phone: values.phone,
          email: values.email || null,
          age: values.age ? parseInt(values.age) : null,
          gender: values.gender,
          medical_history: values.medical_history || null,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: "تم الإضافة", description: "تم إضافة المريض بنجاح" });
      setSelectedPatient(newPatient);
      setIsAddPatientOpen(false);
      addPatientForm.resetForm();
      setIsBookingOpen(true);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل في إضافة المريض", variant: "destructive" });
    }
  };

  const addPatientForm = useForm({
    initialValues: initialAddPatientValues,
    onSubmit: handleAddPatient,
    validate: validateAddPatient,
  });

  // Book Appointment Form
  const initialBookingValues = {
    doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00',
    notes: '',
  };

  const validateBooking = (values: typeof initialBookingValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.doctor_id) errors.doctor_id = 'يجب اختيار طبيب.';
    if (!values.appointment_date) errors.appointment_date = 'تاريخ الموعد مطلوب.';
    return errors;
  };

  const handleBookAppointment = async (values: typeof initialBookingValues) => {
    try {
      if (!selectedPatient) throw new Error('لم يتم اختيار مريض.');

      const { error } = await supabase
        .from('appointments')
        .insert([{
          patient_id: selectedPatient.id,
          doctor_id: values.doctor_id,
          appointment_date: values.appointment_date,
          appointment_time: values.appointment_time,
          status: 'scheduled',
          notes: values.notes || null,
        }]);

      if (error) throw error;

      toast({ title: "تم الحجز", description: "تم حجز الموعد بنجاح" });
      setIsBookingOpen(false);
      bookingForm.resetForm();
      setSelectedPatient(null);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل في حجز الموعد", variant: "destructive" });
    }
  };

  const bookingForm = useForm({
    initialValues: initialBookingValues,
    onSubmit: handleBookAppointment,
    validate: validateBooking,
  });

  return (
    <>
      {/* Smart Search Bar */}
      <div className="relative" ref={searchRef}>
        <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-4 py-2 border border-primary/20">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="ابحث عن مريض، طبيب، أو موعد..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="border-0 bg-transparent focus:ring-0"
          />
        </div>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            {searchTerm.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                ابدأ بالكتابة للبحث...
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 space-y-3">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-warning" />
                  <p>لم يتم العثور على نتائج</p>
                </div>
                <Button
                  onClick={handleAddNewPatient}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة مريض جديد
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {results.map((result) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="p-3 hover:bg-accent/50 cursor-pointer transition"
                  >
                    {result.type === 'patient' && (
                      <div
                        onClick={() => handleSelectPatient(result.data)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {result.name.split(' ')[0][0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">{result.name}</p>
                            <p className="text-sm text-muted-foreground">{result.phone}</p>
                          </div>
                        </div>
                        <Badge variant="secondary">مريض</Badge>
                      </div>
                    )}

                    {result.type === 'doctor' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {result.name.split(' ')[0][0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">{result.name}</p>
                            <p className="text-sm text-muted-foreground">{result.specialization}</p>
                          </div>
                        </div>
                        <Badge variant="outline">طبيب</Badge>
                      </div>
                    )}
                  </div>
                ))}

                {searchTerm.length > 0 && results.every(r => r.type !== 'patient') && (
                  <div className="p-3 border-t">
                    <Button
                      onClick={handleAddNewPatient}
                      variant="outline"
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة مريض جديد: {searchTerm}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Patient Dialog */}
      <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مريض جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={addPatientForm.handleSubmit} className="space-y-4">
            <TextInput
              label="الاسم الكامل"
              required
              name="full_name"
              value={addPatientForm.values.full_name}
              onChange={addPatientForm.handleChange}
              onBlur={addPatientForm.handleBlur}
              error={addPatientForm.errors.full_name}
            />
            <TextInput
              label="رقم الهاتف"
              required
              name="phone"
              value={addPatientForm.values.phone}
              onChange={addPatientForm.handleChange}
              onBlur={addPatientForm.handleBlur}
              error={addPatientForm.errors.phone}
            />
            <TextInput
              label="البريد الإلكتروني"
              type="email"
              name="email"
              value={addPatientForm.values.email}
              onChange={addPatientForm.handleChange}
              onBlur={addPatientForm.handleBlur}
            />
            <DialogFooter>
              <Button type="submit" variant="medical" disabled={addPatientForm.isSubmitting}>
                {addPatientForm.isSubmitting ? "جاري الإضافة..." : "إضافة والمتابعة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Book Appointment Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              حجز موعد جديد - {selectedPatient?.full_name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={bookingForm.handleSubmit} className="space-y-4">
            <TextInput
              label="تاريخ الموعد"
              type="date"
              required
              name="appointment_date"
              value={bookingForm.values.appointment_date}
              onChange={bookingForm.handleChange}
              onBlur={bookingForm.handleBlur}
              error={bookingForm.errors.appointment_date}
            />
            <TextInput
              label="وقت الموعد"
              type="time"
              required
              name="appointment_time"
              value={bookingForm.values.appointment_time}
              onChange={bookingForm.handleChange}
              onBlur={bookingForm.handleBlur}
            />
            <TextAreaField
              label="ملاحظات"
              name="notes"
              value={bookingForm.values.notes}
              onChange={bookingForm.handleChange}
              onBlur={bookingForm.handleBlur}
            />
            <DialogFooter>
              <Button type="submit" variant="medical" disabled={bookingForm.isSubmitting}>
                {bookingForm.isSubmitting ? "جاري الحجز..." : "حجز الموعد"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SmartSearch;
