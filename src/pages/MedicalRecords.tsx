import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Calendar, User, Stethoscope, Edit, Trash2, Eye, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  record_date: string;
  diagnosis: string;
  treatment?: string;
  prescription?: string;
  notes?: string;
  patients: {
    id: string;
    full_name: string;
    phone: string;
  };
  doctor_name?: string;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string;
}

interface Doctor {
  id: string;
  user_id: string;
  full_name?: string;
}

const MedicalRecords = () => {
  const permissions = usePermissions();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  const fetchRecords = async () => {
    try {
      // Fetch medical records with patients
      const { data: recordsData, error: recordsError } = await supabase
        .from('medical_records')
        .select(`
          *,
          patients (
            id,
            full_name,
            phone
          )
        `)
        .order('record_date', { ascending: false });

      if (recordsError) throw recordsError;

      // Fetch doctor profiles
      if (recordsData && recordsData.length > 0) {
        const doctorIds = [...new Set(recordsData.map(r => r.doctor_id))];
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

          const enrichedRecords = recordsData.map(record => ({
            ...record,
            doctor_name: doctorNameMap[record.doctor_id] || 'طبيب'
          }));

          setRecords(enrichedRecords);
        } else {
          setRecords(recordsData.map(r => ({ ...r, doctor_name: 'طبيب' })));
        }
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error('Error fetching medical records:', error);
      toast({ title: "خطأ", description: "فشل في تحميل السجلات الطبية", variant: "destructive" });
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .order('full_name');

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, user_id')
        .order('created_at');

      if (doctorsError) throw doctorsError;

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
      } else {
        setDoctors([]);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchPatients();
    fetchDoctors();
  }, []);

  // Real-time subscription
  useRealtimeSubscription({
    table: 'medical_records',
    onInsert: () => fetchRecords(),
    onUpdate: () => fetchRecords(),
    onDelete: () => fetchRecords(),
  });

  // --- Add Record Form ---
  const initialAddValues = {
    patient_id: '',
    doctor_id: '',
    record_date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    treatment: '',
    prescription: '',
    notes: '',
  };

  const validateAdd = (values: typeof initialAddValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.patient_id) errors.patient_id = 'يجب اختيار مريض.';
    if (!values.doctor_id) errors.doctor_id = 'يجب اختيار طبيب.';
    if (!values.diagnosis) errors.diagnosis = 'التشخيص مطلوب.';
    if (!values.record_date) errors.record_date = 'تاريخ السجل مطلوب.';
    return errors;
  };

  const handleAddRecord = async (values: typeof initialAddValues) => {
    try {
      const { error } = await supabase
        .from('medical_records')
        .insert([{
          patient_id: values.patient_id,
          doctor_id: values.doctor_id,
          record_date: values.record_date,
          diagnosis: values.diagnosis,
          treatment: values.treatment || null,
          prescription: values.prescription || null,
          notes: values.notes || null,
        }]);

      if (error) throw error;

      toast({ title: "نجح الإضافة", description: "تم إضافة السجل الطبي بنجاح" });
      setIsDialogOpen(false);
      addForm.resetForm();
    } catch (error: any) {
      console.error('Error adding record:', error);
      toast({ title: "خطأ", description: error.message || "فشل في إضافة السجل الطبي", variant: "destructive" });
    }
  };

  const addForm = useForm({
    initialValues: initialAddValues,
    onSubmit: handleAddRecord,
    validate: validateAdd,
  });

  // --- Edit Record Form ---
  const initialEditValues = useMemo(() => ({
    id: selectedRecord?.id || '',
    patient_id: selectedRecord?.patient_id || '',
    doctor_id: selectedRecord?.doctor_id || '',
    record_date: selectedRecord?.record_date || new Date().toISOString().split('T')[0],
    diagnosis: selectedRecord?.diagnosis || '',
    treatment: selectedRecord?.treatment || '',
    prescription: selectedRecord?.prescription || '',
    notes: selectedRecord?.notes || '',
  }), [selectedRecord]);

  const validateEdit = (values: typeof initialEditValues): FormErrors => {
    const errors: FormErrors = {};
    if (!values.diagnosis) errors.diagnosis = 'التشخيص مطلوب.';
    if (!values.record_date) errors.record_date = 'تاريخ السجل مطلوب.';
    return errors;
  };

  const handleEditRecord = async (values: typeof initialEditValues) => {
    try {
      const { error } = await supabase
        .from('medical_records')
        .update({
          diagnosis: values.diagnosis,
          treatment: values.treatment || null,
          prescription: values.prescription || null,
          notes: values.notes || null,
        })
        .eq('id', values.id);

      if (error) throw error;

      toast({ title: "تم التحديث", description: "تم تحديث السجل الطبي بنجاح" });
      setIsEditDialogOpen(false);
      setSelectedRecord(null);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل في تحديث السجل الطبي", variant: "destructive" });
    }
  };

  const editForm = useForm({
    initialValues: initialEditValues,
    onSubmit: handleEditRecord,
    validate: validateEdit,
  });

  useEffect(() => {
    if (selectedRecord) {
      editForm.setValues(initialEditValues);
    }
  }, [selectedRecord]);

  // --- Delete Record ---
  const handleDeleteRecord = async () => {
    if (!selectedRecord) return;

    try {
      const { error } = await supabase
        .from('medical_records')
        .delete()
        .eq('id', selectedRecord.id);

      if (error) throw error;

      toast({ title: "تم الحذف", description: "تم حذف السجل الطبي بنجاح" });
      setIsDeleteDialogOpen(false);
      setSelectedRecord(null);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل في حذف السجل الطبي", variant: "destructive" });
    }
  };

  // --- Search and Filter ---
  const { searchTerm, setSearchTerm, filteredData: searchedRecords } = useSearch(records, {
    fields: ['patients.full_name', 'patients.phone', 'doctor_name', 'diagnosis'],
    minChars: 0,
  });

  // --- DataTable Columns ---
  const columns: Column<MedicalRecord>[] = [
    {
      key: 'id',
      label: 'المريض',
      width: '25%',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {record.patients?.full_name?.split(' ')[0]?.[0] || 'م'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-foreground">{record.patients?.full_name}</h4>
            <p className="text-sm text-muted-foreground">{record.patients?.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'record_date',
      label: 'تاريخ السجل',
      width: '15%',
      render: (date) => new Date(date).toLocaleDateString('ar-SA'),
    },
    {
      key: 'diagnosis',
      label: 'التشخيص',
      width: '25%',
      render: (diagnosis) => <span className="line-clamp-2">{diagnosis || '-'}</span>,
    },
    {
      key: 'doctor_id',
      label: 'الطبيب',
      width: '20%',
      render: (_, record) => <span>د. {record.doctor_name}</span>,
    },
    {
      key: 'treatment',
      label: 'العلاج',
      width: '15%',
      render: (treatment) => <span className="line-clamp-2">{treatment || '-'}</span>,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-6">
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
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">السجلات الطبية</h1>
            <p className="text-muted-foreground mt-1">
              إدارة السجلات الطبية للمرضى ({records.length})
            </p>
          </div>
          {permissions.canCreateMedicalRecords && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="medical" className="w-full md:w-auto">
                  <Plus className="w-4 h-4 ml-2" />
                  سجل جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>إضافة سجل طبي جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={addForm.handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectField
                      label="المريض"
                      required
                      value={addForm.values.patient_id}
                      onValueChange={(value) => addForm.setFieldValue('patient_id', value)}
                      options={patients.map(p => ({ value: p.id, label: p.full_name }))}
                      error={addForm.errors.patient_id}
                      placeholder="اختر مريضًا"
                    />
                    <SelectField
                      label="الطبيب"
                      required
                      value={addForm.values.doctor_id}
                      onValueChange={(value) => addForm.setFieldValue('doctor_id', value)}
                      options={doctors.map(d => ({ value: d.id, label: `د. ${d.full_name}` }))}
                      error={addForm.errors.doctor_id}
                      placeholder="اختر طبيبًا"
                    />
                  </div>

                  <TextInput
                    label="تاريخ السجل"
                    required
                    type="date"
                    name="record_date"
                    value={addForm.values.record_date}
                    onChange={addForm.handleChange}
                    onBlur={addForm.handleBlur}
                    error={addForm.errors.record_date}
                  />

                  <TextAreaField
                    label="التشخيص"
                    required
                    name="diagnosis"
                    value={addForm.values.diagnosis}
                    onChange={addForm.handleChange}
                    onBlur={addForm.handleBlur}
                    error={addForm.errors.diagnosis}
                    placeholder="التشخيص الطبي..."
                  />

                  <TextAreaField
                    label="العلاج"
                    name="treatment"
                    value={addForm.values.treatment}
                    onChange={addForm.handleChange}
                    onBlur={addForm.handleBlur}
                    placeholder="خطة العلاج..."
                  />

                  <TextAreaField
                    label="الوصفة الطبية"
                    name="prescription"
                    value={addForm.values.prescription}
                    onChange={addForm.handleChange}
                    onBlur={addForm.handleBlur}
                    placeholder="الأدوية والجرعات..."
                  />

                  <TextAreaField
                    label="ملاحظات"
                    name="notes"
                    value={addForm.values.notes}
                    onChange={addForm.handleChange}
                    onBlur={addForm.handleBlur}
                    placeholder="ملاحظات إضافية..."
                  />

                  <DialogFooter>
                    <Button type="submit" variant="medical" disabled={addForm.isSubmitting}>
                      {addForm.isSubmitting ? "جاري الإضافة..." : "إضافة السجل"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <SearchBar
          placeholder="البحث في السجلات الطبية..."
          value={searchTerm}
          onChange={setSearchTerm}
        />

        {/* Data Table */}
        <Card className="card-gradient border-0 medical-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              السجلات الطبية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={searchedRecords}
              columns={columns}
              emptyMessage="لا توجد سجلات طبية"
              onRowClick={(record) => {
                setSelectedRecord(record);
                setIsViewDialogOpen(true);
              }}
            />
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تفاصيل السجل الطبي</DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">المريض</p>
                    <p className="font-medium">{selectedRecord.patients?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الطبيب</p>
                    <p className="font-medium">د. {selectedRecord.doctor_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">التاريخ</p>
                    <p className="font-medium">{new Date(selectedRecord.record_date).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">التشخيص</p>
                  <p className="font-medium">{selectedRecord.diagnosis}</p>
                </div>
                {selectedRecord.treatment && (
                  <div>
                    <p className="text-sm text-muted-foreground">العلاج</p>
                    <p className="font-medium">{selectedRecord.treatment}</p>
                  </div>
                )}
                {selectedRecord.prescription && (
                  <div>
                    <p className="text-sm text-muted-foreground">الوصفة الطبية</p>
                    <p className="font-medium">{selectedRecord.prescription}</p>
                  </div>
                )}
                {selectedRecord.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">ملاحظات</p>
                    <p className="font-medium">{selectedRecord.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تعديل السجل الطبي</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit} className="space-y-4">
              <TextAreaField
                label="التشخيص"
                required
                name="diagnosis"
                value={editForm.values.diagnosis}
                onChange={editForm.handleChange}
                onBlur={editForm.handleBlur}
                error={editForm.errors.diagnosis}
              />

              <TextAreaField
                label="العلاج"
                name="treatment"
                value={editForm.values.treatment}
                onChange={editForm.handleChange}
                onBlur={editForm.handleBlur}
              />

              <TextAreaField
                label="الوصفة الطبية"
                name="prescription"
                value={editForm.values.prescription}
                onChange={editForm.handleChange}
                onBlur={editForm.handleBlur}
              />

              <TextAreaField
                label="ملاحظات"
                name="notes"
                value={editForm.values.notes}
                onChange={editForm.handleChange}
                onBlur={editForm.handleBlur}
              />

              <DialogFooter>
                <Button type="submit" variant="medical" disabled={editForm.isSubmitting}>
                  {editForm.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleDeleteRecord}
          title="حذف السجل الطبي"
          description="هل أنت متأكد من حذف هذا السجل الطبي؟ لا يمكن التراجع عن هذا الإجراء."
          isDangerous
        />
      </div>
    </Layout>
  );
};

export default MedicalRecords;