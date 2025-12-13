import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { BarChart3, TrendingUp, Calendar, DollarSign, Users, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import Layout from '@/components/layout/Layout';
import { useCurrency } from '@/hooks/useCurrency';

interface DashboardStats {
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
  completedAppointments: number;
  cancelledAppointments: number;
  todayAppointments: number;
  monthlyRevenue: number;
}

const Reports = () => {
  const permissions = usePermissions();
  const { formatCurrency } = useCurrency();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    todayAppointments: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchStats = async () => {
    try {
      // Get total patients
      const { count: totalPatients } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      // Get total appointments
      const { count: totalAppointments } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true });

      // Get completed appointments with cost
      const { data: completedData, count: completedAppointments } = await supabase
        .from('appointments')
        .select('cost', { count: 'exact' })
        .eq('status', 'completed');

      // Calculate total revenue
      const totalRevenue = completedData?.reduce((sum, appointment) => 
        sum + (appointment.cost || 0), 0) || 0;

      // Get cancelled appointments
      const { count: cancelledAppointments } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled');

      // Get today's appointments
      const today = new Date().toISOString().split('T')[0];
      const { count: todayAppointments } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('appointment_date', today);

      // Get this month's revenue
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      const { data: monthlyData } = await supabase
        .from('appointments')
        .select('cost')
        .eq('status', 'completed')
        .gte('appointment_date', firstDayOfMonth.toISOString().split('T')[0]);

      const monthlyRevenue = monthlyData?.reduce((sum, appointment) => 
        sum + (appointment.cost || 0), 0) || 0;

      setStats({
        totalPatients: totalPatients || 0,
        totalAppointments: totalAppointments || 0,
        totalRevenue,
        completedAppointments: completedAppointments || 0,
        cancelledAppointments: cancelledAppointments || 0,
        todayAppointments: todayAppointments || 0,
        monthlyRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الإحصائيات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const exportReport = async () => {
    try {
      // Fetch appointments
      let query = supabase
        .from('appointments')
        .select(`
          appointment_date,
          appointment_time,
          status,
          cost,
          doctor_id,
          patients (
            full_name,
            phone
          )
        `);

      if (dateFrom) {
        query = query.gte('appointment_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('appointment_date', dateTo);
      }

      const { data: appointmentsData, error: appointmentsError } = await query.order('appointment_date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Get doctor names
      if (appointmentsData && appointmentsData.length > 0) {
        const doctorIds = [...new Set(appointmentsData.map(a => a.doctor_id))];
        const { data: doctorsData } = await supabase
          .from('doctors')
          .select('id, user_id')
          .in('id', doctorIds);

        let doctorNameMap: Record<string, string> = {};
        if (doctorsData) {
          const userIds = doctorsData.map(d => d.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          doctorsData.forEach(doctor => {
            const profile = profilesData?.find(p => p.user_id === doctor.user_id);
            doctorNameMap[doctor.id] = profile?.full_name || 'طبيب';
          });
        }

        // Convert to CSV
        const csvContent = [
          'التاريخ,الوقت,المريض,الطبيب,الحالة,التكلفة',
          ...appointmentsData.map(appointment => [
            appointment.appointment_date,
            appointment.appointment_time,
            appointment.patients?.full_name || '',
            doctorNameMap[appointment.doctor_id] || 'طبيب',
            appointment.status,
            appointment.cost || 0
          ].join(','))
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "تم التصدير",
          description: "تم تصدير التقرير بنجاح",
        });
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: "خطأ",
        description: "فشل في تصدير التقرير",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
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
            <h1 className="text-3xl font-bold text-foreground">التقارير والإحصائيات</h1>
            <p className="text-muted-foreground mt-1">
              تحليل شامل لأداء المركز الطبي
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportReport}>
              <Download className="w-4 h-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المرضى</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalPatients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المواعيد</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalAppointments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مواعيد اليوم</p>
                  <p className="text-2xl font-bold text-foreground">{stats.todayAppointments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-gradient border-0 medical-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                إحصائيات المواعيد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المواعيد المكتملة</span>
                <span className="font-semibold text-green-600">{stats.completedAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المواعيد الملغية</span>
                <span className="font-semibold text-red-600">{stats.cancelledAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">معدل الإكمال</span>
                <span className="font-semibold text-blue-600">
                  {stats.totalAppointments > 0 
                    ? Math.round((stats.completedAppointments / stats.totalAppointments) * 100)
                    : 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-0 medical-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                الإيرادات الشهرية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">هذا الشهر</span>
                <span className="font-semibold text-green-600">{formatCurrency(stats.monthlyRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">متوسط الموعد</span>
                <span className="font-semibold text-blue-600">
                  {formatCurrency(stats.completedAppointments > 0 
                    ? Math.round(stats.totalRevenue / stats.completedAppointments)
                    : 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Tabs */}
        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="revenue">الإيرادات</TabsTrigger>
            <TabsTrigger value="appointments">المواعيد</TabsTrigger>
            <TabsTrigger value="export">التصدير</TabsTrigger>
          </TabsList>

          {/* Revenue Chart */}
          <TabsContent value="revenue" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle>الإيرادات اليومية</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={[
                    { date: 'الأحد', revenue: 4000 },
                    { date: 'الاثنين', revenue: 3000 },
                    { date: 'الثلاثاء', revenue: 2000 },
                    { date: 'الأربعاء', revenue: 2780 },
                    { date: 'الخميس', revenue: 1890 },
                    { date: 'الجمعة', revenue: 2390 },
                    { date: 'السبت', revenue: 3490 },
                  ]}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Chart */}
          <TabsContent value="appointments" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle>توزيع المواعيد</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'مكتملة', value: stats.completedAppointments },
                        { name: 'ملغية', value: stats.cancelledAppointments },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Section */}
          <TabsContent value="export" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  تصدير التقارير
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="date_from">من تاريخ</Label>
                    <Input
                      id="date_from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date_to">إلى تاريخ</Label>
                    <Input
                      id="date_to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={exportReport} variant="medical" className="w-full">
                      <Download className="w-4 h-4 ml-2" />
                      تصدير CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;