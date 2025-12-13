import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Plus, Phone, Mail, Clock, DollarSign, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import Layout from '@/components/layout/Layout';
import SearchBar from '@/components/common/SearchBar';
import { useSearch } from '@/hooks/useSearch';
import DataTable, { Column } from '@/components/common/DataTable';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useForm, FormErrors } from '@/hooks/useForm';
import { TextInput, TextAreaField, SelectField } from '@/components/common/FormField';
import { useCurrency } from '@/hooks/useCurrency';

interface Doctor {
  id: string;
  user_id: string;
  specialization: string;
  license_number?: string;
  consultation_fee: number;
  return_consultation_fee: number;
  working_days: string[];
  working_hours_start: string;
  working_hours_end: string;
  bio?: string;
  experience_years: number;
  is_available: boolean;
}

const Doctors = () => {
  const permissions = usePermissions();
  const { formatCurrency } = useCurrency();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({ title: "خطأ", description: "فشل في تحميل بيانات الأطباء", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useRealtimeSubscription({
    table: 'doctors',
    onInsert: () => fetchDoctors(),
    onUpdate: () => fetchDoctors(),
    onDelete: () => fetchDoctors(),
  });

  const initialAddValues = {
    specialization: '',
    license_number: '',
    consultation_fee: 0,
    return_consultation_fee: 0,
    working_hours_start: '08:00',
    working_hours_end: '17:00',
    bio: '',
    experience_years: 0,
  };

  const validateAdd = (values: typeof initialAddValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.specialization) errors.specialization = 'التخصص مطلوب.';
    if (values.consultation_fee < 0) errors.consultation_fee = 'الرسوم لا يمكن أن تكون سالبة.';
    return errors;
  };

  const handleAddDoctor = async (values: typeof initialAddValues) => {
    toast({
      title: "تنبيه",
      description: "لإضافة طبيب جديد، يجب أولاً إنشاء حساب مستخدم له",
      variant: "destructive",
    });
    setIsDialogOpen(false);
  };

  const addForm = useForm({
    initialValues: initialAddValues,
    onSubmit: handleAddDoctor,
    validate: validateAdd,
  });

  const initialEditValues = useMemo(() => ({
    id: selectedDoctor?.id || '',
    specialization: selectedDoctor?.specialization || '',
    license_number: selectedDoctor?.license_number || '',
    consultation_fee: selectedDoctor?.consultation_fee || 0,
    return_consultation_fee: selectedDoctor?.return_consultation_fee || 0,
    working_hours_start: selectedDoctor?.working_hours_start || '08:00',
    working_hours_end: selectedDoctor?.working_hours_end || '17:00',
    bio: selectedDoctor?.bio || '',
    experience_years: selectedDoctor?.experience_years || 0,
  }), [selectedDoctor]);

  const validateEdit = (values: typeof initialEditValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.specialization) errors.specialization = 'التخصص مطلوب.';
    if (values.consultation_fee < 0) errors.consultation_fee = 'الرسوم لا يمكن أن تكون سالبة.';
    return errors;
  };

  const handleEditDoctor = async (values: typeof initialEditValues) => {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({
          specialization: values.specialization,
          license_number: values.license_number || null,
          consultation_fee: values.consultation_fee,
          return_consultation_fee: values.return_consultation_fee,
          working_hours_start: values.working_hours_start,
          working_hours_end: values.working_hours_end,
          bio: values.bio || null,
          experience_years: values.experience_years,
        })
        .eq('id', values.id);

      if (error) throw error;

      toast({ title: "تم التحديث", description: "تم تحديث بيانات الطبيب بنجاح" });
      setIsEditDialogOpen(false);
      setSelectedDoctor(null);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل في تحديث بيانات الطبيب", variant: "destructive" });
    }
  };

  const editForm = useForm({
    initialValues: initialEditValues,
    onSubmit: handleEditDoctor,
    validate: validateEdit,
  });

  useEffect(() => {
    if (selectedDoctor) {
      editForm.setValues(initialEditValues);
    }
  }, [selectedDoctor]);

  const handleDeleteDoctor = async () => {
    if (!selectedDoctor) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', selectedDoctor.id);

      if (error) throw error;

      toast({ title: "تم الحذف", description: "تم حذف الطبيب بنجاح" });
      setIsDeleteDialogOpen(false);
      setSelectedDoctor(null);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل في حذف الطبيب", variant: "destructive" });
    }
  };

  const toggleDoctorAvailability = async (doctor: Doctor) => {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_available: !doctor.is_available })
        .eq('id', doctor.id);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: `تم ${!doctor.is_available ? 'تفعيل' : 'إلغاء تفعيل'} الطبيب`,
      });
    } catch (error) {
      console.error('Error updating doctor availability:', error);
      toast({ title: "خطأ", description: "فشل في تحديث حالة الطبيب", variant: "destructive" });
    }
  };

  const { searchTerm, setSearchTerm, filteredData: searchedDoctors } = useSearch(doctors, {
    fields: ['specialization'],
    minChars: 0,
  });

  const columns: Column<Doctor>[] = [
    {
      key: 'specialization',
      label: 'التخصص',
      width: '25%',
      render: (specialization) => <Badge variant="secondary">{specialization}</Badge>,
    },
    {
      key: 'consultation_fee',
      label: 'رسوم الكشف',
      width: '20%',
      render: (fee) => <span className="font-medium text-primary">{formatCurrency(fee)}</span>,
    },
    {
      key: 'is_available',
      label: 'الحالة',
      width: '15%',
      render: (is_available) => (
        <Badge variant={is_available ? "default" : "destructive"}>
          {is_available ? "متاح" : "غير متاح"}
        </Badge>
      ),
    },
    {
      key: 'experience_years',
      label: 'الخبرة',
      width: '15%',
      render: (years) => <span>{years} سنوات</span>,
    },
  ];

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

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">إدارة الأطباء</h1>
            <p className="text-muted-foreground mt-1">
              إدارة بيانات الأطباء وتخصصاتهم ({doctors.length})
            </p>
          </div>
          {permissions.canManageDoctors && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="medical" className="w-full md:w-auto">
                  <Plus className="w-4 h-4 ml-2" />
                  طبيب جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>إضافة طبيب جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={addForm.handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      label="التخصص"
                      required
                      name="specialization"
                      value={addForm.values.specialization}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                      error={addForm.errors.specialization}
                    />
                    <TextInput
                      label="رقم الترخيص"
                      name="license_number"
                      value={addForm.values.license_number}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                    />
                    <TextInput
                      label="رسوم الكشف"
                      type="number"
                      name="consultation_fee"
                      value={addForm.values.consultation_fee.toString()}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                      error={addForm.errors.consultation_fee}
                    />
                    <TextInput
                      label="رسوم العودة"
                      type="number"
                      name="return_consultation_fee"
                      value={addForm.values.return_consultation_fee.toString()}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                    />
                    <TextInput
                      label="بداية الدوام"
                      type="time"
                      name="working_hours_start"
                      value={addForm.values.working_hours_start}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                    />
                    <TextInput
                      label="نهاية الدوام"
                      type="time"
                      name="working_hours_end"
                      value={addForm.values.working_hours_end}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                    />
                    <TextInput
                      label="سنوات الخبرة"
                      type="number"
                      name="experience_years"
                      value={addForm.values.experience_years.toString()}
                      onChange={addForm.handleChange}
                      onBlur={addForm.handleBlur}
                    />
                  </div>
                  <TextAreaField
                    label="نبذة عن الطبيب"
                    name="bio"
                    value={addForm.values.bio}
                    onChange={addForm.handleChange}
                    onBlur={addForm.handleBlur}
                    placeholder="خبرات، شهادات، تخصصات فرعية..."
                  />
                  <DialogFooter>
                    <Button type="submit" variant="medical" disabled={addForm.isSubmitting}>
                      {addForm.isSubmitting ? "جاري الإضافة..." : "إضافة الطبيب"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ابحث عن طبيب..."
        />

        <Card className="card-gradient border-0 medical-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              الأطباء ({searchedDoctors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={searchedDoctors}
              emptyMessage="لا يوجد أطباء"
              onRowClick={(doctor) => {
                setSelectedDoctor(doctor);
                setIsEditDialogOpen(true);
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تعديل بيانات الطبيب</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="التخصص"
                  required
                  name="specialization"
                  value={editForm.values.specialization}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                  error={editForm.errors.specialization}
                />
                <TextInput
                  label="رقم الترخيص"
                  name="license_number"
                  value={editForm.values.license_number}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                />
                <TextInput
                  label="رسوم الكشف"
                  type="number"
                  name="consultation_fee"
                  value={editForm.values.consultation_fee.toString()}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                  error={editForm.errors.consultation_fee}
                />
                <TextInput
                  label="رسوم العودة"
                  type="number"
                  name="return_consultation_fee"
                  value={editForm.values.return_consultation_fee.toString()}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                />
                <TextInput
                  label="بداية الدوام"
                  type="time"
                  name="working_hours_start"
                  value={editForm.values.working_hours_start}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                />
                <TextInput
                  label="نهاية الدوام"
                  type="time"
                  name="working_hours_end"
                  value={editForm.values.working_hours_end}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                />
                <TextInput
                  label="سنوات الخبرة"
                  type="number"
                  name="experience_years"
                  value={editForm.values.experience_years.toString()}
                  onChange={editForm.handleChange}
                  onBlur={editForm.handleBlur}
                />
              </div>
              <TextAreaField
                label="نبذة عن الطبيب"
                name="bio"
                value={editForm.values.bio}
                onChange={editForm.handleChange}
                onBlur={editForm.handleBlur}
              />
              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف
                </Button>
                <Button type="submit" variant="medical" disabled={editForm.isSubmitting}>
                  {editForm.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title="تأكيد الحذف"
          description="هل أنت متأكد من حذف هذا الطبيب؟ لا يمكن التراجع عن هذا الإجراء."
          onConfirm={handleDeleteDoctor}
          confirmText="حذف"
          cancelText="إلغاء"
        />
      </div>
    </Layout>
  );
};

export default Doctors;
