/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../features/config';
import { getAuthenticatedUserId } from '../infrastructure/supabase';
import { User, Session } from '@supabase/supabase-js';
import {
  clearLocalAuthSession,
  getCurrentSession,
  loadAuthenticatedUserProfile,
  signInWithUsername,
  signOutAuthenticatedUser,
  signUpWithEmail,
  subscribeToAuthState,
} from '../app/auth/authService';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  role: string;
  isAdmin: boolean;
  isObserver: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: unknown }>;
  signUp: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestId = useRef(0);
  const mountedRef = useRef(true);

  const getAuthErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message?: unknown }).message ?? '');
    }

    return '';
  };

  const isInvalidRefreshTokenError = (error: unknown): boolean => {
    const message = getAuthErrorMessage(error).toLowerCase();
    return (
      message.includes('refresh token is not valid')
      || message.includes('invalid refresh token')
      || message.includes('refresh token not found')
      || message.includes('jwt expired')
    );
  };

  const clearBrokenSession = async () => {
    try {
      await clearLocalAuthSession();
    } catch (error) {
      console.warn('⚠️ Nao foi possivel limpar a sessao local automaticamente:', error);
    }

    profileRequestId.current += 1;
    if (!mountedRef.current) return;

    setSession(null);
    setUser(null);
    setUserProfile(null);
  };

  const loadUserProfile = async (profileId: string | null) => {
    const requestId = profileRequestId.current + 1;
    profileRequestId.current = requestId;

    if (!profileId) {
      if (mountedRef.current) setUserProfile(null);
      return;
    }

    try {
      const data = await loadAuthenticatedUserProfile(profileId);

      if (!mountedRef.current || requestId !== profileRequestId.current) return;

      setUserProfile(data);
    } catch (error) {
      console.error('❌ Erro ao carregar perfil do usuário:', error);
      if (mountedRef.current && requestId === profileRequestId.current) {
        setUserProfile(null);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    const initAuth = async () => {
      try {
        const { session, error } = await getCurrentSession();

        if (!mounted) return;

        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          if (isInvalidRefreshTokenError(error)) {
            await clearBrokenSession();
          }
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profileId = getAuthenticatedUserId(session.user);
          await loadUserProfile(profileId);
        }

        if (!mounted) return;

        setLoading(false);
      } catch (error) {
        console.error('❌ Erro fatal na inicialização:', error);
        if (isInvalidRefreshTokenError(error)) {
          await clearBrokenSession();
        }
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const unsubscribe = subscribeToAuthState((event, session) => {

      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      // Only load profile on SIGNED_IN event, not on INITIAL_SESSION
      if (event === 'SIGNED_IN' && session?.user) {
        (async () => {
          const profileId = getAuthenticatedUserId(session.user);
          await loadUserProfile(profileId);
        })();
      } else if (!session?.user) {
        void loadUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      mountedRef.current = false;
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (username: string, password: string) => {
    return signInWithUsername(username, password);
  };

  const signUp = async (email: string, password: string) => {
    return signUpWithEmail(email, password);
  };

  const signOut = async () => {
    await signOutAuthenticatedUser();
    await loadUserProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(getAuthenticatedUserId(user));
    }
  };

  const role = userProfile?.role ?? 'observer';
  const isAdmin = role === 'admin';
  const isObserver = role === 'observer';

  const value = {
    user,
    session,
    userProfile,
    role,
    isAdmin,
    isObserver,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
