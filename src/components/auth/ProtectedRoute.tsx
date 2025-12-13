import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: Array<'admin' | 'doctor' | 'receptionist' | 'patient'>;
}

const ProtectedRoute = ({ 
  children, 
  requireAuth = true,
  allowedRoles 
}: ProtectedRouteProps) => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (requireAuth && !user) {
      navigate('/auth');
      return;
    }

    if (allowedRoles && userRole && !allowedRoles.includes(userRole as any)) {
      navigate('/');
      return;
    }
  }, [user, userRole, loading, requireAuth, allowedRoles, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return null;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole as any)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
