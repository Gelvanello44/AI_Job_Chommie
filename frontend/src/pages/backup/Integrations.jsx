import React from 'react';
import IntegrationSettings from '../../components/IntegrationSettings';
import { useAuth } from "../../context/AuthContext";

export default function Integrations() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Integrations</h1>
        <IntegrationSettings userId={user?.id} />
      </div>
    </div>
  );
}
