import { useAuth } from '@/contexts/AuthContext';

export const usePermissions = () => {
  const { profile, userRole, isAdmin, isDoctor, isReceptionist } = useAuth();

  const permissions = {
    canViewDashboard: !!profile,
    canViewAppointments: !!profile,
    canCreateAppointments: isAdmin || isDoctor || isReceptionist,
    canEditAppointments: isAdmin || isDoctor || isReceptionist,
    canDeleteAppointments: isAdmin,
    canViewPatients: isAdmin || isDoctor || isReceptionist,
    canCreatePatients: isAdmin || isReceptionist,
    canEditPatients: isAdmin || isDoctor || isReceptionist,
    canDeletePatients: isAdmin,
    canViewDoctors: !!profile,
    canManageDoctors: isAdmin,
    canEditDoctors: isAdmin,
    canDeleteDoctors: isAdmin,
    canViewMedicalRecords: isAdmin || isDoctor,
    canCreateMedicalRecords: isAdmin || isDoctor,
    canEditMedicalRecords: isAdmin || isDoctor,
    canDeleteMedicalRecords: isAdmin,
    canViewReports: isAdmin || isDoctor,
    canExportReports: isAdmin,
    canManageUsers: isAdmin,
    canViewUsers: isAdmin,
    canManagePermissions: isAdmin,
    canManageSettings: isAdmin,
    canViewSettings: !!profile,
    canViewNotifications: !!profile,
    canSendNotifications: isAdmin,
    canManageWaitingList: isAdmin || isReceptionist,
    canUpdatePatients: isAdmin || isDoctor || isReceptionist,
    canAddRecords: isAdmin || isDoctor,
    canEditRecords: isAdmin || isDoctor,
  };

  return { ...permissions, loading: false };
};
