import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
    <div className="kifer-ds flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(223,139,47,0.42),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(122,62,22,0.28),transparent_36%),linear-gradient(135deg,#1a120d_0%,#2b1b12_42%,#7a3e16_100%)] px-4 py-6 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="rounded-3xl border border-[color:rgba(111,63,22,0.18)] bg-[color:rgba(255,251,245,0.96)] p-6 shadow-[0_28px_70px_-32px_rgba(18,10,6,0.72)] backdrop-blur-sm sm:p-8">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#7a3e16] to-[#c86f1d] shadow-lg shadow-[#7a3e16]/20">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-[#1a120d]">Kifer Saúde</h1>
            <p className="text-[#6b5645]">Sistema de Gestão de Leads e Contratos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-[#5b4635]">
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-[#a38975]" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#d4c0a7] bg-white px-4 py-3 pl-10 text-[#1a120d] focus:border-transparent focus:ring-2 focus:ring-[#c86f1d]"
                  placeholder="seu.usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#5b4635]">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-[#a38975]" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#d4c0a7] bg-white px-4 py-3 pl-10 text-[#1a120d] focus:border-transparent focus:ring-2 focus:ring-[#c86f1d]"
                  placeholder="********"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-[#7a3e16] to-[#c86f1d] py-3 font-semibold text-white transition-all hover:from-[#683312] hover:to-[#af5e18] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
