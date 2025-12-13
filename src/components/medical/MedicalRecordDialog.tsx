import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, User, Activity, Pill, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MedicalRecord {
  id: string;
  record_date: string;
  diagnosis: string;
  treatment?: string;
  prescription?: string;
  notes?: string;
  doctor_name?: string;
}

interface MedicalRecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

const MedicalRecordDialog: React.FC<MedicalRecordDialogProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
}) => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && patientId) {
      fetchMedicalRecords();
    }
  }, [isOpen, patientId]);

  const fetchMedicalRecords = async () => {
    try {
      setLoading(true);
      
      // Fetch medical records
      const { data: recordsData, error: recordsError } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patientId)
        .order('record_date', { ascending: false });

      if (recordsError) throw recordsError;

      if (recordsData && recordsData.length > 0) {
        // Get doctor names
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
      toast({
        title: "خطأ",
        description: "فشل في تحميل السجل الطبي",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            السجل الطبي - {patientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-pulse space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">لا يوجد سجل طبي لهذا المريض</p>
              <p className="text-sm text-muted-foreground mt-2">
                سيتم إضافة السجلات الطبية تلقائياً عند إنشاء المواعيد والكشوفات
              </p>
            </div>
          ) : (
            records.map((record) => (
              <Card key={record.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(record.record_date).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>د. {record.doctor_name}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {record.diagnosis && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                        التشخيص
                      </h4>
                      <p className="text-foreground">{record.diagnosis}</p>
                    </div>
                  )}

                  {record.treatment && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                        العلاج
                      </h4>
                      <p className="text-foreground">{record.treatment}</p>
                    </div>
                  )}

                  {record.prescription && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Pill className="w-4 h-4" />
                        الوصفة الطبية
                      </h4>
                      <p className="text-foreground whitespace-pre-wrap">{record.prescription}</p>
                    </div>
                  )}

                  {record.notes && (
                    <div className="bg-primary/5 p-3 rounded-lg">
                      <h4 className="font-semibold text-sm text-primary mb-1">
                        ملاحظات
                      </h4>
                      <p className="text-foreground">{record.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicalRecordDialog;