import React from 'react';
import { Shield, Lock, Eye, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import ExportData from '../../components/ExportData';

export default function DataPrivacy() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Data Privacy & GDPR</h1>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Your Data Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-l-4 border-cyan-400 pl-4">
                <h3 className="font-semibold mb-2">Right to Access</h3>
                <p className="text-gray-400">You can request a copy of all your personal data we store.</p>
              </div>
              <div className="border-l-4 border-cyan-400 pl-4">
                <h3 className="font-semibold mb-2">Right to Rectification</h3>
                <p className="text-gray-400">You can update or correct your personal information at any time.</p>
              </div>
              <div className="border-l-4 border-cyan-400 pl-4">
                <h3 className="font-semibold mb-2">Right to Erasure</h3>
                <p className="text-gray-400">You can request deletion of your account and all associated data.</p>
              </div>
              <div className="border-l-4 border-cyan-400 pl-4">
                <h3 className="font-semibold mb-2">Right to Data Portability</h3>
                <p className="text-gray-400">Export your data in a machine-readable format.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Data Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                We use industry-standard encryption and security measures to protect your data:
              </p>
              <ul className="space-y-2 text-gray-400">
                <li>• 256-bit SSL/TLS encryption for data in transit</li>
                <li>• AES-256 encryption for data at rest</li>
                <li>• Regular security audits and penetration testing</li>
                <li>• GDPR compliant data processing</li>
                <li>• ISO 27001 certified infrastructure</li>
              </ul>
            </CardContent>
          </Card>

          <ExportData userId={1} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Delete Your Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive">Request Account Deletion</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
