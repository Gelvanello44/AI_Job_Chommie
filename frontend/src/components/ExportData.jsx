import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  Calendar,
  Filter,
  CheckCircle,
  AlertCircle,
  Loader2,
  Archive
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { DatePicker } from './ui/date-picker';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';

const ExportData = ({ userId, onExportComplete }) => {
  const [exportType, setExportType] = useState('applications');
  const [exportFormat, setExportFormat] = useState('csv');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [includeAttachments, setIncludeAttachments] = useState(false);

  const exportTypes = {
    applications: {
      label: 'Job Applications',
      icon: FileText,
      fields: ['jobTitle', 'company', 'status', 'appliedDate', 'salary', 'location', 'description', 'coverLetter']
    },
    profile: {
      label: 'Profile & Resume',
      icon: FileText,
      fields: ['personalInfo', 'experience', 'education', 'skills', 'certifications', 'projects']
    },
    analytics: {
      label: 'Analytics Data',
      icon: FileSpreadsheet,
      fields: ['applicationStats', 'responseRates', 'interviewSuccess', 'timeToHire', 'salaryTrends']
    },
    all: {
      label: 'Complete Data Export',
      icon: Archive,
      fields: ['everything']
    }
  };

  const exportFormats = [
    { value: 'csv', label: 'CSV', icon: FileSpreadsheet, description: 'Spreadsheet compatible' },
    { value: 'json', label: 'JSON', icon: FileJson, description: 'Developer friendly' },
    { value: 'pdf', label: 'PDF', icon: FileText, description: 'Print ready' },
    { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel' }
  ];

  const handleFieldToggle = (field) => {
    const newFields = new Set(selectedFields);
    if (newFields.has(field)) {
      newFields.delete(field);
    } else {
      newFields.add(field);
    }
    setSelectedFields(newFields);
  };

  const handleSelectAllFields = () => {
    const typeFields = exportTypes[exportType].fields;
    if (selectedFields.size === typeFields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(typeFields));
    }
  };

  const handleExport = async () => {
    if (selectedFields.size === 0 && exportType !== 'all') {
      toast.error('Please select at least one field to export');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Prepare export data
      const exportData = {
        type: exportType,
        format: exportFormat,
        fields: Array.from(selectedFields),
        dateRange,
        includeAttachments,
        userId
      };

      // Make API call
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(exportData)
      });

      clearInterval(progressInterval);
      setExportProgress(100);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Handle download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${exportType}_${Date.now()}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data exported successfully!');
      
      if (onExportComplete) {
        onExportComplete(exportData);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const estimateExportSize = () => {
    const baseSize = {
      applications: 2.5,
      profile: 0.5,
      analytics: 1.2,
      all: 5.0
    };
    
    const formatMultiplier = {
      csv: 1,
      json: 1.2,
      pdf: 2.5,
      xlsx: 1.5
    };

    const size = baseSize[exportType] * formatMultiplier[exportFormat];
    return includeAttachments ? size * 2.5 : size;
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Your Data
        </CardTitle>
        <CardDescription>
          Download your data in various formats for backup or analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Export</TabsTrigger>
            <TabsTrigger value="custom">Custom Export</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-6">
            {/* Quick Export Options */}
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(exportTypes).map(([key, type]) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={key}
                    variant={exportType === key ? "default" : "outline"}
                    className="h-auto flex-col gap-2 p-4"
                    onClick={() => {
                      setExportType(key);
                      setSelectedFields(new Set(type.fields));
                    }}
                  >
                    <Icon className="h-8 w-8" />
                    <span className="text-sm font-medium">{type.label}</span>
                  </Button>
                );
              })}
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <RadioGroup value={exportFormat} onValueChange={setExportFormat}>
                <div className="grid grid-cols-2 gap-4">
                  {exportFormats.map((format) => {
                    const Icon = format.icon;
                    return (
                      <div key={format.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={format.value} id={format.value} />
                        <Label 
                          htmlFor={format.value} 
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <Icon className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{format.label}</div>
                            <div className="text-xs text-muted-foreground">{format.description}</div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>

            {/* Quick Export Button */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Estimated size: ~{estimateExportSize().toFixed(1)} MB
              </div>
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
                className="min-w-[150px]"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Now
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-6">
            {/* Data Type Selection */}
            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(exportTypes).map(([key, type]) => (
                    <SelectItem key={key} value={key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field Selection */}
            {exportType !== 'all' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Select Fields</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleSelectAllFields}
                  >
                    {selectedFields.size === exportTypes[exportType].fields.length 
                      ? 'Deselect All' 
                      : 'Select All'}
                  </Button>
                </div>
                <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                  {exportTypes[exportType].fields.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={selectedFields.has(field)}
                        onCheckedChange={() => handleFieldToggle(field)}
                      />
                      <Label htmlFor={field} className="cursor-pointer capitalize">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range (Optional)</Label>
              <div className="flex gap-2">
                <DatePicker
                  selected={dateRange.start}
                  onChange={(date) => setDateRange({ ...dateRange, start: date })}
                  placeholderText="Start date"
                  className="flex-1"
                />
                <DatePicker
                  selected={dateRange.end}
                  onChange={(date) => setDateRange({ ...dateRange, end: date })}
                  placeholderText="End date"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-2">
              <Label>Additional Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="attachments"
                    checked={includeAttachments}
                    onCheckedChange={setIncludeAttachments}
                  />
                  <Label htmlFor="attachments" className="cursor-pointer">
                    Include attachments (resumes, cover letters)
                  </Label>
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exportFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      <div className="flex items-center gap-2">
                        {format.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Button */}
            <div className="space-y-4">
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Preparing export...</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <Progress value={exportProgress} className="h-2" />
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Estimated size: ~{estimateExportSize().toFixed(1)} MB
                </div>
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting || (selectedFields.size === 0 && exportType !== 'all')}
                  className="min-w-[150px]"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export History */}
        <Alert className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your data will be exported in compliance with GDPR regulations. 
            Exports are available for download for 7 days.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default ExportData;
