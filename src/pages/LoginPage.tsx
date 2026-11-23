import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, User, AlertCircle, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Alert,
  BrandWordmark,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Heading,
  IconButton,
  Input,
  PublicShell,
  Text,
} from '../design-system';
import { getSupabaseErrorMessage, isSupabaseConnectivityError } from '../infrastructure/supabase';

const REMEMBERED_USERNAME = 'kifer-painel-remembered-username';

function getRememberedUsername() {
  try { return localStorage.getItem(REMEMBERED_USERNAME) ?? ''; }
  catch { return ''; }
}

export default function LoginPage() {
  const [username, setUsername] = useState(getRememberedUsername);
  const [rememberUsername, setRememberUsername] = useState(() => Boolean(getRememberedUsername()));
  const [passwordHelpOpen, setPasswordHelpOpen] = useState(false);
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
      if (rememberUsername) {
        try { localStorage.setItem(REMEMBERED_USERNAME, username.trim()); }
        catch { /* Signing in works when browser storage is unavailable. */ }
      }
      navigate('/painel');
    }
  };

  return (
    <PublicShell theme="light" width="full" className="kds-login-page">
      <main className="kds-login-layout">
        <aside className="kds-login-brand-panel" aria-label="Painel Kifer Saúde">
          <div className="kds-login-brand-header">
            <BrandWordmark variant="lockup" />
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
          <footer className="kds-login-brand-signature"><span>Pessoas no centro. Sempre.</span><span>Kifer Saúde</span></footer>
        </aside>

        <section className="kds-login-form-panel" aria-labelledby="login-title">
          <div className="kds-login-card">
            <header className="kds-login-heading">
              <Text className="kds-login-eyebrow">Seu espaço de trabalho</Text>
              <Heading family="display" level={1} id="login-title">Bom ter você por aqui.</Heading>
              <Text size="sm">Entre para acompanhar a operação.</Text>
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

              <Field label="Usuário *" htmlFor="username">
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

              <Field label="Senha *" htmlFor="password">
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

              <div className="kds-login-form-options">
                <FieldLabel><Checkbox checked={rememberUsername} onChange={(event) => {
                  setRememberUsername(event.target.checked);
                  if (!event.target.checked) {
                    try { localStorage.removeItem(REMEMBERED_USERNAME); }
                    catch { /* Storage may be unavailable. */ }
                  }
                }} />Lembrar meu usuário</FieldLabel>
                <Button type="button" variant="text" size="sm" onClick={() => setPasswordHelpOpen(true)}>Esqueci minha senha</Button>
              </div>

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
      <Dialog open={passwordHelpOpen} onOpenChange={setPasswordHelpOpen} size="sm">
        <DialogHeader onClose={() => setPasswordHelpOpen(false)}><DialogTitle>Recuperar acesso</DialogTitle></DialogHeader>
        <DialogBody><Text>Peça a uma pessoa administradora do painel para redefinir a senha da sua conta. Tenha seu nome de usuário em mãos.</Text></DialogBody>
        <DialogFooter><Button type="button" onClick={() => setPasswordHelpOpen(false)}>Entendi</Button></DialogFooter>
      </Dialog>
    </PublicShell>
  );
}
