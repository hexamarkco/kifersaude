import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Alert,
  Button,
  Field,
  Heading,
  Input,
  PublicShell,
  Surface,
  Text,
} from '../design-system';
import { getSupabaseErrorMessage, isSupabaseConnectivityError } from '../infrastructure/supabase';

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
      const message = await getSupabaseErrorMessage(error, 'Usuário ou senha inválidos');
      setError(isSupabaseConnectivityError(error) ? message : 'Usuário ou senha inválidos. Verifique suas credenciais e tente novamente.');
      setLoading(false);
    } else {
      navigate('/painel');
    }
  };

  return (
    <PublicShell
      theme="dark"
      width="narrow"
      className="flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-6 sm:py-12"
    >
      <div className="w-full">
        <Surface variant="strong" padding="lg" className="backdrop-blur-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)] shadow-[var(--shadow-button)]">
              <Lock className="h-8 w-8 text-[color:var(--text-on-brand)]" />
            </div>
            <Heading level={1} size="lg">Kifer Saúde</Heading>
            <Text> Sistema de Gestão de Leads e Contratos</Text>
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

            <Field label="Usuário" htmlFor="username">
              <Input
                id="username"
                type="text"
                leftIcon={User}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                size="lg"
                placeholder="seu.usuario"
              />
            </Field>

            <Field label="Senha" htmlFor="password">
              <Input
                id="password"
                type="password"
                leftIcon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="lg"
                placeholder="********"
              />
            </Field>

            <Button
              type="submit"
              disabled={loading}
              fullWidth
              size="lg"
              
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Surface>
      </div>
    </PublicShell>
  );
}
