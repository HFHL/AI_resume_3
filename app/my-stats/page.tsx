'use client';

import { MainLayout } from '@/components/MainLayout';
import { UserProcessingStats } from '@/components/UserProcessingStats';

export default function MyStatsPage() {
  return (
    <MainLayout>
      <UserProcessingStats />
    </MainLayout>
  );
}
