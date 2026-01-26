'use client';

import { MainLayout } from '@/components/MainLayout';
import { UserProfile } from '@/components/UserProfile';

export default function ProfilePage() {
  return (
    <MainLayout>
      <UserProfile />
    </MainLayout>
  );
}
