'use client';

import { useState, useEffect } from 'react';
import { ContentCheck } from '@/types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Shield, AlertTriangle, XCircle, Calendar, User, Package, Box, Image, Trash2, Pencil } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { EditContentCheckDialog } from './EditContentCheckDialog';

interface ContentCheckHistoryProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
}

export function ContentCheckHistory({
  open,
  onClose,
  gameId,
  gameName,
}: ContentCheckHistoryProps) {
  const isAdmin = useAdminMode();
  const [checks, setChecks] = useState<ContentCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCheck, setEditingCheck] = useState<ContentCheck | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (open && gameId) {
      fetchChecks();
    }
  }, [open, gameId]);

  const fetchChecks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/content-checks?gameId=${gameId}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Failed to fetch content checks');
      }
      const data = await response.json();
      setChecks(data.checks || []);
    } catch (err) {
      console.error('Error fetching content checks:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load content check history';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (check: ContentCheck) => {
    setEditingCheck(check);
    setShowEditDialog(true);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setEditingCheck(null);
    fetchChecks(); // Refresh the list
  };

  const handleDelete = async (checkId: string) => {
    if (!confirm('Are you sure you want to delete this content check record? This action cannot be undone.')) {
      return;
    }

    setDeletingId(checkId);
    try {
      const response = await fetch(`/api/content-checks/${checkId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete content check');
      }

      // Remove the deleted check from the list
      setChecks(checks.filter(check => check.id !== checkId));
    } catch (err) {
      console.error('Error deleting content check:', err);
      alert('Failed to delete content check. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Perfect Condition':
        return <Shield className="w-5 h-5 text-green-600" />;
      case 'Minor Issues':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'Major Issues':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'Unplayable':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Shield className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Perfect Condition':
        return 'border-green-200 bg-green-50';
      case 'Minor Issues':
        return 'border-yellow-200 bg-yellow-50';
      case 'Major Issues':
        return 'border-orange-200 bg-orange-50';
      case 'Unplayable':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">Content Check History</SheetTitle>
          <SheetDescription>
            View all content check records for {gameName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading content checks...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="font-medium text-red-800 mb-2">Failed to Load Content Checks</p>
              <p className="text-sm text-red-600">{error}</p>
              {error.includes('timeout') && (
                <p className="text-xs text-red-500 mt-2">
                  This is likely a Docker networking issue. Check your container's network settings.
                </p>
              )}
            </div>
          )}

          {!loading && !error && checks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No content checks recorded for this game yet.
            </div>
          )}

          {!loading && !error && checks.length > 0 && (
            <div className="space-y-4">
              {checks.map((check, index) => (
                <div
                  key={check.id}
                  className={`border-2 rounded-lg p-4 ${getStatusColor(check.fields.Status)}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.fields.Status)}
                      <h3 className="font-semibold text-lg">{check.fields.Status}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Latest
                        </span>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(check)}
                            className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
                            title="Edit this check"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(check.id)}
                            disabled={deletingId === check.id}
                            className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                            title="Delete this check"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                    {check.fields['Check Date'] && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(check.fields['Check Date']), 'MMM dd')}
                        </span>
                      </div>
                    )}
                    {check.fields.Inspector && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>
                          Inspector: {
                            Array.isArray(check.fields.Inspector)
                              ? check.fields.Inspector.join(', ') || 'Unknown'
                              : check.fields.Inspector || 'Unknown'
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Conditions */}
                  {(check.fields['Box Condition'] || check.fields['Card Condition']) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                      {check.fields['Box Condition'] && (
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4 text-muted-foreground" />
                          <span>Box: {check.fields['Box Condition']}</span>
                        </div>
                      )}
                      {check.fields['Card Condition'] && (
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span>Cards: {check.fields['Card Condition']}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {check.fields['Sleeved At Check'] && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Package className="w-3 h-3" />
                        Sleeved
                      </span>
                    )}
                    {check.fields['Box Wrapped At Check'] && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Package className="w-3 h-3" />
                        Wrapped
                      </span>
                    )}
                    {check.fields['Is Fake'] && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        Counterfeit
                      </span>
                    )}
                  </div>

                  {/* Missing Pieces */}
                  {check.fields['Missing Pieces'] && (
                    <div className="mb-3 p-2 bg-white rounded border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-1">
                        Missing Pieces:
                      </p>
                      <p className="text-sm text-red-700">
                        {check.fields['Missing Pieces']}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {check.fields.Notes && (
                    <div className="mb-3 p-2 bg-white rounded border">
                      <p className="text-sm font-medium mb-1">Notes:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {check.fields.Notes}
                      </p>
                    </div>
                  )}

                  {/* Photos indicator */}
                  {check.fields.Photos && check.fields.Photos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Image className="w-4 h-4" />
                      <span>{check.fields.Photos.length} photo(s) attached</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>

      {/* Edit Content Check Dialog */}
      {editingCheck && (
        <EditContentCheckDialog
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingCheck(null);
          }}
          check={editingCheck}
          gameName={gameName}
          onSuccess={handleEditSuccess}
        />
      )}
    </Sheet>
  );
}
