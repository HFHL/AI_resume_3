'use client';

import { MainLayout } from '@/components/MainLayout';
import { JobList } from '@/components/JobList';

export default function JobsPage() {
  return (
    <MainLayout>
      <JobList />
    </MainLayout>
  );
}
