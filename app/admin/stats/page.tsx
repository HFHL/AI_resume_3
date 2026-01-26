'use client';

import { MainLayout } from '@/components/MainLayout';
import { ProcessingStats } from '@/components/ProcessingStats';

export default function StatsPage() {
  return (
    <MainLayout>
      <ProcessingStats />
    </MainLayout>
  );
}
