'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Save,
  Trash2,
  Edit,
  Power,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Calendar,
  Weight
} from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

interface RosterRule {
  id: number;
  rule_text: string;
  parsed_constraint: {
    type: string;
    [key: string]: any;
  };
  weight: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ParseResult {
  success: boolean;
  rule?: RosterRule;
  parsing_details?: {
    constraint_type: string;
    suggested_weight: number;
    applied_weight: number;
    explanation: string;
  };
  error?: string;
  details?: string;
  suggestion?: string;
}

export default function RosterRulesPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [rules, setRules] = useState<RosterRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Rule input state
  const [ruleText, setRuleText] = useState('');
  const [suggestedPriority, setSuggestedPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [customWeight, setCustomWeight] = useState<number | null>(null);

  // Editing state
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editedWeight, setEditedWeight] = useState<Record<number, number>>({});
  const [editedExpiration, setEditedExpiration] = useState<Record<number, string>>({});

  // Check authentication and admin access
  useEffect(() => {
    const id = localStorage.getItem('staff_id');
    const staffType = localStorage.getItem('staff_type');

    if (!id) {
      router.push('/auth/signin');
      return;
    }

    if (staffType !== 'Admin') {
      alert('Access denied: Admin access required for roster rule management');
      router.push('/games');
      return;
    }

    setStaffId(id);
  }, [router]);

  // Fetch roster rules
  useEffect(() => {
    if (!staffId || !isAdmin) return;

    fetchRules();
  }, [staffId, isAdmin]);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/roster/rules');
      if (!response.ok) {
        throw new Error('Failed to fetch roster rules');
      }

      const data = await response.json();
      setRules(data.rules);

