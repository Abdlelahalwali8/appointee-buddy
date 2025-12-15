import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Calendar, AlertCircle, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { TextInput, TextAreaField } from '@/components/common/FormField';
import { useForm, FormErrors } from '@/hooks/useForm';

interface SearchResult {
  type: 'patient' | 'doctor';
  id: string;
  name: string;
  phone?: string;
  email?: string;
  specialization?: string;
  data: any;
}

interface Doctor {
  id: string;
  user_id: string;
  specialization: string;
  full_name?: string;
}

const SmartSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isViewRecordOpen, setIsViewRecordOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch doctors on mount
  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data: doctorsData } = await supabase
        .from('doctors')
        .select('id, user_id, specialization')
        .eq('is_available', true);

      if (doctorsData && doctorsData.length > 0) {
        const userIds = doctorsData.map(d => d.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const enrichedDoctors = doctorsData.map(doctor => {
          const profile = profilesData?.find(p => p.user_id === doctor.user_id);
          return {
            ...doctor,
            full_name: profile?.full_name || 'طبيب'
          };
        });

        setDoctors(enrichedDoctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

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

      // Search doctors - fetch separately then combine
      const { data: doctorsData } = await supabase
        .from('doctors')
        .select('id, user_id, specialization');

      if (doctorsData) {
        const userIds = doctorsData.map(d => d.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds)
          .ilike('full_name', `%${sanitizedQuery}%`);

        profilesData?.forEach(profile => {
          const doctor = doctorsData.find(d => d.user_id === profile.user_id);
          if (doctor) {
            searchResults.push({
              type: 'doctor',
              id: doctor.id,
              name: `د. ${profile.full_name}`,
              specialization: doctor.specialization,
              data: { ...doctor, full_name: profile.full_name },
            });
          }
        });
      }

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

  const handleSelectPatient = async (patient: any, action: 'book' | 'view') => {
    setSelectedPatient(patient);
    setIsOpen(false);
    
    if (action === 'book') {
      setIsBookingOpen(true);
    } else {
      // Fetch medical records
      const { data } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patient.id)
        .order('record_date', { ascending: false });
      
      setMedicalRecords(data || []);
      setIsViewRecordOpen(true);
    }
  };

  const handleAddNewPatient = () => {
    setIsOpen(false);
    if (searchTerm) {
      addPatientForm.setFieldValue('full_name', searchTerm);
    }
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
            placeholder="ابحث عن مريض أو طبيب..."
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {result.name.split(' ')[0][0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{result.name}</p>
                            <p className="text-sm text-muted-foreground">{result.phone}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectPatient(result.data, 'view')}
                          >
                            <FileText className="w-4 h-4 ml-1" />
                            السجل
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSelectPatient(result.data, 'book')}
                          >
                            <Calendar className="w-4 h-4 ml-1" />
                            حجز
                          </Button>
                        </div>
                      </div>
                    )}

                    {result.type === 'doctor' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {result.name.split(' ')[1]?.[0] || result.name[0]}
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

      {/* View Medical Record Dialog */}
      <Dialog open={isViewRecordOpen} onOpenChange={setIsViewRecordOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              السجل الطبي - {selectedPatient?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {medicalRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد سجلات طبية حتى الآن</p>
              </div>
            ) : (
              medicalRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground">التاريخ</p>
                      </div>
                      <Badge>{new Date(record.record_date).toLocaleDateString('ar-SA')}</Badge>
                    </div>
                    {record.diagnosis && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">التشخيص:</p>
                        <p className="text-sm">{record.diagnosis}</p>
                      </div>
                    )}
                    {record.treatment && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">العلاج:</p>
                        <p className="text-sm">{record.treatment}</p>
                      </div>
                    )}
                    {record.prescription && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">الوصفة:</p>
                        <p className="text-sm">{record.prescription}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
            <DialogFooter>
              <Button
                variant="default"
                onClick={() => {
                  setIsViewRecordOpen(false);
                  setIsBookingOpen(true);
                }}
              >
                <Calendar className="w-4 h-4 ml-2" />
                حجز موعد جديد
              </Button>
            </DialogFooter>
          </div>
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
            <div className="space-y-2">
              <Label htmlFor="doctor_id">اختر الطبيب *</Label>
              <Select
                value={bookingForm.values.doctor_id}
                onValueChange={(value) => bookingForm.setFieldValue('doctor_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الطبيب" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      د. {doctor.full_name} - {doctor.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bookingForm.errors.doctor_id && (
                <p className="text-sm text-destructive">{bookingForm.errors.doctor_id}</p>
              )}
            </div>
            <TextInput
              label="تاريخ الموعد"
              required
              type="date"
              name="appointment_date"
              value={bookingForm.values.appointment_date}
              onChange={bookingForm.handleChange}
              onBlur={bookingForm.handleBlur}
              error={bookingForm.errors.appointment_date}
            />
            <TextInput
              label="وقت الموعد"
              type="time"
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
              placeholder="سبب الزيارة..."
            />
            <DialogFooter>
              <Button type="submit" variant="medical" disabled={bookingForm.isSubmitting}>
                {bookingForm.isSubmitting ? "جاري الحجز..." : "تأكيد الحجز"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SmartSearch;