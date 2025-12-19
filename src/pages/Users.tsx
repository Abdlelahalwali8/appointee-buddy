import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  UserCheck, Search, Plus, Mail, Phone, Shield, Edit, Trash2, 
  RefreshCw, Users as UsersIcon, Settings, Database, Activity,
  CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type UserRole = 'admin' | 'doctor' | 'receptionist' | 'patient';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  created_at: string;
}

interface RolePermission {
  id: string;
  role: UserRole;
  permission_name: string;
  is_allowed: boolean;
}

interface DataStats {
  patients: number;
  doctors: number;
  appointments: number;
  records: number;
  users: number;
}

const PERMISSIONS_LIST = [
  { key: 'view_dashboard', label: 'عرض لوحة التحكم' },
  { key: 'manage_appointments', label: 'إدارة المواعيد' },
  { key: 'manage_patients', label: 'إدارة المرضى' },
  { key: 'manage_doctors', label: 'إدارة الأطباء' },
  { key: 'view_medical_records', label: 'عرض السجلات الطبية' },
  { key: 'edit_medical_records', label: 'تعديل السجلات الطبية' },
  { key: 'view_reports', label: 'عرض التقارير' },
  { key: 'manage_settings', label: 'إدارة الإعدادات' },
  { key: 'manage_users', label: 'إدارة المستخدمين' },
  { key: 'delete_data', label: 'حذف البيانات' },
  { key: 'view_financials', label: 'عرض البيانات المالية' },
  { key: 'manage_waiting_list', label: 'إدارة قائمة الانتظار' },
];

