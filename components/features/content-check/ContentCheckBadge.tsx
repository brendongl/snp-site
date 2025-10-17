'use client';

import { Shield, Package, AlertTriangle, XCircle } from 'lucide-react';

interface ContentCheckBadgeProps {
  status?: string[];
  sleeved?: boolean;
  boxWrapped?: boolean;
  className?: string;
}

export function ContentCheckBadge({
  status,
  sleeved,
  boxWrapped,
  className = '',
}: ContentCheckBadgeProps) {
  const statusValue = status?.[0];

  // Status badge with icon and color
  const getStatusDisplay = () => {
    switch (statusValue) {
      case 'Perfect Condition':
        return {
          icon: Shield,
          text: 'Perfect',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
        };
      case 'Minor Issues':
        return {
          icon: AlertTriangle,
          text: 'Minor Issues',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
        };
      case 'Major Issues':
        return {
          icon: AlertTriangle,
          text: 'Major Issues',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
        };
      case 'Unplayable':
        return {
          icon: XCircle,
          text: 'Unplayable',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  if (!statusDisplay && !sleeved && !boxWrapped) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Status Badge */}
      {statusDisplay && (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusDisplay.bgColor} ${statusDisplay.textColor}`}
        >
          <statusDisplay.icon className={`w-3.5 h-3.5 ${statusDisplay.iconColor}`} />
          <span>{statusDisplay.text}</span>
        </div>
      )}

      {/* Sleeved Badge */}
      {sleeved && (
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
          title="Cards are sleeved"
        >
          <Package className="w-3.5 h-3.5 text-blue-600" />
          <span>Sleeved</span>
        </div>
      )}

      {/* Box Wrapped Badge */}
      {boxWrapped && (
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
          title="Box is wrapped"
        >
          <Package className="w-3.5 h-3.5 text-purple-600" />
          <span>Wrapped</span>
        </div>
      )}
    </div>
  );
}
