'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import type { UserProfile, ApprovalStatus, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  profile: UserProfile | null;
  approvalStatus: ApprovalStatus | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string) => Promise<{ error: any }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: any; data: any }>;
  updateDisplayName: (displayName: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (u: User | null): Promise<UserProfile | null> => {
    if (!u) return null;
    try {
      // Add timeout to avoid hanging if profiles table doesn't exist or RLS blocks
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('fetchProfile timed out, continuing without profile');
          resolve(null);
        }, 5000);
      });

      const fetchPromise = (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id,email,display_name,role,approval_status,created_at,updated_at')
          .eq('user_id', u.id)
          .maybeSingle();

        if (error) {
          // If table doesn't exist or permission denied, just return null gracefully
          console.warn('fetchProfile error (may be expected if profiles table not set up):', error.message);
          return null;
        }
        return (data as any) || null;
      })();

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (e: any) {
      console.error('fetchProfile failed:', e);
      return null;
    }
  };

  // Bootstrap super admin emails (same as database function is_bootstrap_super_admin)
  const BOOTSTRAP_SUPER_ADMIN_EMAILS = ['1563478934@qq.com', 'feiyuzi51@gmail.com'];

  const applyProfileState = (p: UserProfile | null, userEmail?: string | null) => {
    setProfile(p);
    setApprovalStatus((p?.approval_status as any) || null);
    setRole((p?.role as any) || null);
    
    // Check if user is admin:
    // 1. Bootstrap super admin by email (always admin, regardless of profile)
    // 2. Or profile has approved status + admin/super_admin role
    const isBootstrapAdmin = userEmail && BOOTSTRAP_SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase());
    const isProfileAdmin = Boolean(p && p.approval_status === 'approved' && (p.role === 'admin' || p.role === 'super_admin'));
    
    setIsAdmin(isBootstrapAdmin || isProfileAdmin);
    // 统一只从 profiles 表获取 display_name
    setDisplayName(p?.display_name || null);
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const u = session?.user ?? null;
      setUser(u);
      const p = await fetchProfile(u);
      applyProfileState(p, u?.email);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const u = session?.user ?? null;
      setUser(u);
      const p = await fetchProfile(u);
      applyProfileState(p, u?.email);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string) => {
    // Magic link login (optional, but good to have)
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) return { error };

    // Enforce approval: if not approved, immediately sign out and block.
    const { data: { user: u } } = await supabase.auth.getUser();
    const p = await fetchProfile(u ?? null);
    applyProfileState(p, u?.email);

    if (!p) {
      await supabase.auth.signOut();
      return { error: new Error('账号资料未初始化，请联系管理员') };
    }
    if (p.approval_status !== 'approved') {
      await supabase.auth.signOut();
      const msg =
        p.approval_status === 'pending'
          ? '账号待管理员审批，通过后才能登录'
          : '账号已被管理员拒绝，请联系管理员';
      return { error: new Error(msg) };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // 只在 profiles 表存储 display_name
    if (!error && data?.user) {
      try {
        const payload = {
          user_id: data.user.id,
          email: data.user.email,
          display_name: displayName.trim(),
          role: 'user',
          approval_status: 'pending',
        };
        const { error: pErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
        if (pErr) console.error('profiles upsert failed:', pErr);
      } catch (e) {
        console.error('profiles upsert exception:', e);
      }

      // Make signup an "application": do not keep a logged-in session.
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    return { data, error };
  };

  const updateDisplayName = async (newDisplayName: string) => {
    const trimmed = newDisplayName.trim();
    if (!trimmed) return { error: new Error('显示名称不能为空') };

    if (!user?.id) return { error: new Error('用户未登录') };

    // 只更新 profiles 表
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('user_id', user.id);

    if (!error) {
      setDisplayName(trimmed);
      const p = await fetchProfile(user);
      applyProfileState(p, user?.email);
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setProfile(null);
    setApprovalStatus(null);
    setRole(null);
    setIsAdmin(false);
    setDisplayName(null);
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, displayName, profile, approvalStatus, role, isAdmin, loading, signIn, signInWithPassword, signUp, updateDisplayName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

