import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, User, Phone, Clock, Stethoscope, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import Layout from '@/components/layout/Layout';
import { useCurrency } from '@/hooks/useCurrency';

interface Doctor {
  id: string;
  specialization: string;
  consultation_fee: number;
  full_name: string;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string;
}

const QuickBooking = () => {
  const { formatCurrency } = useCurrency();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPatient, setNewPatient] = useState({
    full_name: '',
    phone: '',
    email: '',
  });
  const [bookingData, setBookingData] = useState({
    patient_id: '',
    appointment_date: '',
    appointment_time: '09:00',
    notes: '',
  });

  const fetchData = async () => {
    try {
      // Fetch doctors
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, user_id, specialization, consultation_fee')
        .eq('is_available', true);

      if (doctorsError) throw doctorsError;

      // Get profiles for doctors
      if (doctorsData && doctorsData.length > 0) {
        const userIds = doctorsData.map(d => d.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const enrichedDoctors = doctorsData.map(doctor => {
          const profile = profilesData?.find(p => p.user_id === doctor.user_id);
          return {
            id: doctor.id,
            specialization: doctor.specialization,
            consultation_fee: doctor.consultation_fee || 0,
            full_name: profile?.full_name || 'طبيب'
          };
        });

        setDoctors(enrichedDoctors);
      }

      // Fetch patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .order('full_name');

      if (patientsError) throw patientsError;
      setPatients(patientsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsDialogOpen(true);
  };

  const handleAddNewPatient = async () => {
    if (!newPatient.full_name || !newPatient.phone) {
      toast({
        title: "خطأ",
        description: "يرجى ملء الاسم ورقم الهاتف",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('patients')
        .insert([newPatient])
        .select('id, full_name, phone')
        .single();

      if (error) throw error;

      setPatients([...patients, data]);
      setBookingData({ ...bookingData, patient_id: data.id });
      setNewPatient({ full_name: '', phone: '', email: '' });

      toast({
        title: "تم بنجاح",
        description: "تم إضافة المريض الجديد",
      });
    } catch (error: any) {
      console.error('Error adding patient:', error);
      toast({
        title: "خطأ",
        description: error.message.includes('unique') ? "رقم الهاتف مسجل مسبقاً" : "فشل في إضافة المريض",
        variant: "destructive",
      });
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !bookingData.patient_id || !bookingData.appointment_date) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع البيانات المطلوبة",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .insert([{
          patient_id: bookingData.patient_id,
          doctor_id: selectedDoctor.id,
          appointment_date: bookingData.appointment_date,
          appointment_time: bookingData.appointment_time,
          notes: bookingData.notes,
          status: 'scheduled',
        }]);

      if (error) throw error;

      toast({
        title: "تم الحجز بنجاح",
        description: "تم حجز الموعد بنجاح",
      });

      // Reset form
      setIsDialogOpen(false);
      setSelectedDoctor(null);
      setBookingData({
        patient_id: '',
        appointment_date: '',
        appointment_time: '09:00',
        notes: '',
      });
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      toast({
        title: "خطأ",
        description: "فشل في حجز الموعد",
        variant: "destructive",
      });
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
  );

  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الحجز السريع</h1>
            <p className="text-muted-foreground mt-1">
              حجز مواعيد سريع للمرضى
            </p>
          </div>
        </div>

        {/* Doctors Grid */}
        <Card className="card-gradient border-0 medical-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              اختر الطبيب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-smooth cursor-pointer"
                  onClick={() => handleDoctorSelect(doctor)}
                >
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <Stethoscope className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">
                      د. {doctor.full_name}
                    </h3>
                    <p className="text-sm text-primary">{doctor.specialization}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(doctor.consultation_fee)}
                    </p>
                    <Button size="sm" variant="medical" className="w-full">
                      احجز موعد
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Booking Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                حجز موعد مع د. {selectedDoctor?.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Patient Selection */}
              <div className="space-y-4">
                <Label>اختر المريض</Label>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="البحث عن مريض..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className={`p-3 cursor-pointer hover:bg-accent/50 border-b last:border-b-0 ${
                          bookingData.patient_id === patient.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => setBookingData({ ...bookingData, patient_id: patient.id })}
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{patient.full_name}</p>
                            <p className="text-sm text-muted-foreground">{patient.phone}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* New Patient Form */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة مريض جديد
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new_patient_name">الاسم الكامل</Label>
                    <Input
                      id="new_patient_name"
                      value={newPatient.full_name}
                      onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_patient_phone">رقم الهاتف</Label>
                    <Input
                      id="new_patient_phone"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="new_patient_email">البريد الإلكتروني (اختياري)</Label>
                    <Input
                      id="new_patient_email"
                      type="email"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Button onClick={handleAddNewPatient} variant="outline" className="w-full">
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة المريض
                    </Button>
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">تفاصيل الموعد</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="appointment_date">تاريخ الموعد</Label>
                    <Input
                      id="appointment_date"
                      type="date"
                      min={today}
                      value={bookingData.appointment_date}
                      onChange={(e) => setBookingData({ ...bookingData, appointment_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="appointment_time">وقت الموعد</Label>
                    <Input
                      id="appointment_time"
                      type="time"
                      value={bookingData.appointment_time}
                      onChange={(e) => setBookingData({ ...bookingData, appointment_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">ملاحظات</Label>
                  <textarea
                    id="notes"
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-background min-h-[80px]"
                    placeholder="سبب الزيارة، أعراض، إلخ..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button onClick={handleBookAppointment} variant="medical" className="flex-1">
                  <Calendar className="w-4 h-4 ml-2" />
                  تأكيد الحجز
                </Button>
                <Button
                  onClick={() => setIsDialogOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default QuickBooking;