import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Search, Plus, Mail, Phone, Shield, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
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

const Users = () => {
  const permissions = usePermissions();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'patient' as UserRole,
  });

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Combine data
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
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Real-time subscription
  useRealtimeSubscription({
    table: 'profiles',
    onInsert: () => fetchUsers(),
    onUpdate: () => fetchUsers(),
    onDelete: () => fetchUsers(),
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create auth user
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
        // Update profile with phone
        await supabase
          .from('profiles')
          .update({ phone: newUserData.phone })
          .eq('user_id', authData.user.id);

        // Update user_roles
        await supabase
          .from('user_roles')
          .upsert({
            user_id: authData.user.id,
            role: newUserData.role,
          });
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

  const handleEditUser = async (user: UserProfile) => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: user.full_name,
          phone: user.phone,
          email: user.email,
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تحديث بيانات المستخدم بنجاح",
      });

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

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'doctor':
        return 'bg-blue-100 text-blue-800';
      case 'receptionist':
        return 'bg-green-100 text-green-800';
      case 'patient':
        return 'bg-gray-100 text-gray-800';
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
            <h1 className="text-3xl font-bold text-foreground">إدارة المستخدمين</h1>
            <p className="text-muted-foreground mt-1">
              إدارة حسابات وصلاحيات المستخدمين
            </p>
          </div>
          {permissions.canManageUsers && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="medical" className="gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة مستخدم جديد
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

        {/* Search and Filter */}
        <Card className="card-gradient border-0 medical-shadow">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="البحث بالاسم أو البريد الإلكتروني أو رقم الهاتف..."
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
                  className="flex items-center justify-between p-4 rounded-lg bg-accent/30 hover:bg-accent/50 transition-smooth"
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
                        <span className="text-xs">
                          منذ {new Date(user.created_at).toLocaleDateString('ar-SA')}
                        </span>
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
                        variant="destructive"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

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