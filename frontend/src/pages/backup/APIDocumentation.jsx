import React, { useState } from 'react';
import { Code, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';

export default function APIDocumentation() {
  const [copiedEndpoint, setCopiedEndpoint] = useState('');

  const copyToClipboard = (text, endpoint) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpoint);
    setTimeout(() => setCopiedEndpoint(''), 2000);
  };

  const endpoints = [
    {
      method: 'GET',
      path: '/api/jobs',
      description: 'List all jobs with filters',
      params: 'limit, offset, location, salary_min, salary_max'
    },
    {
      method: 'POST',
      path: '/api/applications',
      description: 'Submit a job application',
      body: '{ "jobId": "123", "coverLetter": "..." }'
    },
    {
      method: 'GET',
      path: '/api/profile',
      description: 'Get user profile',
      auth: 'Bearer token required'
    },
    {
      method: 'POST',
      path: '/api/resume/parse',
      description: 'Parse and analyze resume',
      body: 'FormData with resume file'
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">API Documentation</h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              The AI Job Chommie API allows you to integrate our job search and application features into your own applications.
            </p>
            <div className="bg-gray-900 p-4 rounded">
              <p className="text-sm text-gray-400 mb-2">Base URL:</p>
              <code className="text-cyan-400">https://api.aijobchommie.com/v1</code>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              Authenticate your requests using a Bearer token in the Authorization header:
            </p>
            <div className="bg-gray-900 p-4 rounded relative">
              <code className="text-cyan-400">
                Authorization: Bearer YOUR_API_TOKEN
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_TOKEN', 'auth')}
              >
                {copiedEndpoint === 'auth' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {endpoints.map((endpoint, i) => (
                <div key={i} className="border rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      endpoint.method === 'GET' ? 'bg-green-600' : 'bg-blue-600'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="text-cyan-400">{endpoint.path}</code>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{endpoint.description}</p>
                  {endpoint.params && (
                    <p className="text-xs text-gray-500">Parameters: {endpoint.params}</p>
                  )}
                  {endpoint.body && (
                    <p className="text-xs text-gray-500">Body: {endpoint.body}</p>
                  )}
                  {endpoint.auth && (
                    <p className="text-xs text-gray-500">{endpoint.auth}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
