'use client';

import { MainLayout } from '@/components/MainLayout';
import { UploadCenter } from '@/components/UploadCenter';

export default function UploadPage() {
  const handleViewResume = (candidateId: string) => {
    const url = `/resumes/${candidateId}`;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  };

  return (
    <MainLayout>
      <UploadCenter onViewClick={handleViewResume} />
    </MainLayout>
  );
}