      // Initialize edited values
      const initialWeights: Record<number, number> = {};
      const initialExpirations: Record<number, string> = {};
      data.rules.forEach((rule: RosterRule) => {
        initialWeights[rule.id] = rule.weight;
        initialExpirations[rule.id] = rule.expires_at || '';
      });
      setEditedWeight(initialWeights);
      setEditedExpiration(initialExpirations);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleParseRule = async () => {
    if (!ruleText.trim()) {
      setError('Please enter a rule to parse');
      return;
    }

    try {
      setIsParsing(true);
      setError(null);
      setParseResult(null);

      const response = await fetch('/api/roster/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rule_text: ruleText,
          suggested_priority: suggestedPriority,
          created_by: staffId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to parse rule');
        if (data.suggestion) {
          setError(`${data.error}. ${data.suggestion}`);
        }
        return;
      }

      setParseResult(data);
      setCustomWeight(data.parsing_details.applied_weight);
      setSuccessMessage(`Rule parsed successfully! Type: ${data.parsing_details.constraint_type}`);

      // Clear input and refresh rules
      setRuleText('');
      fetchRules();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse rule');
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateRule = async (ruleId: number) => {
    try {
      const updates: any = {};

      if (editedWeight[ruleId] !== rules.find(r => r.id === ruleId)?.weight) {
        updates.weight = editedWeight[ruleId];
      }

      if (editedExpiration[ruleId] !== (rules.find(r => r.id === ruleId)?.expires_at || '')) {
        updates.expires_at = editedExpiration[ruleId] || null;
      }

      if (Object.keys(updates).length === 0) {
        setSuccessMessage('No changes to save');
        return;
      }

      const response = await fetch('/api/roster/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rule_id: ruleId,
          updates
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update rule');
      }

      setSuccessMessage('Rule updated successfully');
      setEditingRuleId(null);
      fetchRules();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  const handleToggleActive = async (ruleId: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/roster/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rule_id: ruleId,
          updates: {
            is_active: !currentStatus
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle rule status');
      }

      setSuccessMessage(`Rule ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchRules();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule status');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/roster/rules?rule_id=${ruleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }

      setSuccessMessage('Rule deleted successfully');
      fetchRules();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const formatConstraintType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getConstraintTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'min_coverage': 'bg-blue-100 text-blue-800',
      'max_coverage': 'bg-purple-100 text-purple-800',
      'opening_time': 'bg-green-100 text-green-800',
      'min_shift_length': 'bg-yellow-100 text-yellow-800',
      'no_day_and_night': 'bg-red-100 text-red-800',
      'min_hours': 'bg-indigo-100 text-indigo-800',
      'max_hours': 'bg-pink-100 text-pink-800',
      'day_off': 'bg-orange-100 text-orange-800',
      'max_consecutive_days': 'bg-teal-100 text-teal-800',
      'staff_pairing': 'bg-cyan-100 text-cyan-800',
      'required_role': 'bg-violet-100 text-violet-800',
      'required_skill': 'bg-fuchsia-100 text-fuchsia-800',
      'fairness': 'bg-lime-100 text-lime-800',
      'weekly_frequency': 'bg-amber-100 text-amber-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
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
              <Settings className="w-7 h-7 text-indigo-600" />
              Roster Rules Management
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

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI-Powered Rule Parser
          </h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Write rules in plain English (e.g., "We need at least 2 staff members on weekends")</li>
            <li>• The AI will automatically parse and categorize your rule</li>
            <li>• Adjust the priority and weight before saving</li>
            <li>• Rules can be edited, deactivated, or deleted at any time</li>
            <li>• Set expiration dates for temporary rules (e.g., holiday coverage)</li>
          </ul>
        </div>

        {/* Parse Result Display */}
        {parseResult && parseResult.parsing_details && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Rule Parsed Successfully
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-purple-700 font-medium">Constraint Type</div>
                <div className="text-lg font-semibold text-purple-900">
                  {formatConstraintType(parseResult.parsing_details.constraint_type)}
                </div>
              </div>
              <div>
                <div className="text-sm text-purple-700 font-medium">Applied Weight</div>
                <div className="text-lg font-semibold text-purple-900">
                  {parseResult.parsing_details.applied_weight}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-md p-3 mb-4">
              <div className="text-sm text-gray-600 mb-1">Explanation</div>
              <div className="text-sm text-gray-800">{parseResult.parsing_details.explanation}</div>
            </div>
            <div className="text-sm text-purple-700">
              Rule has been automatically added to the active rules list below.
            </div>
          </div>
        )}

        {/* Add New Rule */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Add New Rule
            </h2>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Natural Language Rule
              </label>
              <textarea
                value={ruleText}
                onChange={(e) => setRuleText(e.target.value)}
                placeholder="Example: We need at least 2 staff members working on weekends between 10 AM and 10 PM"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Level
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(['critical', 'high', 'medium', 'low'] as const).map((priority) => (
                  <button
                    key={priority}
                    onClick={() => setSuggestedPriority(priority)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      suggestedPriority === priority
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleParseRule}
              disabled={isParsing || !ruleText.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              <Sparkles className="w-5 h-5" />
              {isParsing ? 'Parsing with AI...' : 'Parse & Add Rule'}
            </button>
          </div>
        </div>

        {/* Active Rules List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Rules ({rules.filter(r => r.is_active).length} active, {rules.length} total)
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No rules defined yet. Add your first rule above!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !rule.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Rule Text */}
                      <div className="font-medium text-gray-900 mb-2">
                        {rule.rule_text}
                      </div>

                      {/* Constraint Type Badge */}
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConstraintTypeColor(
                            rule.parsed_constraint.type
                          )}`}
                        >
                          {formatConstraintType(rule.parsed_constraint.type)}
                        </span>
                        <span className="text-sm text-gray-500">
                          Weight: {editingRuleId === rule.id ? (
                            <input
                              type="number"
                              value={editedWeight[rule.id]}
                              onChange={(e) =>
                                setEditedWeight({ ...editedWeight, [rule.id]: parseInt(e.target.value) || 0 })
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right ml-1"
                              min="0"
                              max="100"
                            />
                          ) : (
                            rule.weight
                          )}
                        </span>
                        {rule.expires_at && (
                          <span className="text-sm text-orange-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires: {new Date(rule.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Expiration Date Editor */}
                      {editingRuleId === rule.id && (
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expiration Date (optional)
                          </label>
                          <input
                            type="date"
                            value={editedExpiration[rule.id]}
                            onChange={(e) =>
                              setEditedExpiration({ ...editedExpiration, [rule.id]: e.target.value })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="text-xs text-gray-500">
                        Created {new Date(rule.created_at).toLocaleDateString()} •
                        Last updated {new Date(rule.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {editingRuleId === rule.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateRule(rule.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingRuleId(null);
                              // Reset values
                              setEditedWeight({ ...editedWeight, [rule.id]: rule.weight });
                              setEditedExpiration({ ...editedExpiration, [rule.id]: rule.expires_at || '' });
                            }}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingRuleId(rule.id)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit rule"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(rule.id, rule.is_active)}
                            className={`p-2 rounded-md transition-colors ${
                              rule.is_active
                                ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
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
