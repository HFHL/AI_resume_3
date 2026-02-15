'use client';

import { ForgotPassword } from '@/components/ForgotPassword';

export default function ForgotPasswordPage() {
  // Render the forgot-password UI directly (do not wrap with MainLayout)
  // because `MainLayout` renders `<Login />` for unauthenticated users,
  // which would replace this page's content. The reset flow must be
  // visible to unauthenticated visitors.
  return <ForgotPassword />;
}
