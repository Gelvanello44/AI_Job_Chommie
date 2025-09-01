import React from 'react';
import ManagerDashboard from '../../components/ManagerDashboard';
import { useAuth } from "../../context/AuthContext";

export default function Admin() {
  const { user } = useAuth();
  
  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-white mb-6">Access Denied</h1>
          <p className="text-gray-400">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Admin Dashboard</h1>
        <ManagerDashboard />
      </div>
    </div>
  );
}
