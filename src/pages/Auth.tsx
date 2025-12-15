import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Stethoscope, Calendar, Search, User, Phone, FileText, Pill } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Doctor {
  id: string;
  specialization: string;
  full_name?: string;
}

const Auth = () => {
  const { signIn, signInWithGoogle, signUp, user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  const [signInData, setSignInData] = useState({
    identifier: '',
    password: '',
  });
  
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    confirmPassword: '',
  });

  const [quickBookingData, setQuickBookingData] = useState({
    fullName: '',
    age: '',
    phone: '',
    city: '',
    notes: '',
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
  });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    
    const fetchDoctors = async () => {
      try {
        // First get doctors
        const { data: doctorsData, error: doctorsError } = await supabase
          .from('doctors')
          .select('id, user_id, specialization')
          .eq('is_available', true);

        if (doctorsError) throw doctorsError;
        
        if (doctorsData && doctorsData.length > 0) {
          // Get profiles for these doctors
          const userIds = doctorsData.map(d => d.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          // Combine data
          const combinedDoctors = doctorsData.map(doctor => {
            const profile = profilesData?.find(p => p.user_id === doctor.user_id);
            return {
              id: doctor.id,
              specialization: doctor.specialization,
              full_name: profile?.full_name || 'طبيب'
            };
          });

          if (mounted) {
            setDoctors(combinedDoctors);
          }
        }
      } catch (error) {
        console.error('Error fetching doctors:', error);
      }
    };
    
    fetchDoctors();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    await signIn(signInData.identifier, signInData.password);
    
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle();
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "خطأ",
        description: "كلمة المرور غير متطابقة",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signUp(
      signUpData.email, 
      signUpData.password, 
      signUpData.fullName,
      signUpData.phone
    );
    
    if (error) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الحساب",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  const searchPatient = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Sanitize search term to prevent SQL injection
      const { sanitizeSearchInput } = await import('@/utils/sanitizeSearch');
      const sanitizedTerm = sanitizeSearchInput(searchTerm.trim());
      
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(`full_name.ilike.%${sanitizedTerm}%,phone.ilike.%${sanitizedTerm}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSelect = async (patient: any) => {
    setSelectedPatient(patient);
    setQuickBookingData({
      ...quickBookingData,
      fullName: patient.full_name,
      phone: patient.phone,
      age: patient.age?.toString() || '',
      city: patient.address || '',
      notes: patient.notes || ''
    });
    setSearchResults([]);

    // جلب السجلات الطبية للمريض
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patient.id)
        .order('record_date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setPatientRecords(data || []);
    } catch (error) {
      console.error('Error fetching medical records:', error);
    }
  };

  const handleQuickBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let patientId = selectedPatient?.id;

      // إذا لم يكن هناك مريض محدد، أنشئ مريض جديد
      if (!patientId) {
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .insert({
            full_name: quickBookingData.fullName,
            phone: quickBookingData.phone,
            age: quickBookingData.age ? parseInt(quickBookingData.age) : null,
            address: quickBookingData.city || null,
            notes: quickBookingData.notes || null,
          })
          .select()
          .single();

        if (patientError) throw patientError;
        patientId = patientData.id;
      }

      // إنشاء موعد
      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          doctor_id: quickBookingData.doctorId,
          appointment_date: quickBookingData.appointmentDate,
          appointment_time: quickBookingData.appointmentTime || '09:00',
          status: 'scheduled',
          notes: quickBookingData.notes || null,
        });

      if (appointmentError) throw appointmentError;

      toast({
        title: "تم الحجز بنجاح",
        description: selectedPatient 
          ? "تم حجز موعد جديد للمريض" 
          : "تم إضافة المريض وحجز الموعد بنجاح",
      });

      // Reset form
      setQuickBookingData({
        fullName: '',
        age: '',
        phone: '',
        city: '',
        notes: '',
        doctorId: '',
        appointmentDate: '',
        appointmentTime: '',
      });
      setSelectedPatient(null);
      setSearchResults([]);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message.includes('unique') 
          ? "رقم الهاتف مسجل مسبقاً" 
          : error.message || "فشل في حجز الموعد",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-2 sm:p-4 md:p-6" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <div className="flex items-center justify-center mb-3 md:mb-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Stethoscope className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            مركز د أحمد قايد سالم الطبي
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
            نظام إدارة المواعيد والمرضى
          </p>
        </div>

        <Card className="card-gradient border-0 medical-shadow">
          <CardHeader className="text-center pb-3 md:pb-4">
            <CardTitle className="text-lg md:text-xl">مرحباً بك</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-6 text-xs sm:text-sm">
                <TabsTrigger value="signin">دخول</TabsTrigger>
                <TabsTrigger value="signup">حساب</TabsTrigger>
                <TabsTrigger value="booking">حجز</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-identifier">البريد الإلكتروني أو رقم الهاتف</Label>
                    <Input
                      id="signin-identifier"
                      type="text"
                      value={signInData.identifier}
                      onChange={(e) => setSignInData({ ...signInData, identifier: e.target.value })}
                      required
                      placeholder="أدخل البريد الإلكتروني أو رقم الهاتف"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signin-password">كلمة المرور</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="medical"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    تسجيل الدخول
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">أو</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    تسجيل الدخول بواسطة Google
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">الاسم الكامل</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-phone">رقم الهاتف (اختياري)</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      value={signUpData.phone}
                      onChange={(e) => setSignUpData({ ...signUpData, phone: e.target.value })}
                      placeholder="مثال: +967xxxxxxxxx"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">كلمة المرور</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                      className="mt-1"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="medical"
                    className="w-full"
                    disabled={isLoading || signUpData.password !== signUpData.confirmPassword}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    إنشاء حساب
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">أو</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    التسجيل بواسطة Google
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="booking">
                <form onSubmit={handleQuickBooking} className="space-y-4">
                  {/* بحث عن مريض */}
                  <div>
                    <Label htmlFor="search-patient">
                      <Search className="inline w-4 h-4 ml-2" />
                      البحث عن مريض مسجل
                    </Label>
                    <Input
                      id="search-patient"
                      type="text"
                      placeholder="ابحث بالاسم أو رقم الهاتف..."
                      onChange={(e) => searchPatient(e.target.value)}
                      className="mt-1"
                    />
                    {isSearching && (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="mt-2 border rounded-lg divide-y">
                        {searchResults.map((patient) => (
                          <div
                            key={patient.id}
                            className="p-2 hover:bg-accent cursor-pointer flex items-center gap-2"
                            onClick={() => handlePatientSelect(patient)}
                          >
                            <User className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">{patient.full_name}</p>
                              <p className="text-sm text-muted-foreground">{patient.phone}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedPatient && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          <span className="font-medium">{selectedPatient.full_name}</span>
                        </div>
                        <Badge variant="secondary">مريض مسجل</Badge>
                      </div>
                      {patientRecords.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <FileText className="inline w-4 h-4 ml-1" />
                          {patientRecords.length} سجلات طبية سابقة
                        </p>
                      )}
                    </div>
                  )}

                  {!selectedPatient && (
                    <>
                      <div>
                        <Label htmlFor="booking-name">الاسم الكامل *</Label>
                        <Input
                          id="booking-name"
                          type="text"
                          value={quickBookingData.fullName}
                          onChange={(e) => setQuickBookingData({ ...quickBookingData, fullName: e.target.value })}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="booking-phone">رقم الهاتف *</Label>
                          <Input
                            id="booking-phone"
                            type="tel"
                            value={quickBookingData.phone}
                            onChange={(e) => setQuickBookingData({ ...quickBookingData, phone: e.target.value })}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="booking-age">العمر</Label>
                          <Input
                            id="booking-age"
                            type="number"
                            value={quickBookingData.age}
                            onChange={(e) => setQuickBookingData({ ...quickBookingData, age: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="booking-doctor">اختر الطبيب *</Label>
                    <Select
                      value={quickBookingData.doctorId}
                      onValueChange={(value) => setQuickBookingData({ ...quickBookingData, doctorId: value })}
                    >
                      <SelectTrigger className="mt-1">
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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="booking-date">تاريخ الموعد *</Label>
                      <Input
                        id="booking-date"
                        type="date"
                        value={quickBookingData.appointmentDate}
                        onChange={(e) => setQuickBookingData({ ...quickBookingData, appointmentDate: e.target.value })}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="booking-time">الوقت</Label>
                      <Input
                        id="booking-time"
                        type="time"
                        value={quickBookingData.appointmentTime}
                        onChange={(e) => setQuickBookingData({ ...quickBookingData, appointmentTime: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="booking-notes">ملاحظات</Label>
                    <textarea
                      id="booking-notes"
                      value={quickBookingData.notes}
                      onChange={(e) => setQuickBookingData({ ...quickBookingData, notes: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border rounded-lg bg-background min-h-[60px] text-sm"
                      placeholder="سبب الزيارة أو ملاحظات..."
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="medical"
                    className="w-full"
                    disabled={isLoading || !quickBookingData.doctorId || !quickBookingData.appointmentDate || (!selectedPatient && (!quickBookingData.fullName || !quickBookingData.phone))}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Calendar className="w-4 h-4 ml-2" />}
                    {selectedPatient ? 'حجز موعد' : 'إضافة وحجز'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;