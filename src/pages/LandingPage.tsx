import { useState } from 'react';
import { Heart, Phone, Mail, Award, CheckCircle, Users as UsersIcon, Briefcase, Shield, Zap, Search, MessageCircle, Star, TrendingUp, Clock, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    idade: '',
    tipoContratacao: 'PF'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `*Nova Cotação - Landing Page*\n\nNome: ${formData.nome}\nTelefone: ${formData.telefone}\nCidade: ${formData.cidade}\nIdade: ${formData.idade}\nTipo: ${formData.tipoContratacao}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/5511999999999?text=${encodedMessage}`, '_blank');
  };

  const scrollToForm = () => {
    document.getElementById('cotacao')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2 px-4 text-center text-sm font-medium z-50 shadow-md">
        Atendimento rápido via WhatsApp — clique aqui 📲
        <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="ml-2 underline hover:text-orange-100">
          Falar agora
        </a>
      </div>

      <a
        href="https://wa.me/5511999999999"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl z-50 transition-transform hover:scale-110"
        title="Falar no WhatsApp"
      >
        <MessageCircle className="w-8 h-8" />
      </a>

      <nav className="fixed top-10 w-full bg-white/95 backdrop-blur-sm shadow-sm z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">Kifer Saúde</span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <a href="#quem-somos" className="text-slate-700 hover:text-orange-600 font-medium transition-colors">Quem Somos</a>
              <a href="#como-funciona" className="text-slate-700 hover:text-orange-600 font-medium transition-colors">Como Funciona</a>
              <a href="#contato" className="text-slate-700 hover:text-orange-600 font-medium transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-400 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            <div className="mb-6 flex justify-center gap-4">
              <span className="inline-flex items-center px-4 py-2 bg-white rounded-full text-sm font-semibold text-orange-700 shadow-md">
                <Shield className="w-4 h-4 mr-2" />
                Corretora registrada na ANS
              </span>
              <span className="inline-flex items-center px-4 py-2 bg-white rounded-full text-sm font-semibold text-orange-700 shadow-md">
                <Heart className="w-4 h-4 mr-2" />
                Atendimento humanizado
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
              O plano de saúde certo muda tudo —
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600 mt-2">
                inclusive o quanto você paga.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-700 mb-10 max-w-3xl mx-auto font-light">
              Compare opções, reduza custos e escolha a proteção ideal para você e sua família.
            </p>

            <button
              onClick={scrollToForm}
              className="px-10 py-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg md:text-xl rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-2xl hover:shadow-orange-300 hover:scale-105 transform"
            >
              Fazer minha cotação agora
              <ChevronRight className="inline-block ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section id="quem-somos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="w-full h-96 bg-gradient-to-br from-orange-200 to-amber-200 rounded-3xl overflow-hidden shadow-2xl">
                <div className="w-full h-full flex items-center justify-center">
                  <UsersIcon className="w-48 h-48 text-orange-400 opacity-50" />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                Quem Somos
              </h2>
              <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl mb-6">
                <p className="text-lg text-slate-700 italic mb-4">
                  "Sou a Luiza Kifer, especialista em planos de saúde há mais de 10 anos. Acredito que contratar um plano não é só uma escolha financeira — é uma decisão sobre cuidado, segurança e tranquilidade."
                </p>
                <p className="text-sm text-slate-600 font-semibold">— Luiza Kifer, Fundadora</p>
              </div>
              <p className="text-lg text-slate-700 mb-6">
                A Kifer Saúde nasceu para simplificar o acesso aos melhores planos, com atendimento humano e soluções que cabem no seu bolso.
              </p>
              <a href="#cotacao" className="text-orange-600 font-semibold hover:text-orange-700 inline-flex items-center">
                Conheça nossa história completa
                <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Como Funciona
            </h2>
            <p className="text-xl text-slate-600">
              Simples, rápido e sem burocracia
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                1
              </div>
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <MessageCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4 text-center">
                Conte sobre você
              </h3>
              <p className="text-slate-600 text-center">
                Informe idade, cidade e quem deseja incluir no plano.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                2
              </div>
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Search className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4 text-center">
                Receba as opções
              </h3>
              <p className="text-slate-600 text-center">
                Comparativos claros com valores e coberturas personalizadas.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                3
              </div>
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <CheckCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4 text-center">
                Escolha e ative
              </h3>
              <p className="text-slate-600 text-center">
                Sem burocracia, com acompanhamento até a carteirinha.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Operadoras Parceiras
            </h2>
            <p className="text-xl text-slate-600">
              Trabalhamos apenas com operadoras reconhecidas e regulamentadas pela ANS
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 items-center">
            {['SulAmérica', 'Amil', 'Bradesco Saúde', 'Porto Seguro', 'Unimed', 'MedSênior', 'Leve Saúde', 'Prevent Senior', 'NotreDame', 'Hapvida'].map((operadora) => (
              <div key={operadora} className="bg-slate-50 rounded-xl p-6 flex items-center justify-center h-24 hover:shadow-lg transition-shadow">
                <span className="text-slate-600 font-semibold text-center">{operadora}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Depoimentos Reais
            </h2>
            <p className="text-xl text-slate-600">
              O que nossos clientes dizem sobre nós
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 italic">
                "Eu achava que plano bom era caro, mas com a Luiza consegui pagar menos e ainda ter Rede D'Or. Atendimento nota 10!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-700 font-bold">R</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Regina</p>
                  <p className="text-sm text-slate-600">44 anos</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 italic">
                "Atendimento super rápido pelo WhatsApp. Em menos de 1 hora já tinha minha cotação com várias opções."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-700 font-bold">M</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Marcelo</p>
                  <p className="text-sm text-slate-600">38 anos</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 italic">
                "Excelente suporte durante todo o processo. A Kifer Saúde realmente se importa com o cliente!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-700 font-bold">A</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Ana Paula</p>
                  <p className="text-sm text-slate-600">52 anos</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <a href="#" className="text-orange-600 font-semibold hover:text-orange-700 inline-flex items-center">
              Mais avaliações no Google
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-500 to-amber-600">
        <div className="max-w-5xl mx-auto text-center">
          <div className="bg-white rounded-3xl p-12 shadow-2xl">
            <TrendingUp className="w-16 h-16 text-orange-600 mx-auto mb-6" />
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Planos para Empresas e MEI
            </h2>
            <p className="text-xl text-slate-700 mb-8">
              Tem CNPJ ou MEI? Você pode economizar até 40% no plano de saúde.
            </p>
            <button onClick={scrollToForm} className="px-10 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg">
              Ver planos empresariais
            </button>
            <p className="mt-6 text-sm text-slate-600 font-semibold">
              🏆 Mais vendidos para MEI
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Por Que Escolher a Kifer Saúde
            </h2>
            <p className="text-xl text-slate-600">
              O que nos torna diferentes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Heart className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Atendimento humanizado</h3>
              <p className="text-slate-600">Tratamos cada cliente com cuidado e atenção personalizada</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Zap className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Resposta rápida via WhatsApp</h3>
              <p className="text-slate-600">Atendimento ágil e eficiente pelo canal que você prefere</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Phone className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Suporte durante toda vigência</h3>
              <p className="text-slate-600">Estamos com você em todos os momentos</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Search className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Cotações personalizadas</h3>
              <p className="text-slate-600">Sem custo e totalmente adaptadas ao seu perfil</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Shield className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Parceiros certificados pela ANS</h3>
              <p className="text-slate-600">Trabalhamos apenas com operadoras regulamentadas</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Clock className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Atendimento em até 10 minutos</h3>
              <p className="text-slate-600">Resposta rápida para suas dúvidas e cotações</p>
            </div>
          </div>
        </div>
      </section>

      <section id="cotacao" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Faça sua Cotação Personalizada
            </h2>
            <p className="text-xl text-orange-50">
              Prometemos zero spam. Seu contato é usado apenas para enviar as melhores opções.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Telefone (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Cidade *
                </label>
                <input
                  type="text"
                  required
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="Sua cidade"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Idade dos Beneficiários *
                </label>
                <input
                  type="text"
                  required
                  value={formData.idade}
                  onChange={(e) => setFormData({ ...formData, idade: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="Ex: 35, 32, 8"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tipo de Contratação *
              </label>
              <select
                value={formData.tipoContratacao}
                onChange={(e) => setFormData({ ...formData, tipoContratacao: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              >
                <option value="PF">Pessoa Física</option>
                <option value="MEI">MEI</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              Quero minha cotação personalizada agora
              <ChevronRight className="inline-block ml-2 w-5 h-5" />
            </button>

            <p className="text-center text-sm text-slate-500 mt-4">
              ⏱️ Resposta em até 10 minutos
            </p>
          </form>
        </div>
      </section>

      <footer id="contato" className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">Kifer Saúde</span>
              </div>
              <p className="text-slate-400 mb-4">
                Kifer Saúde é uma corretora registrada na ANS, especializada em planos individuais, familiares e empresariais.
              </p>
              <p className="text-slate-500 text-sm">
                CNPJ: 00.000.000/0001-00
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Links Rápidos</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-orange-400 transition-colors">Home</a></li>
                <li><a href="#quem-somos" className="hover:text-orange-400 transition-colors">Sobre</a></li>
                <li><a href="#contato" className="hover:text-orange-400 transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-orange-400 transition-colors">Política de Privacidade</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contato</h3>
              <div className="space-y-3 text-slate-400">
                <a href="tel:+5511999999999" className="flex items-center hover:text-orange-400 transition-colors">
                  <Phone className="w-4 h-4 mr-2" />
                  (11) 99999-9999
                </a>
                <a href="mailto:contato@kifersaude.com.br" className="flex items-center hover:text-orange-400 transition-colors">
                  <Mail className="w-4 h-4 mr-2" />
                  contato@kifersaude.com.br
                </a>
                <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-orange-400 transition-colors">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>&copy; 2025 Kifer Saúde - Corretora de Planos de Saúde. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
