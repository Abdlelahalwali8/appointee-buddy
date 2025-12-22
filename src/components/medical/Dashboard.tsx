import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, UserPlus, Clock, DollarSign, Activity, TrendingUp, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { RecentAppointments } from "./RecentAppointments";
import { QuickActions } from "./QuickActions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const [centerSettings, setCenterSettings] = useState<any>(null);
  const [todayStats, setTodayStats] = useState({
    appointments: 0,
    patients: 0,
    waiting: 0,
    revenue: 0,
    completed: 0,
    doctors: 0,
    newPatientsToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetchCenterSettings();
    fetchTodayStats();
  }, []);

  // Real-time subscription for appointments
  useRealtimeSubscription({
    table: 'appointments',
    onInsert: () => {
      fetchTodayStats();
      toast.success('تم إضافة موعد جديد');
      setLastUpdate(new Date());
    },
    onUpdate: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
    onDelete: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
  });

  // Real-time subscription for patients
  useRealtimeSubscription({
    table: 'patients',
    onInsert: () => {
      fetchTodayStats();
      toast.success('تم تسجيل مريض جديد');
      setLastUpdate(new Date());
    },
    onUpdate: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
    onDelete: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
  });

  // Real-time subscription for doctors
  useRealtimeSubscription({
    table: 'doctors',
    onInsert: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
    onUpdate: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
    onDelete: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
  });

  // Real-time subscription for medical records
  useRealtimeSubscription({
    table: 'medical_records',
    onInsert: () => {
      fetchTodayStats();
      setLastUpdate(new Date());
    },
  });

  const fetchCenterSettings = async () => {
    const { data } = await supabase
      .from('center_settings')
      .select('*')
      .single();
    setCenterSettings(data);
  };

  const fetchTodayStats = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's appointments with doctor info
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*, cost, status, is_return_visit, doctors(consultation_fee, return_consultation_fee, free_return_days)')
        .eq('appointment_date', today);

      // Calculate statistics
      const completedAppointments = appointments?.filter(apt => apt.status === 'completed') || [];
      const waitingAppointments = appointments?.filter(apt => apt.status === 'scheduled' || apt.status === 'waiting') || [];

      // Calculate revenue considering free returns
      let totalRevenue = 0;
      for (const apt of completedAppointments) {
        if (apt.is_return_visit) {
          // Check if within free return period
          const { data: lastVisit } = await supabase
            .from('appointments')
            .select('appointment_date, doctor_id')
            .eq('patient_id', apt.patient_id)
            .eq('doctor_id', apt.doctor_id)
            .eq('status', 'completed')
            .neq('id', apt.id)
            .order('appointment_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastVisit && apt.doctors?.free_return_days) {
            const lastVisitDate = new Date(lastVisit.appointment_date);
            const currentDate = new Date(apt.appointment_date);
            const daysDiff = Math.floor((currentDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff <= apt.doctors.free_return_days) {
              // Free return visit
              totalRevenue += 0;
            } else {
              totalRevenue += apt.cost || apt.doctors?.return_consultation_fee || apt.doctors?.consultation_fee || 0;
            }
          } else {
            totalRevenue += apt.cost || apt.doctors?.return_consultation_fee || apt.doctors?.consultation_fee || 0;
          }
        } else {
          totalRevenue += apt.cost || apt.doctors?.consultation_fee || 0;
        }
      }

      // Fetch total patients count
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      // Fetch today's new patients
      const { count: newPatientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      // Fetch active doctors count
      const { count: doctorsCount } = await supabase
        .from('doctors')
        .select('*', { count: 'exact', head: true })
        .eq('is_available', true);

      setTodayStats({
        appointments: appointments?.length || 0,
        patients: patientsCount || 0,
        waiting: waitingAppointments.length,
        revenue: totalRevenue,
        completed: completedAppointments.length,
        doctors: doctorsCount || 0,
        newPatientsToday: newPatientsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    {
      title: "مواعيد اليوم",
      value: todayStats.appointments.toString(),
      description: `${todayStats.completed} مكتمل • ${todayStats.waiting} منتظر`,
      icon: Calendar,
      trend: todayStats.appointments > 0 ? `+${todayStats.appointments}` : "0",
      color: "primary" as const
    },
    {
      title: "إجمالي المرضى",
      value: todayStats.patients.toString(),
      description: todayStats.newPatientsToday > 0 ? `+${todayStats.newPatientsToday} اليوم` : "لا يوجد جديد",
      icon: Users,
      trend: todayStats.newPatientsToday > 0 ? `+${todayStats.newPatientsToday}` : "0",
      color: "success" as const
    },
    {
      title: "في الانتظار",
      value: todayStats.waiting.toString(),
      description: todayStats.waiting === 0 ? "لا يوجد منتظرين" : "مريض ينتظر",
      icon: Clock,
      trend: todayStats.waiting > 0 ? `${todayStats.waiting}` : "✓",
      color: todayStats.waiting > 0 ? "warning" as const : "success" as const
    },
    {
      title: "إيرادات اليوم",
      value: formatCurrency(todayStats.revenue),
      description: `${todayStats.completed} موعد مكتمل`,
      icon: DollarSign,
      trend: todayStats.revenue > 0 ? "+" : "0",
      color: "success" as const
    }
  ];

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {centerSettings?.center_name || 'المركز الطبي'}
            </h1>
            <div className="flex items-center gap-2 mt-1 md:mt-2">
              <p className="text-sm md:text-base text-muted-foreground">
                نظام إدارة المواعيد والمرضى
              </p>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                مزامنة فورية
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 sm:flex-none text-xs md:text-sm"
              onClick={() => {
                fetchTodayStats();
                toast.success('تم تحديث البيانات');
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none text-xs md:text-sm">
              <Activity className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2" />
              <span className="hidden sm:inline">تقرير يومي</span>
              <span className="sm:hidden">تقرير</span>
            </Button>
            <Button size="sm" variant="medical" className="flex-1 sm:flex-none text-xs md:text-sm">
              <UserPlus className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2" />
              <span className="hidden sm:inline">مريض جديد</span>
              <span className="sm:hidden">جديد</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <Card className="card-gradient border-0 medical-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">الأطباء المتاحين</p>
                <p className="text-2xl font-bold text-foreground">{todayStats.doctors}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-gradient border-0 medical-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">مواعيد مكتملة</p>
                <p className="text-2xl font-bold text-success">{todayStats.completed}</p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-gradient border-0 medical-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">مرضى جدد اليوم</p>
                <p className="text-2xl font-bold text-primary">{todayStats.newPatientsToday}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-gradient border-0 medical-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">معدل الإيراد/موعد</p>
                <p className="text-2xl font-bold text-foreground">
                  {todayStats.completed > 0 
                    ? formatCurrency(Math.round(todayStats.revenue / todayStats.completed))
                    : formatCurrency(0)}
                </p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Recent Appointments */}
        <div className="lg:col-span-2">
          <RecentAppointments />
        </div>

        {/* Quick Actions */}
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
