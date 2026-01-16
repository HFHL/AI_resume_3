import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'TalentScout - AI 简历筛选系统',
  description: 'AI 驱动的智能简历筛选与人才管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

