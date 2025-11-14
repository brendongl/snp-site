'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  User
} from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

interface ApprovalRequest {
  id: number;
  request_type: string;
  requested_by: string;
  requester_name: string;
  requester_nickname: string | null;
  shift_id: string | null;
  original_data: any;
  requested_data: any;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewer_nickname: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Check authentication and admin access
  useEffect(() => {
    const id = localStorage.getItem('staff_id');
    const staffType = localStorage.getItem('staff_type');

    if (!id) {
      router.push('/auth/signin');
      return;
    }

    if (staffType !== 'Admin') {
      alert('Access denied: Admin access required for approval queue');
      router.push('/games');
      return;
    }

    setStaffId(id);
  }, [router]);

  // Fetch approvals
  useEffect(() => {
    if (!staffId || !isAdmin) return;

    fetchApprovals();
  }, [staffId, isAdmin, selectedStatus]);

  const fetchApprovals = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/approvals?status=${selectedStatus}`);
      if (!response.ok) {
        throw new Error('Failed to fetch approvals');
      }

      const data = await response.json();
      setApprovals(data.approvals);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (approvalId: number) => {
    if (!confirm('Are you sure you want to approve this request?')) return;

    try {
      setProcessingId(approvalId);
      setError(null);

      const response = await fetch('/api/admin/approvals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approval_id: approvalId,
          action: 'approve',
          reviewed_by: staffId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve request');
      }

      setSuccessMessage('Request approved successfully');
      fetchApprovals();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (approvalId: number) => {
    if (!confirm('Are you sure you want to reject this request?')) return;

    try {
      setProcessingId(approvalId);
      setError(null);

      const response = await fetch('/api/admin/approvals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approval_id: approvalId,
          action: 'reject',
          reviewed_by: staffId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reject request');
      }

      setSuccessMessage('Request rejected successfully');
      fetchApprovals();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const formatRequestType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!staffId || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/staff/roster/calendar"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Roster Calendar</span>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-7 h-7 text-indigo-600" />
              Approval Queue
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>{successMessage}</div>
          </div>
        )}

        {/* Status Filter */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex gap-3">
            {['pending', 'approved', 'rejected'].map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Approvals List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Requests ({approvals.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading approvals...</div>
          ) : approvals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {selectedStatus} requests found.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {approvals.map((approval) => (
                <div key={approval.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {formatRequestType(approval.request_type)}
                        </span>
                        <span className="text-sm text-gray-500">
                          by {approval.requester_nickname || approval.requester_name}
                        </span>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(approval.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Reason */}
                      {approval.reason && (
                        <div className="mb-2 text-sm text-gray-700">
                          <strong>Reason:</strong> {approval.reason}
                        </div>
                      )}

                      {/* Request Details */}
                      {approval.requested_data && (
                        <div className="bg-gray-50 rounded-md p-3 mb-2">
                          <div className="text-xs font-medium text-gray-500 mb-1">Requested Changes:</div>
                          <pre className="text-xs text-gray-700 overflow-x-auto">
                            {JSON.stringify(approval.requested_data, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Review Info */}
                      {approval.reviewed_at && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Reviewed by {approval.reviewer_nickname || approval.reviewer_name} on{' '}
                          {new Date(approval.reviewed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {selectedStatus === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          disabled={processingId === approval.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(approval.id)}
                          disabled={processingId === approval.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
