import React, { useState, useEffect } from 'react';
import { 
  Link2, 
  Linkedin, 
  Github, 
  Calendar,
  Mail,
  Briefcase,
  Globe,
  Database,
  Check,
  X,
  Settings,
  RefreshCw,
  AlertCircle,
  Shield
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';

const IntegrationSettings = ({ userId, onIntegrationUpdate }) => {
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('connected');

  const availableIntegrations = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      description: 'Import profile data and job listings',
      color: 'bg-blue-600',
      features: ['Profile Import', 'Job Search', 'Easy Apply'],
      requiresAuth: true
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: Github,
      description: 'Showcase your projects and contributions',
      color: 'bg-gray-800',
      features: ['Repository Display', 'Contribution Graph', 'Skills Analysis'],
      requiresAuth: true
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      icon: Calendar,
      description: 'Sync interview schedules',
      color: 'bg-red-500',
      features: ['Interview Scheduling', 'Reminders', 'Availability Sync'],
      requiresAuth: true
    },
    {
      id: 'gmail',
      name: 'Gmail',
      icon: Mail,
      description: 'Track application emails',
      color: 'bg-red-600',
      features: ['Email Tracking', 'Auto-categorization', 'Response Detection'],
      requiresAuth: true
    },
    {
      id: 'indeed',
      name: 'Indeed',
      icon: Briefcase,
      description: 'Sync job applications',
      color: 'bg-indigo-600',
      features: ['Application Import', 'Status Sync', 'Job Recommendations'],
      requiresAuth: false,
      requiresApiKey: true
    },
    {
      id: 'glassdoor',
      name: 'Glassdoor',
      icon: Globe,
      description: 'Company insights and reviews',
      color: 'bg-green-600',
      features: ['Company Reviews', 'Salary Data', 'Interview Questions'],
      requiresAuth: false,
      requiresApiKey: true
    }
  ];

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (integrationId) => {
    const integration = availableIntegrations.find(i => i.id === integrationId);
    
    if (integration.requiresAuth) {
      // OAuth flow
      window.location.href = `/api/integrations/${integrationId}/auth`;
    } else if (integration.requiresApiKey) {
      // Show API key input dialog
      toast.info('Please enter your API key in the settings');
    }
  };

  const handleDisconnect = async (integrationId) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Integration disconnected');
        fetchIntegrations();
        if (onIntegrationUpdate) {
          onIntegrationUpdate();
        }
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const handleSync = async (integrationId) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Sync started successfully');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync data');
    }
  };

  const isConnected = (integrationId) => {
    return integrations.some(i => i.id === integrationId && i.connected);
  };

  const connectedIntegrations = availableIntegrations.filter(i => isConnected(i.id));
  const availableToConnect = availableIntegrations.filter(i => !isConnected(i.id));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Integration Settings
        </CardTitle>
        <CardDescription>
          Connect third-party services to enhance your job search
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connected">
              Connected ({connectedIntegrations.length})
            </TabsTrigger>
            <TabsTrigger value="available">
              Available ({availableToConnect.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connected" className="space-y-4">
            {connectedIntegrations.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No integrations connected yet. Check the Available tab to get started.
                </AlertDescription>
              </Alert>
            ) : (
              connectedIntegrations.map((integration) => {
                const Icon = integration.icon;
                const connectionData = integrations.find(i => i.id === integration.id);
                
                return (
                  <Card key={integration.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-lg ${integration.color} text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{integration.name}</h3>
                              <Badge variant="outline" className="text-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                Connected
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {integration.description}
                            </p>
                            {connectionData?.lastSync && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Last synced: {new Date(connectionData.lastSync).toLocaleString()}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {integration.features.map((feature) => (
                                <Badge key={feature} variant="secondary" className="text-xs">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSync(integration.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            {availableToConnect.map((integration) => {
              const Icon = integration.icon;
              
              return (
                <Card key={integration.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-lg ${integration.color} text-white`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {integration.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {integration.features.map((feature) => (
                              <Badge key={feature} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                          {integration.requiresApiKey && (
                            <div className="mt-3 flex gap-2">
                              <Input
                                placeholder="Enter API Key"
                                type="password"
                                className="max-w-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleConnect(integration.id)}
                        size="sm"
                      >
                        Connect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        <Alert className="mt-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Your data is encrypted and secure. You can revoke access at any time.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default IntegrationSettings;
