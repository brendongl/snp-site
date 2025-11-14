'use client';

import { Geist, Geist_Mono, DM_Sans, Inter } from "next/font/google";
import "./globals.css";
import { usePageView } from "@/lib/hooks/usePageView";
import { useAdminMode } from "@/lib/hooks/useAdminMode";
import { ToastProvider } from "@/lib/context/toast-context";
import { ToastContainer } from "@/components/ui/toast-container";
import { AdminStaffPOSHeader } from "@/components/features/admin/AdminStaffPOSHeader";
import { PersistentStaffHeader } from "@/components/features/staff/PersistentStaffHeader";
import { SwitchGameToast } from "@/components/features/switch/SwitchGameToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  usePageView();
  const isAdmin = useAdminMode();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${inter.variable} antialiased`}
      >
        <ToastProvider>
          {/* Admin: Combined POS + Staff Header */}
          {isAdmin && <AdminStaffPOSHeader />}

          {/* Non-Admin Staff: Simple Staff Header */}
          {!isAdmin && <PersistentStaffHeader />}

          {/* Add padding to compensate for fixed header */}
          <div className="pt-10">
            {children}
          </div>

          <ToastContainer />
          <SwitchGameToast />
        </ToastProvider>
      </body>
    </html>
  );
}
