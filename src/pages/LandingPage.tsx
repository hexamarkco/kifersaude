import { useNavigate } from 'react-router-dom';
import { Heart, Phone, Mail, Award, CheckCircle, Users as UsersIcon, Briefcase } from 'lucide-react';

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
            <div className="flex items-center space-x-4">
              <a href="#contato" className="text-slate-700 hover:text-teal-600 font-medium transition-colors">Contato</a>
              <a href="tel:+5511999999999" className="text-slate-700 hover:text-teal-600 font-medium transition-colors">Telefone</a>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Seu plano de saúde ideal
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600">
                está aqui
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
              Na Kifer Saúde, encontramos o plano de saúde perfeito para você e sua família, com as melhores operadoras e condições especiais
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-lg rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
              >
                Fale Conosco no WhatsApp
              </a>
              <a
                href="tel:+5511999999999"
                className="px-8 py-4 bg-white text-teal-600 text-lg rounded-lg font-semibold hover:bg-slate-50 transition-all shadow-lg hover:shadow-xl border-2 border-teal-600"
              >
                Ligar Agora
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Por que escolher a Kifer Saúde?
            </h2>
            <p className="text-xl text-slate-600">
              Especialistas em planos de saúde com as melhores soluções para você
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Melhores Operadoras
              </h3>
              <p className="text-slate-600">
                Trabalhamos com as principais operadoras do mercado para oferecer os melhores planos para você e sua família
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Atendimento Personalizado
              </h3>
              <p className="text-slate-600">
                Consultoria especializada para encontrar o plano ideal que atende suas necessidades e orçamento
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Planos Completos
              </h3>
              <p className="text-slate-600">
                Planos individuais, familiares, empresariais e MEI com cobertura nacional e rede credenciada ampla
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <UsersIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Suporte Contínuo
              </h3>
              <p className="text-slate-600">
                Acompanhamento completo desde a contratação até o uso do seu plano, sempre que você precisar
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Condições Especiais
              </h3>
              <p className="text-slate-600">
                Negociamos as melhores condições e descontos exclusivos para você economizar no seu plano de saúde
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Atendimento Rápido
              </h3>
              <p className="text-slate-600">
                Entre em contato por telefone ou WhatsApp e receba atendimento imediato de nossos especialistas
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para cuidar da sua saúde?
          </h2>
          <p className="text-xl text-teal-50 mb-8">
            Fale conosco agora e encontre o plano de saúde perfeito para você
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white text-teal-600 text-lg rounded-lg font-semibold hover:bg-slate-50 transition-all shadow-lg hover:shadow-xl"
            >
              Falar no WhatsApp
            </a>
            <a
              href="tel:+5511999999999"
              className="px-8 py-4 bg-teal-700 text-white text-lg rounded-lg font-semibold hover:bg-teal-800 transition-all shadow-lg hover:shadow-xl"
            >
              Ligar Agora
            </a>
          </div>
        </div>
      </section>

      <footer id="contato" className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Heart className="w-6 h-6 text-teal-400" />
                <span className="text-xl font-bold">Kifer Saúde</span>
              </div>
              <p className="text-slate-400">
                Corretora de planos de saúde especializada em encontrar as melhores soluções para você e sua família
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contato</h3>
              <div className="space-y-2 text-slate-400">
                <a href="tel:+5511999999999" className="flex items-center space-x-2 hover:text-teal-400 transition-colors">
                  <Phone className="w-4 h-4" />
                  <span>(11) 99999-9999</span>
                </a>
                <a href="mailto:contato@kifersaude.com.br" className="flex items-center space-x-2 hover:text-teal-400 transition-colors">
                  <Mail className="w-4 h-4" />
                  <span>contato@kifersaude.com.br</span>
                </a>
                <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 hover:text-teal-400 transition-colors">
                  <Phone className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Horário de Atendimento</h3>
              <div className="text-slate-400 space-y-1">
                <p>Segunda a Sexta: 9h às 18h</p>
                <p>Sábado: 9h às 13h</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2025 Kifer Saúde - Corretora de Planos de Saúde. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
