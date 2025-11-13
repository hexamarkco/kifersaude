import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isObserver: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
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

  const loadUserProfile = async (userId: string) => {
    // Prevent duplicate calls
    if (loadingProfileRef[userId]) {
      console.log('⏭️ Pulando carregamento duplicado do perfil');
      return;
    }

    loadingProfileRef[userId] = true;

    try {
      console.log('📥 Carregando perfil...');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
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
      loadingProfileRef[userId] = false;
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
          console.log('👤 Carregando perfil do usuário:', session.user.id);
          await loadUserProfile(session.user.id);
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
          await loadUserProfile(session.user.id);
        })();
      } else if (!session?.user) {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const normalizedUsername = username.trim();

      if (!normalizedUsername) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('username', normalizedUsername)
        .maybeSingle();

      if (profileError) {
        return { error: profileError };
      }

      if (!profile?.email) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
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
      await loadUserProfile(user.id);
    }
  };

  const isAdmin = userProfile?.role === 'admin';
  const isObserver = userProfile?.role === 'observer';

  const value = {
    user,
    session,
    userProfile,
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
