import React, { useState } from 'react';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';

export default function Notifications() {
  const [preferences, setPreferences] = useState({
    email: { applications: true, interviews: true, offers: true, marketing: false },
    push: { applications: true, interviews: true, offers: true, marketing: false },
    sms: { applications: false, interviews: true, offers: true, marketing: false }
  });

  const updatePreference = (channel, type, value) => {
    setPreferences(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [type]: value }
    }));
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Notification Preferences</h1>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(preferences.email).map(type => (
                <div key={type} className="flex items-center justify-between">
                  <Label htmlFor={`email-${type}`} className="capitalize">
                    {type.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <Switch
                    id={`email-${type}`}
                    checked={preferences.email[type]}
                    onCheckedChange={(value) => updatePreference('email', type, value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Push Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(preferences.push).map(type => (
                <div key={type} className="flex items-center justify-between">
                  <Label htmlFor={`push-${type}`} className="capitalize">
                    {type.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <Switch
                    id={`push-${type}`}
                    checked={preferences.push[type]}
                    onCheckedChange={(value) => updatePreference('push', type, value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                SMS Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(preferences.sms).map(type => (
                <div key={type} className="flex items-center justify-between">
                  <Label htmlFor={`sms-${type}`} className="capitalize">
                    {type.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <Switch
                    id={`sms-${type}`}
                    checked={preferences.sms[type]}
                    onCheckedChange={(value) => updatePreference('sms', type, value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Button className="w-full">Save Preferences</Button>
        </div>
      </div>
    </div>
  );
}
