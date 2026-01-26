'use client';

import { MainLayout } from '@/components/MainLayout';
import { UserManagement } from '@/components/UserManagement';

export default function UsersPage() {
  return (
    <MainLayout>
      <UserManagement />
    </MainLayout>
  );
}
