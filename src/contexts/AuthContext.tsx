/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile, getUserManagementId } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

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
  const loadingProfileRef = useState<{ [key: string]: boolean }>({})[0];

  const resolveRoleFromMetadata = (userToResolve: User | null): string | null => {
    if (!userToResolve) {
      return null;
    }

    const metadataCandidates = [
      userToResolve.app_metadata?.role,
      userToResolve.user_metadata?.role,
      userToResolve.app_metadata?.assigned_role,
      userToResolve.user_metadata?.assigned_role,
    ];

    for (const candidate of metadataCandidates) {
      if (typeof candidate !== 'string') {
        continue;
      }

      const normalized = candidate.trim().toLowerCase();

      if (normalized) {
        return normalized;
      }
    }

    return null;
  };

  const loadUserProfile = async (profileId: string | null) => {
    if (!profileId) {
      setUserProfile(null);
      return;
    }

    // Prevent duplicate calls
    if (loadingProfileRef[profileId]) {
      console.log('⏭️ Pulando carregamento duplicado do perfil');
      return;
    }

    loadingProfileRef[profileId] = true;

    try {
      console.log('📥 Carregando perfil...');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao carregar perfil do usuário:', error);
        setUserProfile(null);
        return;
      }

      console.log('✅ Perfil carregado:', data);
      setUserProfile(data);
    } catch (error) {
      console.error('❌ Erro ao carregar perfil do usuário:', error);
      setUserProfile(null);
    } finally {
      loadingProfileRef[profileId] = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log('🔐 Inicializando autenticação...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setLoading(false);
          return;
        }

        console.log('📋 Sessão:', session ? 'Encontrada' : 'Não encontrada');
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profileId = getUserManagementId(session.user);
          console.log('👤 Carregando perfil do usuário:', profileId ?? 'indisponível');
          await loadUserProfile(profileId);
        }

        setLoading(false);
        console.log('✅ Autenticação inicializada');
      } catch (error) {
        console.error('❌ Erro fatal na inicialização:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 Estado de autenticação mudou:', _event);

      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      // Only load profile on SIGNED_IN event, not on INITIAL_SESSION
      if (_event === 'SIGNED_IN' && session?.user) {
        (async () => {
          const profileId = getUserManagementId(session.user);
          await loadUserProfile(profileId);
        })();
      } else if (!session?.user) {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (username: string, password: string) => {
    try {
      const normalizedUsername = username.trim();

      if (!normalizedUsername) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      let emailToUse: string | null = null;

      const resolveEmailFromUsername = async () => {
        const { data: emailFromRpc, error: emailLookupError } = await supabase.rpc(
          'get_email_by_username',
          { p_username: normalizedUsername }
        );

        if (emailLookupError) {
          return { email: null, error: emailLookupError } as const;
        }

        if (emailFromRpc) {
          return { email: emailFromRpc as string, error: null } as const;
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('username', normalizedUsername)
          .maybeSingle();

        if (profileError) {
          return { email: null, error: profileError } as const;
        }

        return { email: profile?.email ?? null, error: null } as const;
      };

      if (normalizedUsername.includes('@')) {
        emailToUse = normalizedUsername;
      } else {
        const { email, error } = await resolveEmailFromUsername();

        if (error) {
          return { error };
        }

        emailToUse = email;
      }

      if (!emailToUse) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(getUserManagementId(user));
    }
  };

  const metadataRole = resolveRoleFromMetadata(user);
  const role = userProfile?.role ?? metadataRole ?? 'observer';
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
