import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Alert,
  BrandWordmark,
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
      theme="light"
      width="narrow"
      className="kds-login-page flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-6 sm:py-12"
    >
      <div className="w-full">
        <Surface padding="lg" className="kds-login-card">
          <div className="kds-login-heading">
            <BrandWordmark />
            <Heading family="interface" level={1} size="display">Bem-vindo ao CRM</Heading>
            <Text size="sm">Entre com seu usuário e senha para acessar o sistema.</Text>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert tone="danger">
                <div className="flex items-center gap-3">
                  <AlertCircle className="kds-control-icon shrink-0" />
                  <Text as="span" size="sm">{error}</Text>
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
                autoComplete="username"
                required
                size="md"
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
                autoComplete="current-password"
                required
                size="md"
                placeholder="********"
              />
            </Field>

            <Button
              type="submit"
              disabled={loading}
              size="md"
            >
              {loading ? 'Entrando...' : <>Entrar no CRM <ArrowRight className="kds-control-icon" aria-hidden="true" /></>}
            </Button>
          </form>

          <Text size="sm" tone="muted" className="kds-login-access-note">
            Acesso exclusivo para pessoas autorizadas.
          </Text>
        </Surface>
      </div>
    </PublicShell>
  );
}
