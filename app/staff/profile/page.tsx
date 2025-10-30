'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/components/features/staff/ProfileForm';
import { ActivityLog } from '@/components/features/staff/ActivityLog';
import { KnowledgeStats } from '@/components/features/staff/KnowledgeStats';
import { StaffMenu } from '@/components/features/staff/StaffMenu';

interface StaffMember {
  staffId: string;
  stafflistId: string;
  name: string;
  nickname: string | null;
  email: string;
  type: string;
  contactPh: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  nationalIdHash: string | null;
  homeAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPh: string | null;
  dateOfHire: string | null;
  createdAt: string;
  updatedAt: string;
  profileUpdatedAt: string | null;
}

interface StaffStats {
  totalKnowledge: number;
  knowledgeByLevel: {
    beginner: number;
    intermediate: number;
    expert: number;
    instructor: number;
  };
  canTeachCount: number;
  totalPlayLogs: number;
  totalContentChecks: number;
  lastContentCheckDate: string | null;
}

interface ProfileData {
  profile: StaffMember;
  stats: StaffStats;
}

export default function StaffProfilePage() {
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const email = localStorage.getItem('staff_email');
    if (!email) {
      router.push('/auth/signin');
      return;
    }
    setStaffEmail(email);
  }, [router]);

  const fetchProfile = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/staff/profile?email=${encodeURIComponent(email)}`);

      if (response.status === 401 || response.status === 404) {
        // Not authenticated or not found, redirect to sign in
        router.push('/auth/signin');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (staffEmail) {
      fetchProfile(staffEmail);
    }
  }, [staffEmail]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
                <ArrowLeft className="w-4 h-4" />
                Back to Games
              </Link>
            </div>
            <h1 className="text-3xl font-bold">My Profile</h1>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <div className="inline-flex items-center gap-2">
              <User className="w-5 h-5 animate-pulse" />
              <span>Loading profile...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
                <ArrowLeft className="w-4 h-4" />
                Back to Games
              </Link>
            </div>
            <h1 className="text-3xl font-bold">My Profile</h1>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="bg-destructive/10 text-destructive rounded-lg p-4">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No profile data
  if (!profileData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
                <ArrowLeft className="w-4 h-4" />
                Back to Games
              </Link>
            </div>
            <h1 className="text-3xl font-bold">My Profile</h1>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Profile not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
            <StaffMenu />
          </div>
          <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground mt-2">
              {profileData.profile.name}
              {profileData.profile.nickname && ` (${profileData.profile.nickname})`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              View and manage your profile information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="account">Account Information</TabsTrigger>
                <TabsTrigger value="activity">My Activity</TabsTrigger>
                <TabsTrigger value="knowledge">My Knowledge</TabsTrigger>
              </TabsList>

              <TabsContent value="account" className="space-y-4">
                <ProfileForm
                  profile={profileData.profile}
                  onUpdate={() => staffEmail && fetchProfile(staffEmail)}
                />
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <ActivityLog staffId={profileData.profile.stafflistId} />
              </TabsContent>

              <TabsContent value="knowledge" className="space-y-4">
                <KnowledgeStats
                  staffId={profileData.profile.stafflistId}
                  stats={profileData.stats}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
