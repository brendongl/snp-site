'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { StaffMenu } from '@/components/features/staff/StaffMenu';
import LearningOpportunityTool from '@/components/features/staff/LearningOpportunityTool';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LearningOpportunitiesPage() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
  }, [router]);

  if (!staffName) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-[100]">
        <div className="container mx-auto px-4 py-3 max-w-6xl flex items-center justify-between">
          <Link href="/staff/knowledge" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
            <ArrowLeft className="w-4 h-4" />
            Back to Knowledge
          </Link>
          <StaffMenu />
        </div>
      </div>

      {/* Page Title */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <h1 className="text-3xl font-bold">Learning Opportunities</h1>
          <p className="text-muted-foreground mt-2">
            Find the best games to teach based on who's working today
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <LearningOpportunityTool />
      </div>
    </div>
  );
}
