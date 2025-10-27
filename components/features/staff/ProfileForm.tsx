'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, X, Upload, Loader2, AlertCircle, Info } from 'lucide-react';

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

interface ProfileFormProps {
  profile: StaffMember;
  onUpdate: () => void;
}

export function ProfileForm({ profile, onUpdate }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    nickname: profile.nickname || '',
    email: profile.email || '',
    contactPh: profile.contactPh || '',
    bankAccountNumber: profile.bankAccountNumber || '',
    bankName: profile.bankName || '',
    homeAddress: profile.homeAddress || '',
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactPh: profile.emergencyContactPh || '',
  });

  // National ID image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form submission state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Please select a JPG, JPEG, or PNG image');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleUploadNationalId = async () => {
    if (!selectedFile) return;

    try {
      setUploadingImage(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/staff/national-id/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload National ID');
      }

      const data = await response.json();
      setSuccess('National ID uploaded successfully');
      setSelectedFile(null);
      setPreviewUrl(null);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh parent to get updated hash
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload National ID');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic email validation
    if (formData.email && !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`/api/staff/profile?email=${encodeURIComponent(profile.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const data = await response.json();

      // Check if email was changed
      if (data.emailChanged) {
        setSuccess('Profile updated. Redirecting to sign in with new email...');
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      } else {
        setSuccess('Profile updated successfully');
        onUpdate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      nickname: profile.nickname || '',
      email: profile.email || '',
      contactPh: profile.contactPh || '',
      bankAccountNumber: profile.bankAccountNumber || '',
      bankName: profile.bankName || '',
      homeAddress: profile.homeAddress || '',
      emergencyContactName: profile.emergencyContactName || '',
      emergencyContactPh: profile.emergencyContactPh || '',
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-sm flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two-column grid for form fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nickname */}
        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            name="nickname"
            type="text"
            value={formData.nickname}
            onChange={handleInputChange}
            placeholder="Enter nickname"
            disabled={isLoading}
          />
        </div>

        {/* Email with warning */}
        <div className="space-y-2">
          <Label htmlFor="email">
            Email
            <span className="text-xs text-muted-foreground ml-2">(changing requires re-login)</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email"
            disabled={isLoading}
          />
          {formData.email !== profile.email && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              You will need to sign in again with your new email after saving.
            </p>
          )}
        </div>

        {/* Contact Phone */}
        <div className="space-y-2">
          <Label htmlFor="contactPh">Contact Phone</Label>
          <Input
            id="contactPh"
            name="contactPh"
            type="tel"
            value={formData.contactPh}
            onChange={handleInputChange}
            placeholder="Enter phone number"
            disabled={isLoading}
          />
        </div>

        {/* Bank Account Number */}
        <div className="space-y-2">
          <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
          <Input
            id="bankAccountNumber"
            name="bankAccountNumber"
            type="text"
            value={formData.bankAccountNumber}
            onChange={handleInputChange}
            placeholder="Enter bank account number"
            disabled={isLoading}
          />
        </div>

        {/* Bank Name */}
        <div className="space-y-2">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input
            id="bankName"
            name="bankName"
            type="text"
            value={formData.bankName}
            onChange={handleInputChange}
            placeholder="Enter bank name"
            disabled={isLoading}
          />
        </div>

        {/* Emergency Contact Name */}
        <div className="space-y-2">
          <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            type="text"
            value={formData.emergencyContactName}
            onChange={handleInputChange}
            placeholder="Enter emergency contact name"
            disabled={isLoading}
          />
        </div>

        {/* Emergency Contact Phone */}
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPh">Emergency Contact Phone</Label>
          <Input
            id="emergencyContactPh"
            name="emergencyContactPh"
            type="tel"
            value={formData.emergencyContactPh}
            onChange={handleInputChange}
            placeholder="Enter emergency contact phone"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Home Address - Full width */}
      <div className="space-y-2">
        <Label htmlFor="homeAddress">Home Address</Label>
        <Textarea
          id="homeAddress"
          name="homeAddress"
          value={formData.homeAddress}
          onChange={handleInputChange}
          placeholder="Enter home address"
          disabled={isLoading}
          rows={3}
        />
      </div>

      {/* National ID Image Upload Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <Label>National ID Image</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a photo of your National ID (JPG, JPEG, PNG - Max 10MB)
          </p>
        </div>

        {/* Current National ID */}
        {profile.nationalIdHash && !previewUrl && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Current National ID:</p>
            <div className="border border-border rounded-lg p-2 bg-muted/30">
              <img
                src={`/api/staff/national-id/${profile.nationalIdHash}`}
                alt="Current National ID"
                className="max-w-md w-full h-auto rounded"
              />
            </div>
          </div>
        )}

        {/* Preview new image */}
        {previewUrl && (
          <div className="space-y-2">
            <p className="text-sm font-medium">New National ID Preview:</p>
            <div className="border border-primary rounded-lg p-2 bg-primary/5">
              <img
                src={previewUrl}
                alt="New National ID preview"
                className="max-w-md w-full h-auto rounded"
              />
            </div>
          </div>
        )}

        {/* File input and upload button */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handleFileSelect}
              disabled={isLoading || uploadingImage}
            />
          </div>
          {selectedFile && (
            <Button
              type="button"
              onClick={handleUploadNationalId}
              disabled={uploadingImage || isLoading}
              variant="outline"
              className="gap-2"
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isLoading}
          className="gap-2"
        >
          <X className="w-4 h-4" />
          Reset
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="gap-2 min-w-32"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
