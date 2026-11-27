import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { employeeAuthService } from '../services/employeeApiService';

const ALLOWED_EMPLOYEE_ROLES = new Set(['NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER']);

export default function EmployeeProtectedRoute({ children }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(() => employeeAuthService.getSessionUser());

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const token = employeeAuthService.getToken();
      if (!token) {
        if (active) {
          setEmployee(null);
          setChecking(false);
        }
        return;
      }
      try {
        const liveProfile = await employeeAuthService.me();
        if (active) {
          setEmployee(liveProfile);
        }
      } catch {
        employeeAuthService.clearSession();
        if (active) {
          setEmployee(null);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };
    verify();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Verifying Employee Session...</p>
        </div>
      </div>
    );
  }

  const valid =
    employee &&
    employee.status === 'ACTIVE' &&
    ALLOWED_EMPLOYEE_ROLES.has(String(employee.role || '').toUpperCase());

  if (!valid) {
    return <Navigate to="/employee-login" state={{ from: location }} replace />;
  }

  return React.cloneElement(children, { initialEmployee: employee });
}
