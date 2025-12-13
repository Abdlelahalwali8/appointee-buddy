import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, Building, Clock, Bell, Shield, Save, DollarSign, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import Layout from '@/components/layout/Layout';
import { TextInput, TextAreaField } from '@/components/common/FormField';
import { useForm, FormErrors } from '@/hooks/useForm';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

const Settings = () => {
  const permissions = usePermissions();
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

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
        // Create default settings if none exist
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

  useEffect(() => {
    fetchSettings();
  }, []);

  // --- Form Setup ---
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

  // Update form when settings change
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

  if (!permissions.canManageSettings) {
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
            إدارة إعدادات المركز الطبي
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
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
                  <Button type="submit" variant="medical" disabled={form.isSubmitting} className="w-full md:w-auto">
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
                  <Button type="submit" variant="medical" disabled={form.isSubmitting} className="w-full md:w-auto">
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
                  <Button type="submit" variant="medical" disabled={form.isSubmitting} className="w-full md:w-auto">
                    <Save className="w-4 h-4 ml-2" />
                    {form.isSubmitting ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;