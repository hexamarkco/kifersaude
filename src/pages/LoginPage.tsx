import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, User, AlertCircle, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Alert,
  BrandWordmark,
  Button,
  Field,
  Heading,
  IconButton,
  Input,
  PublicShell,
  Text,
} from '../design-system';
import { getSupabaseErrorMessage, isSupabaseConnectivityError } from '../infrastructure/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <PublicShell theme="light" width="full" className="kds-login-page">
      <main className="kds-login-layout">
        <aside className="kds-login-brand-panel" aria-label="Painel Kifer Saúde">
          <div className="kds-login-brand-header">
            <BrandWordmark />
            <Text as="span" className="kds-login-brand-label">PAINEL</Text>
          </div>

          <div className="kds-login-brand-copy">
            <Text className="kds-login-eyebrow">Nosso trabalho começa com pessoas</Text>
            <Heading level={2} family="display" className="kds-login-brand-title">
              Cuidar começa com uma boa conversa.
            </Heading>
            <Text className="kds-login-brand-description">
              Um espaço para conectar histórias, acompanhar oportunidades e estar mais perto de quem precisa.
            </Text>
          </div>

          <div className="kds-login-brand-art" aria-hidden="true" />
          <Text className="kds-login-brand-signature">Pessoas no centro. Sempre.</Text>
        </aside>

        <section className="kds-login-form-panel" aria-labelledby="login-title">
          <div className="kds-login-card">
            <header className="kds-login-heading">
              <Text className="kds-login-eyebrow">Seu espaço de trabalho</Text>
              <Heading family="display" level={1} id="login-title">Bem-vindo ao painel</Heading>
              <Text size="sm">Entre com seu usuário e senha para continuar.</Text>
            </header>

            <form onSubmit={handleSubmit} className="kds-login-form" aria-busy={loading}>
              {error && (
                <Alert tone="danger" id="login-error" role="alert">
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
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby={error ? 'login-error' : undefined}
                  invalid={Boolean(error)}
                  aria-invalid={error ? true : undefined}
                  required
                  size="lg"
                  placeholder="Digite seu usuário"
                />
              </Field>

              <Field label="Senha" htmlFor="password">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  leftIcon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-describedby={error ? 'login-error' : undefined}
                  invalid={Boolean(error)}
                  aria-invalid={error ? true : undefined}
                  required
                  size="lg"
                  placeholder="Digite sua senha"
                  action={(
                    <IconButton type="button" variant="ghost" size="md"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      aria-controls="password"
                      onClick={() => setShowPassword((current) => !current)}>
                      {showPassword ? <EyeOff className="kds-control-icon" aria-hidden="true" /> : <Eye className="kds-control-icon" aria-hidden="true" />}
                    </IconButton>
                  )}
                />
              </Field>

              <Button
                type="submit"
                loading={loading}
                size="lg"
                fullWidth
                className="kds-login-submit"
              >
                {loading ? 'Entrando...' : <>Entrar no painel <ArrowRight className="kds-control-icon" aria-hidden="true" /></>}
              </Button>
            </form>

            <Text size="sm" tone="muted" className="kds-login-access-note">
              <LockKeyhole className="kds-control-icon" aria-hidden="true" />
              Acesso exclusivo para pessoas autorizadas.
            </Text>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