const Users = () => {
  const permissions = usePermissions();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [dataStats, setDataStats] = useState<DataStats>({ patients: 0, doctors: 0, appointments: 0, records: 0, users: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'patient' as UserRole,
  });
  const [editUserData, setEditUserData] = useState({
    fullName: '',
    phone: '',
    email: '',
    role: 'patient' as UserRole,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const usersWithRoles = (profilesData || []).map(profile => {
        const userRole = rolesData?.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role as UserRole || 'patient'
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات المستخدمين",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRolePermissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true });

      if (error) throw error;
      setRolePermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  }, []);

  const fetchDataStats = useCallback(async () => {
    try {
      const [patientsRes, doctorsRes, appointmentsRes, recordsRes, usersRes] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('doctors').select('id', { count: 'exact', head: true }),
        supabase.from('appointments').select('id', { count: 'exact', head: true }),
        supabase.from('medical_records').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      setDataStats({
        patients: patientsRes.count || 0,
        doctors: doctorsRes.count || 0,
        appointments: appointmentsRes.count || 0,
        records: recordsRes.count || 0,
        users: usersRes.count || 0,
      });
      setLastSync(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRolePermissions();
    fetchDataStats();
  }, [fetchUsers, fetchRolePermissions, fetchDataStats]);

  // Real-time subscriptions
  useEffect(() => {
    const profilesChannel = supabase
      .channel('profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
        fetchDataStats();
      })
      .subscribe();

    const rolesChannel = supabase
      .channel('roles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        fetchUsers();
      })
      .subscribe();

    const permissionsChannel = supabase
      .channel('permissions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, () => {
        fetchRolePermissions();
      })
      .subscribe();

    const patientsChannel = supabase
      .channel('patients-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        fetchDataStats();
        toast({ title: "تحديث", description: "تم تحديث بيانات المرضى" });
      })
      .subscribe();

    const appointmentsChannel = supabase
      .channel('appointments-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchDataStats();
        toast({ title: "تحديث", description: "تم تحديث بيانات المواعيد" });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(rolesChannel);
      supabase.removeChannel(permissionsChannel);
      supabase.removeChannel(patientsChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [fetchUsers, fetchRolePermissions, fetchDataStats]);

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([fetchUsers(), fetchRolePermissions(), fetchDataStats()]);
      toast({
        title: "تم المزامنة",
        description: "تم تحديث جميع البيانات بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في المزامنة",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          data: {
            full_name: newUserData.fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase
          .from('profiles')
          .update({ phone: newUserData.phone })
          .eq('user_id', authData.user.id);

        await supabase
          .from('user_roles')
          .upsert({
            user_id: authData.user.id,
            role: newUserData.role,
          });

        // If role is doctor, create doctor entry
        if (newUserData.role === 'doctor') {
          await supabase.from('doctors').insert({
            user_id: authData.user.id,
            specialization: 'عام',
          });
        }
      }

      toast({
        title: "تم الإنشاء",
        description: "تم إنشاء المستخدم بنجاح",
      });

      setIsDialogOpen(false);
      setNewUserData({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'patient',
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء المستخدم",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editUserData.fullName,
          phone: editUserData.phone,
          email: editUserData.email,
        })
        .eq('user_id', selectedUser.user_id);

      if (profileError) throw profileError;

      // Update role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: selectedUser.user_id,
          role: editUserData.role,
        });

      if (roleError) throw roleError;

      toast({
        title: "تم التحديث",
        description: "تم تحديث بيانات المستخدم بنجاح",
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث بيانات المستخدم",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);

    try {
      // Delete from user_roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Delete profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف المستخدم بنجاح",
      });

      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حذف المستخدم",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole,
        });

      if (error) throw error;

      // If changing to doctor, create doctor entry
      if (newRole === 'doctor') {
        const { data: existingDoctor } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingDoctor) {
          await supabase.from('doctors').insert({
            user_id: userId,
            specialization: 'عام',
          });
        }
      }

      toast({
        title: "تم التحديث",
        description: "تم تحديث دور المستخدم بنجاح",
      });

      fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث دور المستخدم",
        variant: "destructive",
      });
    }
  };

  const updatePermission = async (role: UserRole, permissionName: string, isAllowed: boolean) => {
    try {
      const existingPermission = rolePermissions.find(
        p => p.role === role && p.permission_name === permissionName
      );

      if (existingPermission) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ is_allowed: isAllowed })
          .eq('id', existingPermission.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert({
            role,
            permission_name: permissionName,
            is_allowed: isAllowed,
          });

        if (error) throw error;
      }

      toast({
        title: "تم التحديث",
        description: "تم تحديث الصلاحية بنجاح",
      });

      fetchRolePermissions();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث الصلاحية",
        variant: "destructive",
      });
    }
  };

  const getPermissionValue = (role: UserRole, permissionName: string): boolean => {
    const permission = rolePermissions.find(
      p => p.role === role && p.permission_name === permissionName
    );
    
    // Default permissions based on role
    if (!permission) {
      if (role === 'admin') return true;
      if (role === 'doctor') {
        return ['view_dashboard', 'manage_appointments', 'view_medical_records', 'edit_medical_records'].includes(permissionName);
      }
      if (role === 'receptionist') {
        return ['view_dashboard', 'manage_appointments', 'manage_patients', 'manage_waiting_list'].includes(permissionName);
      }
      return false;
    }
    
    return permission.is_allowed;
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditUserData({
      fullName: user.full_name,
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || 'patient',
    });
    setIsEditDialogOpen(true);
  };

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'doctor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'receptionist':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'patient':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return 'مدير النظام';
      case 'doctor':
        return 'طبيب';
      case 'receptionist':
        return 'موظف استقبال';
      case 'patient':
        return 'مريض';
      default:
        return 'مستخدم';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone?.includes(searchTerm);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
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
            <h1 className="text-3xl font-bold text-foreground">لوحة الإدارة</h1>
            <p className="text-muted-foreground mt-1">
              إدارة المستخدمين والصلاحيات والبيانات
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSyncData}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              مزامنة
            </Button>
            {permissions.canManageUsers && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="medical" className="gap-2">
                    <Plus className="w-4 h-4" />
                    إضافة مستخدم
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="new-fullname">الاسم الكامل</Label>
                      <Input
                        id="new-fullname"
                        value={newUserData.fullName}
                        onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-email">البريد الإلكتروني</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">كلمة المرور</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newUserData.password}
                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        required
                        minLength={8}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-phone">رقم الهاتف</Label>
                      <Input
                        id="new-phone"
                        type="tel"
                        value={newUserData.phone}
                        onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-role">الدور</Label>
                      <Select
                        value={newUserData.role}
                        onValueChange={(value) => setNewUserData({ ...newUserData, role: value as UserRole })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="patient">مريض</SelectItem>
                          <SelectItem value="receptionist">موظف استقبال</SelectItem>
                          <SelectItem value="doctor">طبيب</SelectItem>
                          <SelectItem value="admin">مدير النظام</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" variant="medical" disabled={isSubmitting}>
                        {isSubmitting ? "جاري الإنشاء..." : "إنشاء المستخدم"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UsersIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{dataStats.users}</p>
                <p className="text-xs text-muted-foreground">مستخدم</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <UserCheck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{dataStats.doctors}</p>
                <p className="text-xs text-muted-foreground">طبيب</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{dataStats.patients}</p>
                <p className="text-xs text-muted-foreground">مريض</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Database className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{dataStats.appointments}</p>
                <p className="text-xs text-muted-foreground">موعد</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-gradient border-0 medical-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <CheckCircle className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{dataStats.records}</p>
                <p className="text-xs text-muted-foreground">سجل طبي</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users" className="gap-2">
              <UsersIcon className="w-4 h-4" />
              المستخدمين
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="w-4 h-4" />
              الصلاحيات
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <Database className="w-4 h-4" />
              البيانات
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            {/* Search and Filter */}
            <Card className="card-gradient border-0 medical-shadow">
              <CardContent className="p-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="البحث بالاسم أو البريد الإلكتروني..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-background min-w-[150px]"
                  >
                    <option value="all">جميع الأدوار</option>
                    <option value="admin">مدير النظام</option>
                    <option value="doctor">طبيب</option>
                    <option value="receptionist">موظف استقبال</option>
                    <option value="patient">مريض</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  قائمة المستخدمين ({filteredUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">لا توجد مستخدمين</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-accent/30 hover:bg-accent/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                            {user.full_name.split(' ')[0][0]}
                            {user.full_name.split(' ')[1]?.[0] || ''}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">
                              {user.full_name}
                            </h4>
                            <Badge className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {user.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {user.email}
                              </span>
                            )}
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {permissions.canManageUsers && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateUserRole(user.user_id, value as UserRole)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="patient">مريض</SelectItem>
                              <SelectItem value="receptionist">موظف استقبال</SelectItem>
                              <SelectItem value="doctor">طبيب</SelectItem>
                              <SelectItem value="admin">مدير النظام</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user.user_id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  إدارة صلاحيات الأدوار
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-3 px-4 font-semibold text-foreground">الصلاحية</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">مدير</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">طبيب</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">استقبال</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">مريض</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSIONS_LIST.map((perm) => (
                        <tr key={perm.key} className="border-b hover:bg-accent/30">
                          <td className="py-3 px-4 font-medium text-foreground">{perm.label}</td>
                          {(['admin', 'doctor', 'receptionist', 'patient'] as UserRole[]).map((role) => (
                            <td key={role} className="py-3 px-4 text-center">
                              <Switch
                                checked={getPermissionValue(role, perm.key)}
                                onCheckedChange={(checked) => updatePermission(role, perm.key, checked)}
                                disabled={role === 'admin'}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sync Tab */}
          <TabsContent value="sync" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  حالة البيانات والمزامنة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sync Status */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/20">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">المزامنة الفورية نشطة</p>
                      <p className="text-sm text-muted-foreground">
                        آخر تحديث: {lastSync?.toLocaleTimeString('ar-SA') || 'لم يتم'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSyncData}
                    disabled={isSyncing}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    تحديث الآن
                  </Button>
                </div>

                {/* Data Tables Status */}
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { name: 'المستخدمين', count: dataStats.users, icon: UsersIcon, color: 'text-primary' },
                    { name: 'الأطباء', count: dataStats.doctors, icon: UserCheck, color: 'text-blue-500' },
                    { name: 'المرضى', count: dataStats.patients, icon: Activity, color: 'text-green-500' },
                    { name: 'المواعيد', count: dataStats.appointments, icon: Database, color: 'text-amber-500' },
                    { name: 'السجلات الطبية', count: dataStats.records, icon: Shield, color: 'text-purple-500' },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                        <span className="font-medium text-foreground">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{item.count} سجل</Badge>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Realtime Channels */}
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-semibold text-foreground mb-3">قنوات المزامنة الفورية</h4>
                  <div className="flex flex-wrap gap-2">
                    {['profiles', 'user_roles', 'appointments', 'patients', 'doctors', 'medical_records'].map((channel) => (
                      <Badge key={channel} variant="outline" className="gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-fullname">الاسم الكامل</Label>
                <Input
                  id="edit-fullname"
                  value={editUserData.fullName}
                  onChange={(e) => setEditUserData({ ...editUserData, fullName: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">البريد الإلكتروني</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">رقم الهاتف</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editUserData.phone}
                  onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-role">الدور</Label>
                <Select
                  value={editUserData.role}
                  onValueChange={(value) => setEditUserData({ ...editUserData, role: value as UserRole })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">مريض</SelectItem>
                    <SelectItem value="receptionist">موظف استقبال</SelectItem>
                    <SelectItem value="doctor">طبيب</SelectItem>
                    <SelectItem value="admin">مدير النظام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" variant="medical" disabled={isSubmitting}>
                  {isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleDeleteUser}
          title="حذف المستخدم"
          description={`هل أنت متأكد من حذف المستخدم "${selectedUser?.full_name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
          isDangerous
        />
      </div>
    </Layout>
  );
};

export default Users;