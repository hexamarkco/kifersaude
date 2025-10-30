import { useNavigate } from 'react-router-dom';
import { Heart, Phone, Mail, TrendingUp, Users, Shield, Clock } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed w-full bg-white/95 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Heart className="w-8 h-8 text-teal-600" />
              <span className="text-2xl font-bold text-slate-900">Kifer Saúde</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all"
            >
              Acessar Sistema
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Gestão Inteligente de
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600">
                Planos de Saúde
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
              Sistema completo para gerenciar leads, contratos e comissões de planos de saúde com eficiência e praticidade
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-lg rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
            >
              Começar Agora
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Por que escolher o Kifer Saúde?
            </h2>
            <p className="text-xl text-slate-600">
              Ferramentas poderosas para maximizar seus resultados
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Gestão de Leads
              </h3>
              <p className="text-slate-600">
                Organize e acompanhe todos os seus leads em um só lugar, com status personalizáveis e histórico completo
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Controle de Comissões
              </h3>
              <p className="text-slate-600">
                Calcule automaticamente suas comissões e acompanhe o faturamento de cada contrato em tempo real
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Lembretes Automáticos
              </h3>
              <p className="text-slate-600">
                Nunca perca uma renovação ou follow-up com nosso sistema inteligente de notificações e lembretes
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Segurança Total
              </h3>
              <p className="text-slate-600">
                Seus dados protegidos com criptografia de ponta e backups automáticos em nuvem
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Dashboard Intuitivo
              </h3>
              <p className="text-slate-600">
                Visualize todas as métricas importantes em gráficos e relatórios de fácil compreensão
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Integração WhatsApp
              </h3>
              <p className="text-slate-600">
                Envie mensagens diretamente pelo WhatsApp com apenas um clique, otimizando seu atendimento
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para transformar sua gestão?
          </h2>
          <p className="text-xl text-teal-50 mb-8">
            Junte-se aos profissionais que já estão otimizando seus resultados
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-white text-teal-600 text-lg rounded-lg font-semibold hover:bg-slate-50 transition-all shadow-lg hover:shadow-xl"
          >
            Acessar Sistema
          </button>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Heart className="w-6 h-6 text-teal-400" />
                <span className="text-xl font-bold">Kifer Saúde</span>
              </div>
              <p className="text-slate-400">
                Sistema completo de gestão para profissionais de planos de saúde
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contato</h3>
              <div className="space-y-2 text-slate-400">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>(11) 99999-9999</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>contato@kifersaude.com.br</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Acesso Rápido</h3>
              <button
                onClick={() => navigate('/login')}
                className="text-teal-400 hover:text-teal-300 transition-colors"
              >
                Login →
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2025 Kifer Saúde. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
