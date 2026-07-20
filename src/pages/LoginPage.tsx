import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Button, Input, Surface } from '../design-system';
import { getSupabaseErrorMessage, isSupabaseConnectivityError } from '../lib/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(username, password);

    if (error) {
      const message = getSupabaseErrorMessage(error, 'Usuario ou senha invalidos');
      setError(isSupabaseConnectivityError(error) ? message : 'Usuario ou senha invalidos');
      setLoading(false);
    } else {
      navigate('/painel');
    }
  };

  return (
    <div className="painel-theme kifer-ds theme-light flex min-h-dvh w-full items-center justify-center overflow-hidden [background:var(--surface-hero-bg)] px-4 py-6 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md">
        <Surface variant="strong" padding="lg" className="backdrop-blur-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
              <Lock className="h-8 w-8 text-[color:var(--text-on-brand)]" />
            </div>
            <h1 className="mb-2 font-[var(--font-display)] text-3xl font-bold text-[color:var(--text-primary)]">Kifer Saúde</h1>
            <p className="text-[color:var(--text-secondary)]">Sistema de Gestão de Leads e Contratos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert tone="danger">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              </Alert>
            )}

            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-[color:var(--text-primary)]">
                Usuário
              </label>
              <Input
                id="username"
                type="text"
                leftIcon={User}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                size="large"
                placeholder="seu.usuario"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[color:var(--text-primary)]">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                leftIcon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="large"
                placeholder="********"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              fullWidth
              size="lg"
              className="text-base"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
