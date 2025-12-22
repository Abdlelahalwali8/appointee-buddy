import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, Building, Clock, Bell, Shield, Save, DollarSign, AlertCircle, Users, Database, RefreshCw, Download, Upload, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import { TextInput, TextAreaField, SelectField } from '@/components/common/FormField';
import { useForm, FormErrors } from '@/hooks/useForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface CenterSettings {
  id: string;
  center_name: string;
  center_name_en?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  currency_code: string;
  currency_symbol: string;
  currency_name: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'doctor' | 'receptionist' | 'patient';
  profile?: {
    full_name: string;
    email: string;
  };
}

interface SyncStatus {
  table: string;
  count: number;
  lastSync: Date | null;
  status: 'synced' | 'syncing' | 'error';
}

const PERMISSIONS = [
  { key: 'view_dashboard', label: 'عرض لوحة التحكم' },
  { key: 'view_appointments', label: 'عرض المواعيد' },
  { key: 'manage_appointments', label: 'إدارة المواعيد' },
  { key: 'view_patients', label: 'عرض المرضى' },
  { key: 'manage_patients', label: 'إدارة المرضى' },
  { key: 'view_doctors', label: 'عرض الأطباء' },
  { key: 'manage_doctors', label: 'إدارة الأطباء' },
  { key: 'view_records', label: 'عرض السجلات الطبية' },
  { key: 'manage_records', label: 'إدارة السجلات الطبية' },
  { key: 'view_reports', label: 'عرض التقارير' },
  { key: 'manage_users', label: 'إدارة المستخدمين' },
  { key: 'manage_settings', label: 'إدارة الإعدادات' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير',
  doctor: 'طبيب',
  receptionist: 'استقبال',
  patient: 'مريض',
};

const Settings = () => {
  const permissions = usePermissions();
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  
  // Roles management
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  
  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Permissions management
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('center_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          center_name: data.center_name,
          center_name_en: data.center_name_en || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          logo_url: data.logo_url || '',
          working_hours_start: data.working_hours_start || '08:00',
          working_hours_end: data.working_hours_end || '17:00',
          working_days: data.working_days || ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
          currency_code: data.currency_code || 'SAR',
          currency_symbol: data.currency_symbol || 'ر.س',
          currency_name: data.currency_name || 'ريال سعودي',
        });
      } else {
        const defaultSettings = {
          center_name: 'المركز الطبي',
          center_name_en: 'Medical Center',
          phone: '',
          email: '',
          address: '',
          working_hours_start: '08:00',
          working_hours_end: '17:00',
          working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
          currency_code: 'SAR',
          currency_symbol: 'ر.س',
          currency_name: 'ريال سعودي',
        };

        const { data: newSettings, error: insertError } = await supabase
          .from('center_settings')
          .insert([defaultSettings])
          .select()
          .single();

        if (insertError) throw insertError;
        
        setSettings({
          ...newSettings,
          phone: newSettings.phone || '',
          email: newSettings.email || '',
          address: newSettings.address || '',
          logo_url: newSettings.logo_url || '',
          working_hours_start: newSettings.working_hours_start || '08:00',
          working_hours_end: newSettings.working_hours_end || '17:00',
          working_days: newSettings.working_days || [],
          currency_code: newSettings.currency_code || 'SAR',
          currency_symbol: newSettings.currency_symbol || 'ر.س',
          currency_name: newSettings.currency_name || 'ريال سعودي',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({ title: "خطأ", description: "فشل في تحميل الإعدادات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRoles = async () => {
    setRolesLoading(true);
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = roles?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const rolesWithProfiles = roles?.map(role => ({
        ...role,
        profile: profiles?.find(p => p.user_id === role.user_id)
      })) || [];

      setUserRoles(rolesWithProfiles);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setRolesLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role');

      if (error) throw error;
      setRolePermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchSyncStatus = async () => {
    const tables = ['appointments', 'patients', 'doctors', 'medical_records', 'notifications', 'profiles'];
    const statuses: SyncStatus[] = [];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        statuses.push({
          table,
          count: count || 0,
          lastSync: new Date(),
          status: error ? 'error' : 'synced'
        });
      } catch {
        statuses.push({
          table,
          count: 0,
          lastSync: null,
          status: 'error'
        });
      }
    }

    setSyncStatus(statuses);
  };

  useEffect(() => {
    fetchSettings();
    if (isAdmin) {
      fetchUserRoles();
      fetchRolePermissions();
      fetchSyncStatus();
    }
  }, [isAdmin]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: "تم التحديث", description: "تم تحديث دور المستخدم بنجاح" });
      fetchUserRoles();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const handleTogglePermission = async (role: string, permissionName: string, currentValue: boolean) => {
    try {
      const existing = rolePermissions.find(p => p.role === role && p.permission_name === permissionName);
      
      if (existing) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ is_allowed: !currentValue })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert({ role, permission_name: permissionName, is_allowed: !currentValue });
        if (error) throw error;
      }

      toast({ title: "تم التحديث", description: "تم تحديث الصلاحية بنجاح" });
      fetchRolePermissions();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await fetchSyncStatus();
      toast({ title: "تم المزامنة", description: "تم مزامنة جميع البيانات بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في المزامنة", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedData = async () => {
    try {
      // Seed sample data
      toast({ title: "جاري الزرع", description: "جاري زرع البيانات التجريبية..." });
      
      // Add sample patients
      const { error: patientsError } = await supabase.from('patients').insert([
        { full_name: 'مريض تجريبي 1', phone: '0501234567', email: 'test1@example.com', gender: 'male', age: 30 },
        { full_name: 'مريض تجريبي 2', phone: '0507654321', email: 'test2@example.com', gender: 'female', age: 25 },
      ]);

      if (patientsError) throw patientsError;

      toast({ title: "تم الزرع", description: "تم زرع البيانات التجريبية بنجاح" });
      fetchSyncStatus();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const initialValues = {
    center_name: settings?.center_name || '',
    center_name_en: settings?.center_name_en || '',
    phone: settings?.phone || '',
    email: settings?.email || '',
    address: settings?.address || '',
    working_hours_start: settings?.working_hours_start || '08:00',
    working_hours_end: settings?.working_hours_end || '17:00',
    currency_code: settings?.currency_code || 'SAR',
    currency_symbol: settings?.currency_symbol || 'ر.س',
    currency_name: settings?.currency_name || 'ريال سعودي',
  };

  const validateSettings = (values: typeof initialValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.center_name) errors.center_name = 'اسم المركز مطلوب.';
    return errors;
  };

  const handleSaveSettings = async (values: typeof initialValues) => {
    try {
      if (!settings?.id) throw new Error('معرف الإعدادات غير موجود.');

      const { error } = await supabase
        .from('center_settings')
        .update({
          center_name: values.center_name,
          center_name_en: values.center_name_en,
          phone: values.phone,
          email: values.email,
          address: values.address,
          working_hours_start: values.working_hours_start,
          working_hours_end: values.working_hours_end,
          currency_code: values.currency_code,
          currency_symbol: values.currency_symbol,
          currency_name: values.currency_name,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات بنجاح" });
      fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({ title: "خطأ", description: error.message || "فشل في حفظ الإعدادات", variant: "destructive" });
    }
  };

  const form = useForm({
    initialValues,
    onSubmit: handleSaveSettings,
    validate: validateSettings,
  });

  useEffect(() => {
    if (settings) {
      form.setValues({
        center_name: settings.center_name,
        center_name_en: settings.center_name_en || '',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || '',
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
        currency_code: settings.currency_code,
        currency_symbol: settings.currency_symbol,
        currency_name: settings.currency_name,
      });
    }
  }, [settings]);

  const getPermissionValue = (role: string, permissionName: string): boolean => {
    const perm = rolePermissions.find(p => p.role === role && p.permission_name === permissionName);
    return perm?.is_allowed ?? false;
  };

  const getTableLabel = (table: string): string => {
    const labels: Record<string, string> = {
      appointments: 'المواعيد',
      patients: 'المرضى',
      doctors: 'الأطباء',
      medical_records: 'السجلات الطبية',
      notifications: 'الإشعارات',
      profiles: 'الملفات الشخصية',
    };
    return labels[table] || table;
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!permissions.canViewSettings) {
    return (
      <Layout>
        <div className="p-4 md:p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              ليس لديك صلاحية للوصول إلى الإعدادات. يرجى التواصل مع المسؤول.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-primary" />
            الإعدادات
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة إعدادات المركز الطبي والصلاحيات والمزامنة
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-3'}`}>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              <span className="hidden sm:inline">عام</span>
            </TabsTrigger>
            <TabsTrigger value="working" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">الدوام</span>
            </TabsTrigger>
            <TabsTrigger value="currency" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">العملة</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="roles" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">الأدوار</span>
                </TabsTrigger>
                <TabsTrigger value="sync" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">المزامنة</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card className="medical-shadow">
              <CardHeader>
                <CardTitle>بيانات المركز الأساسية</CardTitle>
                <CardDescription>
                  معلومات المركز الطبي والتواصل
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      label="اسم المركز (عربي)"
                      required
                      name="center_name"
                      value={form.values.center_name}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                      error={form.errors.center_name}
                    />
                    <TextInput
                      label="اسم المركز (إنجليزي)"
                      name="center_name_en"
                      value={form.values.center_name_en}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                    />
                    <TextInput
                      label="رقم الهاتف"
                      name="phone"
                      value={form.values.phone}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                    />
                    <TextInput
                      label="البريد الإلكتروني"
                      type="email"
                      name="email"
                      value={form.values.email}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                    />
                  </div>
                  <TextAreaField
                    label="العنوان"
                    name="address"
                    value={form.values.address}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                  />
                  <Button type="submit" variant="medical" disabled={form.isSubmitting || !permissions.canManageSettings} className="w-full md:w-auto">
                    <Save className="w-4 h-4 ml-2" />
                    {form.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Working Hours */}
          <TabsContent value="working" className="space-y-4">
            <Card className="medical-shadow">
              <CardHeader>
                <CardTitle>ساعات العمل</CardTitle>
                <CardDescription>
                  تحديد ساعات عمل المركز الطبي
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      label="بداية الدوام"
                      type="time"
                      name="working_hours_start"
                      value={form.values.working_hours_start}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                    />
                    <TextInput
                      label="نهاية الدوام"
                      type="time"
                      name="working_hours_end"
                      value={form.values.working_hours_end}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                    />
                  </div>
                  <Button type="submit" variant="medical" disabled={form.isSubmitting || !permissions.canManageSettings} className="w-full md:w-auto">
                    <Save className="w-4 h-4 ml-2" />
                    {form.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Currency Settings */}
          <TabsContent value="currency" className="space-y-4">
            <Card className="medical-shadow">
              <CardHeader>
                <CardTitle>إعدادات العملة</CardTitle>
                <CardDescription>
                  تحديد العملة المستخدمة في النظام
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <TextInput
                      label="رمز العملة"
                      name="currency_code"
                      value={form.values.currency_code}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                      placeholder="مثال: SAR"
                    />
                    <TextInput
                      label="رمز العملة"
                      name="currency_symbol"
                      value={form.values.currency_symbol}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                      placeholder="مثال: ر.س"
                    />
                    <TextInput
                      label="اسم العملة"
                      name="currency_name"
                      value={form.values.currency_name}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                      placeholder="مثال: ريال سعودي"
                    />
                  </div>
                  <Button type="submit" variant="medical" disabled={form.isSubmitting || !permissions.canManageSettings} className="w-full md:w-auto">
                    <Save className="w-4 h-4 ml-2" />
                    {form.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles & Permissions (Admin Only) */}
          {isAdmin && (
            <TabsContent value="roles" className="space-y-4">
              {/* User Roles Management */}
              <Card className="medical-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    إدارة أدوار المستخدمين
                  </CardTitle>
                  <CardDescription>
                    تعديل أدوار المستخدمين في النظام
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rolesLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-muted rounded"></div>
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">البريد</TableHead>
                          <TableHead className="text-right">الدور الحالي</TableHead>
                          <TableHead className="text-right">تغيير الدور</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userRoles.map((userRole) => (
                          <TableRow key={userRole.id}>
                            <TableCell className="font-medium">
                              {userRole.profile?.full_name || 'غير محدد'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {userRole.profile?.email || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={userRole.role === 'admin' ? 'default' : 'secondary'}>
                                {ROLE_LABELS[userRole.role]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <select
                                value={userRole.role}
                                onChange={(e) => handleUpdateRole(userRole.user_id, e.target.value)}
                                className="border rounded p-1 text-sm bg-background"
                              >
                                <option value="admin">مدير</option>
                                <option value="doctor">طبيب</option>
                                <option value="receptionist">استقبال</option>
                                <option value="patient">مريض</option>
                              </select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Permissions Matrix */}
              <Card className="medical-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    مصفوفة الصلاحيات
                  </CardTitle>
                  <CardDescription>
                    تحديد صلاحيات كل دور
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الصلاحية</TableHead>
                        <TableHead className="text-center">مدير</TableHead>
                        <TableHead className="text-center">طبيب</TableHead>
                        <TableHead className="text-center">استقبال</TableHead>
                        <TableHead className="text-center">مريض</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSIONS.map((perm) => (
                        <TableRow key={perm.key}>
                          <TableCell className="font-medium">{perm.label}</TableCell>
                          {['admin', 'doctor', 'receptionist', 'patient'].map((role) => (
                            <TableCell key={role} className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTogglePermission(role, perm.key, getPermissionValue(role, perm.key))}
                                className={getPermissionValue(role, perm.key) ? 'text-success' : 'text-muted-foreground'}
                              >
                                {getPermissionValue(role, perm.key) ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Sync & Data (Admin Only) */}
          {isAdmin && (
            <TabsContent value="sync" className="space-y-4">
              {/* Sync Status */}
              <Card className="medical-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        حالة المزامنة
                      </CardTitle>
                      <CardDescription>
                        عرض حالة مزامنة البيانات مع قاعدة البيانات السحابية
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleSyncAll} disabled={isSyncing}>
                      <RefreshCw className={`w-4 h-4 ml-2 ${isSyncing ? 'animate-spin' : ''}`} />
                      مزامنة الكل
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {syncStatus.map((status) => (
                      <div key={status.table} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            status.status === 'synced' ? 'bg-success' :
                            status.status === 'syncing' ? 'bg-warning animate-pulse' :
                            'bg-destructive'
                          }`}></div>
                          <div>
                            <p className="font-medium">{getTableLabel(status.table)}</p>
                            <p className="text-xs text-muted-foreground">
                              {status.lastSync ? `آخر تحديث: ${status.lastSync.toLocaleTimeString('ar-SA')}` : 'لم تتم المزامنة'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">{status.count} سجل</Badge>
                          <Badge variant={status.status === 'synced' ? 'default' : status.status === 'error' ? 'destructive' : 'secondary'}>
                            {status.status === 'synced' ? 'متزامن' : status.status === 'syncing' ? 'جاري...' : 'خطأ'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Seeding */}
              <Card className="medical-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    زرع البيانات
                  </CardTitle>
                  <CardDescription>
                    إضافة بيانات تجريبية للنظام
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      سيتم إضافة بيانات تجريبية للمرضى والمواعيد. استخدم هذه الميزة للاختبار فقط.
                    </AlertDescription>
                  </Alert>
                  <Button variant="outline" onClick={handleSeedData}>
                    <Upload className="w-4 h-4 ml-2" />
                    زرع بيانات تجريبية
                  </Button>
                </CardContent>
              </Card>

              {/* Database Info */}
              <Card className="medical-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    معلومات قاعدة البيانات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {syncStatus.reduce((sum, s) => sum + s.count, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">إجمالي السجلات</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-success">{syncStatus.length}</p>
                      <p className="text-sm text-muted-foreground">الجداول</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {syncStatus.filter(s => s.status === 'synced').length}
                      </p>
                      <p className="text-sm text-muted-foreground">متزامن</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <Badge variant="outline" className="text-lg">
                        Cloud
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">نوع القاعدة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
