import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Settings, Database, FileText, Users, Stethoscope, Calendar, Activity, Plus, Edit, Trash2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import Layout from '@/components/layout/Layout';
import DataTable from '@/components/common/DataTable';

const SystemManagement = () => {
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState('specializations');
  const [loading, setLoading] = useState(false);

  // Specializations State
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [newSpecialization, setNewSpecialization] = useState({ name: '', name_en: '', description: '' });
  const [editingSpecialization, setEditingSpecialization] = useState<any>(null);

  // Appointment Types State
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([]);
  const [newAppointmentType, setNewAppointmentType] = useState({ name: '', name_en: '', duration_minutes: 30 });

  // Diagnosis Templates State
  const [diagnosisTemplates, setDiagnosisTemplates] = useState<any[]>([]);
  const [newDiagnosis, setNewDiagnosis] = useState({ name: '', content: '', category: '' });

  // Treatment Templates State
  const [treatmentTemplates, setTreatmentTemplates] = useState<any[]>([]);
  const [newTreatment, setNewTreatment] = useState({ name: '', content: '', category: '' });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      fetchSpecializations(),
      fetchAppointmentTypes(),
      fetchDiagnosisTemplates(),
      fetchTreatmentTemplates(),
    ]);
  };

  const fetchSpecializations = async () => {
    try {
      const { data, error } = await supabase
        .from('specializations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setSpecializations(data || []);
    } catch (error) {
      console.error('Error fetching specializations:', error);
    }
  };

  const fetchAppointmentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setAppointmentTypes(data || []);
    } catch (error) {
      console.error('Error fetching appointment types:', error);
    }
  };

  const fetchDiagnosisTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('diagnosis_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setDiagnosisTemplates(data || []);
    } catch (error) {
      console.error('Error fetching diagnosis templates:', error);
    }
  };

  const fetchTreatmentTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('treatment_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setTreatmentTemplates(data || []);
    } catch (error) {
      console.error('Error fetching treatment templates:', error);
    }
  };

  const addSpecialization = async () => {
    if (!newSpecialization.name.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم التخصص",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('specializations')
        .insert([newSpecialization]);

      if (error) throw error;

      setNewSpecialization({ name: '', name_en: '', description: '' });
      toast({
        title: "تم الإضافة",
        description: "تم إضافة التخصص بنجاح",
      });
      fetchSpecializations();
    } catch (error) {
      console.error('Error adding specialization:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة التخصص",
        variant: "destructive",
      });
    }
  };

  const updateSpecialization = async () => {
    if (!editingSpecialization) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .update({ specialization: editingSpecialization.new })
        .eq('specialization', editingSpecialization.old);

      if (error) throw error;

      setSpecializations(specializations.map(s => 
        s === editingSpecialization.old ? editingSpecialization.new : s
      ));
      setEditingSpecialization(null);
      
      toast({
        title: "تم التحديث",
        description: "تم تحديث التخصص بنجاح",
      });

      fetchSpecializations();
    } catch (error) {
      console.error('Error updating specialization:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث التخصص",
        variant: "destructive",
      });
    }
  };

  const deleteSpecialization = async (specialization: string) => {
    try {
      const { data: doctorsWithSpec } = await supabase
        .from('doctors')
        .select('id')
        .eq('specialization', specialization);

      if (doctorsWithSpec && doctorsWithSpec.length > 0) {
        toast({
          title: "تحذير",
          description: `لا يمكن حذف التخصص. يوجد ${doctorsWithSpec.length} طبيب مرتبط به`,
          variant: "destructive",
        });
        return;
      }

      setSpecializations(specializations.filter(s => s !== specialization));
      
      toast({
        title: "تم الحذف",
        description: "تم حذف التخصص بنجاح",
      });
    } catch (error) {
      console.error('Error deleting specialization:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف التخصص",
        variant: "destructive",
      });
    }
  };


  const addDiagnosisTemplate = async () => {
    if (!newDiagnosis.name.trim() || !newDiagnosis.content.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال جميع البيانات",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('diagnosis_templates')
        .insert([newDiagnosis]);

      if (error) throw error;

      setNewDiagnosis({ name: '', content: '', category: '' });
      toast({
        title: "تم الإضافة",
        description: "تم إضافة قالب التشخيص بنجاح",
      });
      fetchDiagnosisTemplates();
    } catch (error) {
      console.error('Error adding diagnosis template:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة قالب التشخيص",
        variant: "destructive",
      });
    }
  };

  const addTreatmentTemplate = async () => {
    if (!newTreatment.name.trim() || !newTreatment.content.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال جميع البيانات",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('treatment_templates')
        .insert([newTreatment]);

      if (error) throw error;

      setNewTreatment({ name: '', content: '', category: '' });
      toast({
        title: "تم الإضافة",
        description: "تم إضافة قالب العلاج بنجاح",
      });
      fetchTreatmentTemplates();
    } catch (error) {
      console.error('Error adding treatment template:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة قالب العلاج",
        variant: "destructive",
      });
    }
  };

  const addAppointmentType = async () => {
    if (!newAppointmentType.name.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم نوع الموعد",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('appointment_types')
        .insert([newAppointmentType]);

      if (error) throw error;

      setNewAppointmentType({ name: '', name_en: '', duration_minutes: 30 });
      toast({
        title: "تم الإضافة",
        description: "تم إضافة نوع الموعد بنجاح",
      });
      fetchAppointmentTypes();
    } catch (error) {
      console.error('Error adding appointment type:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة نوع الموعد",
        variant: "destructive",
      });
    }
  };

  if (!permissions.canManageSettings) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">غير مصرح</h3>
              <p className="text-muted-foreground">ليس لديك صلاحية الوصول لإدارة النظام</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              إدارة النظام
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة البيانات الأساسية والقوالب والإعدادات العامة
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2">
            <TabsTrigger value="specializations" className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              التخصصات
            </TabsTrigger>
            <TabsTrigger value="appointment-types" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              أنواع المواعيد
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              قوالب التشخيص
            </TabsTrigger>
            <TabsTrigger value="treatment" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              قوالب العلاج
            </TabsTrigger>
          </TabsList>

          {/* Specializations Tab */}
          <TabsContent value="specializations" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  إدارة التخصصات الطبية
                </CardTitle>
                <CardDescription>
                  إضافة وتعديل التخصصات الطبية المتاحة في النظام
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add New Specialization */}
                <div className="flex gap-2">
                  <Input
                    placeholder="أدخل تخصص جديد..."
                    value={newSpecialization.name}
                    onChange={(e) => setNewSpecialization({ ...newSpecialization, name: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addSpecialization()}
                  />
                  <Button onClick={addSpecialization} variant="medical">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة
                  </Button>
                </div>

                {/* Specializations List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {specializations.map((spec) => (
                    <Card key={spec} className="p-4 bg-accent/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-primary" />
                          <span className="font-medium">{spec}</span>
                        </div>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingSpecialization({ old: spec, new: spec })}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>تعديل التخصص</DialogTitle>
                                <DialogDescription>
                                  تحديث اسم التخصص الطبي
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>اسم التخصص الجديد</Label>
                                  <Input
                                    value={editingSpecialization?.new || ''}
                                    onChange={(e) => setEditingSpecialization(prev => 
                                      prev ? { ...prev, new: e.target.value } : null
                                    )}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingSpecialization(null)}>
                                  إلغاء
                                </Button>
                                <Button variant="medical" onClick={updateSpecialization}>
                                  حفظ
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف التخصص "{spec}"؟ لا يمكن التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSpecialization(spec)}>
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {specializations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Stethoscope className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد تخصصات. ابدأ بإضافة التخصصات الطبية.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointment Types Tab */}
          <TabsContent value="appointment-types" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  إدارة أنواع المواعيد
                </CardTitle>
                <CardDescription>
                  تخصيص أنواع المواعيد المتاحة للحجز
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="أدخل نوع موعد جديد..."
                    value={newAppointmentType.name}
                    onChange={(e) => setNewAppointmentType({ ...newAppointmentType, name: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addAppointmentType()}
                  />
                  <Button onClick={addAppointmentType} variant="medical">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {appointmentTypes.map((type) => (
                    <Card key={type} className="p-4 bg-accent/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-medium">{type}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setAppointmentTypes(appointmentTypes.filter(t => t !== type))}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Diagnosis Templates Tab */}
          <TabsContent value="diagnosis" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  قوالب التشخيص
                </CardTitle>
                <CardDescription>
                  إنشاء قوالب جاهزة للتشخيص الطبي
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="medical" className="w-full md:w-auto">
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة قالب تشخيص
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>قالب تشخيص جديد</DialogTitle>
                      <DialogDescription>
                        أضف قالب تشخيص للاستخدام السريع
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>اسم القالب</Label>
                        <Input
                          placeholder="مثال: التهاب الحلق"
                          value={newDiagnosis.name}
                          onChange={(e) => setNewDiagnosis({ ...newDiagnosis, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>محتوى التشخيص</Label>
                        <Input
                          placeholder="وصف التشخيص..."
                          value={newDiagnosis.content}
                          onChange={(e) => setNewDiagnosis({ ...newDiagnosis, content: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="medical" onClick={addDiagnosisTemplate}>
                        حفظ
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="space-y-3">
                  {diagnosisTemplates.map((template) => (
                    <Card key={template.id} className="p-4 bg-accent/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-1">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">{template.content}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDiagnosisTemplates(diagnosisTemplates.filter(t => t.id !== template.id))}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {diagnosisTemplates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد قوالب تشخيص. ابدأ بإضافة قوالب جاهزة.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Treatment Templates Tab */}
          <TabsContent value="treatment" className="space-y-4">
            <Card className="card-gradient border-0 medical-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  قوالب العلاج
                </CardTitle>
                <CardDescription>
                  إنشاء قوالب جاهزة لخطط العلاج
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="medical" className="w-full md:w-auto">
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة قالب علاج
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>قالب علاج جديد</DialogTitle>
                      <DialogDescription>
                        أضف قالب علاج للاستخدام السريع
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>اسم القالب</Label>
                        <Input
                          placeholder="مثال: علاج التهاب"
                          value={newTreatment.name}
                          onChange={(e) => setNewTreatment({ ...newTreatment, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>الفئة</Label>
                        <Input
                          placeholder="مثال: أمراض القلب، السكري..."
                          value={newTreatment.category}
                          onChange={(e) => setNewTreatment({ ...newTreatment, category: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="medical" onClick={addTreatmentTemplate}>
                        حفظ
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="space-y-3">
                  {treatmentTemplates.map((template) => (
                    <Card key={template.id} className="p-4 bg-accent/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-1">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">{template.content}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setTreatmentTemplates(treatmentTemplates.filter(t => t.id !== template.id))}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {treatmentTemplates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد قوالب علاج. ابدأ بإضافة قوالب جاهزة.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SystemManagement;