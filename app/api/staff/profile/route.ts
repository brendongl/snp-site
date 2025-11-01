import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get email from query parameter
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    // Use DatabaseService singleton
    const db = DatabaseService.initialize();

    // Get staff member by email
    const staff = await db.staff.getStaffByEmail(email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Get staff stats
    const stats = await db.staff.getStaffStats(staff.id);

    return NextResponse.json({
      profile: staff,
      stats,
    });
  } catch (error) {
    console.error('Error fetching staff profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    // Get email from query parameter
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    // Use DatabaseService singleton
    const db = DatabaseService.initialize();

    // Get staff member by email
    const staff = await db.staff.getStaffByEmail(email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const updates = await request.json();

    // Validate editable fields only
    const allowedFields = [
      'nickname',
      'email',
      'contactPh',
      'bankAccountNumber',
      'bankName',
      'homeAddress',
      'emergencyContactName',
      'emergencyContactPh',
    ];

    const filteredUpdates: any = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Check if email is being changed
    const emailChanged = filteredUpdates.email &&
                        filteredUpdates.email.toLowerCase() !== staff.email.toLowerCase();

    // Update profile
    const success = await db.staff.updateStaffProfile(
      staff.id,
      filteredUpdates
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailChanged,
      message: emailChanged
        ? 'Profile updated. Please log in with your new email.'
        : 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating staff profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
