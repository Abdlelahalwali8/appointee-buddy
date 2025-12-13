import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ClipboardList, Clock, User, Phone, ArrowUp, ArrowDown, Play, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import Layout from '@/components/layout/Layout';

interface WaitingAppointment {
  id: string;
  appointment_time: string;
  notes?: string;
  doctor_id: string;
  doctor_name?: string;
  patients: {
    full_name: string;
    phone: string;
  };
}

const WaitingList = () => {
  const permissions = usePermissions();
  const [waitingAppointments, setWaitingAppointments] = useState<WaitingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWaitingAppointments = async () => {
    try {
      // Fetch appointments with patients
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_time,
          notes,
          doctor_id,
          patients (
            full_name,
            phone
          )
        `)
        .eq('status', 'waiting')
        .eq('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      if (appointmentsData && appointmentsData.length > 0) {
        // Get doctor names
        const doctorIds = [...new Set(appointmentsData.map(a => a.doctor_id))];
        const { data: doctorsData } = await supabase
          .from('doctors')
          .select('id, user_id')
          .in('id', doctorIds);

        if (doctorsData) {
          const userIds = doctorsData.map(d => d.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          const doctorNameMap: Record<string, string> = {};
          doctorsData.forEach(doctor => {
            const profile = profilesData?.find(p => p.user_id === doctor.user_id);
            doctorNameMap[doctor.id] = profile?.full_name || 'طبيب';
          });

          const enrichedAppointments = appointmentsData.map(appointment => ({
            ...appointment,
            doctor_name: doctorNameMap[appointment.doctor_id] || 'طبيب'
          }));

          setWaitingAppointments(enrichedAppointments);
        } else {
          setWaitingAppointments(appointmentsData.map(a => ({ ...a, doctor_name: 'طبيب' })));
        }
      } else {
        setWaitingAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching waiting appointments:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل قائمة الانتظار",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitingAppointments();
  }, []);

  // Real-time subscription
  useRealtimeSubscription({
    table: 'appointments',
    onInsert: () => fetchWaitingAppointments(),
    onUpdate: () => fetchWaitingAppointments(),
    onDelete: () => fetchWaitingAppointments(),
  });

  const updateAppointmentStatus = async (appointmentId: string, newStatus: 'scheduled' | 'completed') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: `تم ${newStatus === 'completed' ? 'إكمال' : 'جدولة'} الموعد`,
      });
      
      fetchWaitingAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الموعد",
        variant: "destructive",
      });
    }
  };

  const moveAppointment = async (appointmentId: string, direction: 'up' | 'down') => {
    const currentIndex = waitingAppointments.findIndex(app => app.id === appointmentId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === waitingAppointments.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newOrder = [...waitingAppointments];
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    
    setWaitingAppointments(newOrder);
    
    toast({
      title: "تم تحديث الترتيب",
      description: "تم تحديث ترتيب قائمة الانتظار",
    });
  };

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
            <h1 className="text-3xl font-bold text-foreground">قائمة الانتظار</h1>
            <p className="text-muted-foreground mt-1">
              إدارة ترتيب المرضى في الانتظار
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              <Clock className="w-4 h-4 ml-2" />
              {waitingAppointments.length} في الانتظار
            </Badge>
            {permissions.canCreateAppointments && (
              <Button variant="medical" onClick={() => window.location.href = '/quick-booking'}>
                <Plus className="w-4 h-4 ml-2" />
                حجز سريع
              </Button>
            )}
          </div>
        </div>

        {/* Waiting List */}
        <Card className="card-gradient border-0 medical-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              المرضى في الانتظار - اليوم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {waitingAppointments.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  لا توجد مواعيد في الانتظار
                </h3>
                <p className="text-muted-foreground">
                  جميع المواعيد اليوم مكتملة أو مجدولة
                </p>
              </div>
            ) : (
              waitingAppointments.map((appointment, index) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-accent/30 border-l-4 border-l-yellow-500 hover:bg-accent/50 transition-smooth"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                        {index + 1}
                      </div>
                      {permissions.canManageWaitingList && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveAppointment(appointment.id, 'up')}
                            disabled={index === 0}
                            className="w-6 h-6 p-0"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveAppointment(appointment.id, 'down')}
                            disabled={index === waitingAppointments.length - 1}
                            className="w-6 h-6 p-0"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-yellow-100 text-yellow-800 font-semibold">
                        {appointment.patients?.full_name?.split(' ')[0]?.[0] || 'م'}
                        {appointment.patients?.full_name?.split(' ')[1]?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        {appointment.patients?.full_name}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          د. {appointment.doctor_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {appointment.patients?.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {appointment.appointment_time}
                        </span>
                      </div>
                      {appointment.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📝 {appointment.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      في الانتظار
                    </Badge>
                    {permissions.canEditAppointments && (
                      <Button
                        size="sm"
                        variant="medical"
                        onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                        className="flex items-center gap-2"
                      >
                        <Play className="w-3 h-3" />
                        ابدأ الكشف
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        {waitingAppointments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">متوسط وقت الانتظار</p>
                    <p className="text-lg font-semibold">15 دقيقة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="card-gradient border-0 medical-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">المريض التالي</p>
                    <p className="text-lg font-semibold">
                      {waitingAppointments[0]?.patients?.full_name?.split(' ')[0] || '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="card-gradient border-0 medical-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي اليوم</p>
                    <p className="text-lg font-semibold">{waitingAppointments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WaitingList;