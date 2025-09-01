import React, { useState, useCallback } from 'react';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Archive, 
  Tag, 
  Send, 
  Download,
  RefreshCw,
  AlertCircle,
  Star,
  Clock,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

const BulkActions = ({ 
  applications = [], 
  onApplicationsUpdate,
  onBulkAction,
  availableTags = [],
  userQuota = { remaining: 10, total: 50 }
}) => {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [bulkMessage, setBulkMessage] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const statusColors = {
    applied: 'bg-blue-500',
    interview: 'bg-purple-500',
    rejected: 'bg-red-500',
    accepted: 'bg-green-500',
    pending: 'bg-yellow-500',
    saved: 'bg-gray-500'
  };

  const bulkActionOptions = [
    { value: 'apply', label: 'Apply to Jobs', icon: Send, requiresQuota: true },
    { value: 'archive', label: 'Archive', icon: Archive },
    { value: 'delete', label: 'Delete', icon: Trash2, isDangerous: true },
    { value: 'tag', label: 'Add Tag', icon: Tag },
    { value: 'status', label: 'Change Status', icon: RefreshCw },
    { value: 'favorite', label: 'Mark as Favorite', icon: Star },
    { value: 'export', label: 'Export Data', icon: Download },
    { value: 'schedule', label: 'Schedule Follow-up', icon: Clock }
  ];

  const handleSelectAll = useCallback(() => {
    if (isSelectAll) {
      setSelectedItems(new Set());
      setIsSelectAll(false);
    } else {
      setSelectedItems(new Set(applications.map(app => app.id)));
      setIsSelectAll(true);
    }
  }, [isSelectAll, applications]);

  const handleSelectItem = useCallback((itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setIsSelectAll(newSelected.size === applications.length);
  }, [selectedItems, applications.length]);

  const handleBulkAction = useCallback(async (action) => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }

    // Check quota for apply action
    if (action === 'apply' && selectedItems.size > userQuota.remaining) {
      toast.error(`Insufficient quota. You can only apply to ${userQuota.remaining} more jobs.`);
      return;
    }

    // Show confirmation for dangerous actions
    if (action === 'delete' || action === 'apply') {
      setPendingAction(action);
      setShowConfirmDialog(true);
      return;
    }

    executeBulkAction(action);
  }, [selectedItems, userQuota.remaining]);

  const executeBulkAction = async (action, additionalData = {}) => {
    setIsProcessing(true);
    
    try {
      const selectedIds = Array.from(selectedItems);
      
      const payload = {
        action,
        applicationIds: selectedIds,
        ...additionalData
      };

      // Call the parent's bulk action handler
      if (onBulkAction) {
        await onBulkAction(payload);
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Handle different actions
      switch (action) {
        case 'apply':
          toast.success(`Successfully applied to ${selectedIds.length} jobs`);
          break;
        case 'delete':
          toast.success(`Deleted ${selectedIds.length} applications`);
          break;
        case 'archive':
          toast.success(`Archived ${selectedIds.length} applications`);
          break;
        case 'tag':
          toast.success(`Tagged ${selectedIds.length} applications`);
          break;
        case 'status':
          toast.success(`Updated status for ${selectedIds.length} applications`);
          break;
        case 'favorite':
          toast.success(`Marked ${selectedIds.length} applications as favorite`);
          break;
        case 'export':
          toast.success('Export started. Check your downloads.');
          break;
        case 'schedule':
          toast.success(`Scheduled follow-up for ${selectedIds.length} applications`);
          break;
        default:
          toast.success('Bulk action completed');
      }

      // Clear selection after action
      setSelectedItems(new Set());
      setIsSelectAll(false);
      
      // Refresh applications list
      if (onApplicationsUpdate) {
        onApplicationsUpdate();
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error('Failed to perform bulk action');
    } finally {
      setIsProcessing(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
      setBulkMessage('');
    }
  };

  const confirmBulkAction = () => {
    if (pendingAction === 'apply' && bulkMessage) {
      executeBulkAction(pendingAction, { coverLetter: bulkMessage });
    } else {
      executeBulkAction(pendingAction);
    }
  };

  const getActionMessage = (action) => {
    const count = selectedItems.size;
    switch (action) {
      case 'apply':
        return `You are about to apply to ${count} job${count > 1 ? 's' : ''}. This will use ${count} of your remaining ${userQuota.remaining} applications.`;
      case 'delete':
        return `Are you sure you want to permanently delete ${count} application${count > 1 ? 's' : ''}? This action cannot be undone.`;
      default:
        return `Perform ${action} on ${count} item${count > 1 ? 's' : ''}?`;
    }
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Bulk Actions</CardTitle>
              <CardDescription>
                {selectedItems.size > 0 
                  ? `${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} selected`
                  : 'Select items to perform bulk actions'
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={applications.length === 0}
              >
                {isSelectAll ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
              {selectedItems.size > 0 && (
                <Badge variant="secondary">
                  {selectedItems.size} selected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedItems.size > 0 && (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {bulkActionOptions.map((option) => {
                  const Icon = option.icon;
                  const isDisabled = option.requiresQuota && selectedItems.size > userQuota.remaining;
                  
                  return (
                    <Button
                      key={option.value}
                      variant={option.isDangerous ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => handleBulkAction(option.value)}
                      disabled={isProcessing || isDisabled}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {option.label}
                      {option.requiresQuota && (
                        <Badge variant="secondary" className="ml-2">
                          {userQuota.remaining} left
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Additional Options */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Add Tag</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={selectedTag} onValueChange={setSelectedTag}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags.map(tag => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm"
                      onClick={() => executeBulkAction('tag', { tag: selectedTag })}
                      disabled={!selectedTag || isProcessing}
                    >
                      Apply Tag
                    </Button>
                  </div>
                </div>

                <div className="flex-1">
                  <Label>Change Status</Label>
                  <Select 
                    onValueChange={(status) => executeBulkAction('status', { status })}
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(statusColors).map(status => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Warning for quota-limited actions */}
              {selectedItems.size > userQuota.remaining && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You have selected more items ({selectedItems.size}) than your remaining quota ({userQuota.remaining}).
                    Consider upgrading your plan or reducing your selection.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Applications List with Checkboxes */}
          <div className="mt-6 space-y-2">
            {applications.slice(0, 10).map((app) => (
              <div 
                key={app.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedItems.has(app.id)}
                  onCheckedChange={() => handleSelectItem(app.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{app.jobTitle}</div>
                  <div className="text-sm text-muted-foreground">{app.company}</div>
                </div>
                <Badge variant="outline">
                  {app.status}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {new Date(app.appliedDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'delete' ? 'Confirm Deletion' : 'Confirm Bulk Action'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction && getActionMessage(pendingAction)}
            </DialogDescription>
          </DialogHeader>
          
          {pendingAction === 'apply' && (
            <div className="space-y-2">
              <Label>Cover Letter Template (Optional)</Label>
              <Textarea
                placeholder="Enter a cover letter template to use for all applications..."
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                rows={4}
              />
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              variant={pendingAction === 'delete' ? 'destructive' : 'default'}
              onClick={confirmBulkAction}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BulkActions;
