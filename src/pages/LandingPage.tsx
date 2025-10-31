import { useState, useEffect } from 'react';
import { Heart, Phone, Mail, Award, CheckCircle, Users as UsersIcon, Briefcase, Shield, Zap, Search, MessageCircle, Star, TrendingUp, Clock, ChevronRight, X, ChevronDown, Calendar, FileText, ThumbsUp, MapPin, Instagram } from 'lucide-react';

export default function LandingPage() {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    idade: '',
    tipoContratacao: 'PF'
  });
  const [showModal, setShowModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showHistoriaModal, setShowHistoriaModal] = useState(false);
  const [showAvaliacoesModal, setShowAvaliacoesModal] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const faqData = [
    {
      question: "Qual a diferença entre pessoa física e MEI?",
      answer: "Planos para pessoa física são individuais ou familiares contratados em seu nome. Já planos MEI ou empresariais são contratados através de CNPJ e costumam ter valores mais atrativos, podendo economizar até 40% comparado ao plano PF."
    },
    {
      question: "Quanto tempo demora para o plano ser ativado?",
      answer: "Após a aprovação da proposta, o prazo de ativação varia de 2 a 15 dias úteis, dependendo da operadora escolhida. Alguns planos têm ativação imediata!"
    },
    {
      question: "Posso incluir minha família no plano?",
      answer: "Sim! Você pode incluir cônjuge, filhos e dependentes legais no mesmo plano. Quanto mais pessoas, melhor costuma ser o custo-benefício."
    },
    {
      question: "Existe carência para usar o plano?",
      answer: "Sim, a maioria dos planos tem período de carência que varia de acordo com o tipo de procedimento. Urgências e emergências têm carência de apenas 24h. Consultas e exames simples geralmente têm carência de 30 dias."
    },
    {
      question: "Posso escolher meus médicos e hospitais?",
      answer: "Depende do tipo de plano. Planos com livre escolha permitem atendimento em qualquer profissional ou hospital credenciado. Já planos com referência têm uma rede específica, mas costumam ter valores mais acessíveis."
    },
    {
      question: "O que é coparticipação?",
      answer: "Coparticipação é quando você paga uma mensalidade mais baixa, mas arca com uma parte do custo de cada consulta ou exame realizado. É uma ótima opção para quem usa pouco o plano."
    },
    {
      question: "Posso cancelar o plano quando quiser?",
      answer: "Sim! Planos de saúde não têm fidelidade. Você pode cancelar a qualquer momento, sem multas ou taxas. Basta solicitar o cancelamento com 30 dias de antecedência."
    },
    {
      question: "Qual a diferença entre abrangência estadual e nacional?",
      answer: "Planos estaduais cobrem apenas o estado onde você contratou (mais baratos). Planos nacionais cobrem todo o Brasil, ideais para quem viaja muito ou tem família em outros estados."
    }
  ];

  const allBlogPosts = [
    {
      title: "Como escolher o plano de saúde ideal para sua família",
      excerpt: "Descubra os principais critérios para avaliar e escolher o melhor plano de saúde considerando sua realidade familiar. Entenda sobre abrangência, carências e coberturas.",
      date: "15 de Janeiro, 2025",
      category: "Guias",
      readTime: "8 min",
      content: `
        <h2>Entendendo suas necessidades</h2>
        <p>Escolher um plano de saúde para a família é uma decisão importante que impacta o bem-estar de todos. O primeiro passo é fazer um levantamento das necessidades específicas de cada membro da família.</p>

        <h3>1. Analise o perfil da sua família</h3>
        <p>Considere a faixa etária de cada pessoa, condições de saúde pré-existentes, frequência de uso de serviços médicos e preferências de hospitais e médicos. Famílias com crianças pequenas, por exemplo, costumam usar mais pediatria e pronto-socorro, enquanto famílias com idosos precisam de maior acesso a especialistas.</p>

        <h3>2. Abrangência geográfica</h3>
        <p>Se sua família viaja muito ou tem membros em diferentes cidades, um plano nacional pode ser mais adequado. Caso todos residam na mesma região, um plano estadual ou municipal oferece melhor custo-benefício.</p>

        <h3>3. Rede credenciada</h3>
        <p>Verifique se os hospitais, clínicas e médicos de confiança da família estão na rede do plano. Uma boa rede credenciada próxima à sua residência é essencial para emergências.</p>

        <h3>4. Tipo de acomodação</h3>
        <p>Planos com acomodação em quarto individual (apartamento) são mais caros, mas oferecem mais privacidade. Enfermaria (quarto compartilhado) é mais econômica e pode ser suficiente para muitas famílias.</p>

        <h3>5. Coparticipação ou sem coparticipação?</h3>
        <p>Planos com coparticipação têm mensalidade mais baixa, mas você paga uma taxa em cada consulta ou exame. Se sua família usa muito o plano, pode sair mais caro no final. Faça as contas!</p>

        <h3>6. Carências</h3>
        <p>Verifique os prazos de carência para cada tipo de procedimento. Alguns planos oferecem redução ou isenção de carências em casos específicos, como portabilidade de outro plano.</p>

        <h2>Dicas práticas</h2>
        <ul>
          <li>Compare pelo menos 3 operadoras diferentes</li>
          <li>Leia o rol de procedimentos cobertos</li>
          <li>Entenda a política de reajuste anual</li>
          <li>Verifique a reputação da operadora na ANS</li>
          <li>Considere contratar como MEI ou PJ para economizar</li>
        </ul>

        <h2>Conclusão</h2>
        <p>Não existe um plano perfeito para todas as famílias. O ideal é aquele que equilibra cobertura adequada com um valor que cabe no orçamento familiar. Uma boa consultoria pode fazer toda a diferença nessa escolha.</p>
      `
    },
    {
      title: "Planos empresariais: como MEI pode economizar até 40%",
      excerpt: "Entenda como microempreendedores individuais podem contratar planos de saúde com preços muito mais acessíveis e quais são os requisitos necessários.",
      date: "10 de Janeiro, 2025",
      category: "Economia",
      readTime: "6 min",
      content: `
        <h2>A vantagem do CNPJ</h2>
        <p>Você sabia que ter um CNPJ pode reduzir em até 40% o valor do seu plano de saúde? Isso acontece porque planos empresariais (PME) têm valores mais atrativos que os planos para pessoa física (PF).</p>

        <h3>Por que planos empresariais são mais baratos?</h3>
        <p>As operadoras oferecem condições especiais para empresas porque o risco é diluído entre mais pessoas e a taxa de sinistralidade costuma ser menor. Mesmo sendo MEI (com apenas você como beneficiário), você se enquadra como empresa.</p>

        <h3>Requisitos para contratar como MEI</h3>
        <ul>
          <li>Ter um CNPJ ativo como MEI</li>
          <li>Estar com as obrigações fiscais em dia</li>
          <li>Algumas operadoras exigem mínimo de 2 vidas (você + dependente)</li>
          <li>CNPJ deve ter pelo menos 6 meses de atividade (algumas operadoras)</li>
        </ul>

        <h3>Comparação de valores</h3>
        <p>Veja um exemplo prático para uma pessoa de 35 anos no Rio de Janeiro:</p>
        <ul>
          <li><strong>Plano PF (Pessoa Física):</strong> R$ 800/mês</li>
          <li><strong>Plano PME (MEI):</strong> R$ 480/mês</li>
          <li><strong>Economia anual:</strong> R$ 3.840</li>
        </ul>

        <h3>Vale a pena abrir MEI só para ter plano?</h3>
        <p>Se você ainda não é MEI, vale fazer as contas. O custo mensal do MEI é em torno de R$ 70, e você economiza centenas de reais no plano. Além disso, ter um CNPJ traz outros benefícios como:</p>
        <ul>
          <li>Possibilidade de emitir notas fiscais</li>
          <li>Acesso a crédito empresarial</li>
          <li>Contribuição para aposentadoria</li>
          <li>Compras com desconto em atacados</li>
        </ul>

        <h3>Como contratar</h3>
        <p>O processo é simples: você solicita a cotação como MEI, apresenta os documentos do CNPJ e documentos pessoais. A aprovação é rápida e o plano pode ser ativado em poucos dias.</p>

        <h2>Atenção aos detalhes</h2>
        <p>Nem todas as operadoras trabalham com planos PME para MEI com apenas 1 vida. É importante consultar um corretor especializado que conheça as regras de cada operadora e possa encontrar a melhor opção para seu caso.</p>
      `
    },
    {
      title: "Rede credenciada: como verificar hospitais e médicos",
      excerpt: "Aprenda a pesquisar e confirmar se seus médicos e hospitais favoritos fazem parte da rede do seu plano. Dicas práticas para não errar na escolha.",
      date: "5 de Janeiro, 2025",
      category: "Dicas",
      readTime: "5 min",
      content: `
        <h2>A importância da rede credenciada</h2>
        <p>De nada adianta contratar um plano barato se os hospitais e médicos que você precisa não estão na rede. Por isso, verificar a rede credenciada deve ser o primeiro passo antes de fechar qualquer contrato.</p>

        <h3>Como consultar a rede</h3>
        <p>Cada operadora disponibiliza a lista de credenciados de formas diferentes:</p>
        <ul>
          <li><strong>Site da operadora:</strong> A maioria tem um buscador onde você filtra por especialidade e região</li>
          <li><strong>App móvel:</strong> Aplicativos oficiais costumam ter a rede atualizada</li>
          <li><strong>Central de atendimento:</strong> Ligue e peça confirmação por escrito</li>
          <li><strong>Corretor de planos:</strong> Um bom corretor verifica isso pra você</li>
        </ul>

        <h3>Dicas para pesquisar</h3>
        <p><strong>1. Faça uma lista:</strong> Antes de contratar, liste os hospitais e médicos que você considera essenciais.</p>
        <p><strong>2. Busque por nome e CRM:</strong> Muitos médicos atendem em múltiplos hospitais e clínicas. Verifique todos os locais.</p>
        <p><strong>3. Confirme a especialidade:</strong> Alguns médicos atendem certas especialidades apenas em determinadas clínicas.</p>
        <p><strong>4. Verifique a proximidade:</strong> Um hospital credenciado a 50km pode não ser prático em emergências.</p>

        <h3>Atenção aos hospitais de referência</h3>
        <p>Grandes hospitais como Rede D'Or, Copa Star, Samaritano, entre outros, são muito procurados no Rio de Janeiro. Nem todos os planos cobrem todos os hospitais. Confirme se o hospital que você quer está na sua categoria de plano.</p>

        <h3>Rede para diferentes tipos de atendimento</h3>
        <p>Verifique a rede separadamente para:</p>
        <ul>
          <li>Consultas e exames ambulatoriais</li>
          <li>Internações e cirurgias</li>
          <li>Pronto-socorro e emergências</li>
          <li>Exames de alta complexidade (ressonância, tomografia)</li>
        </ul>

        <h3>E se meu médico não está na rede?</h3>
        <p>Você tem algumas opções:</p>
        <ul>
          <li>Escolher outro plano que o credencia</li>
          <li>Pedir ao médico para se credenciar (nem sempre possível)</li>
          <li>Usar o plano para exames e procedimentos, pagando particular apenas as consultas</li>
        </ul>

        <h2>Mudanças na rede</h2>
        <p>Importante: a rede credenciada pode mudar. Operadoras podem descredenciar hospitais ou médicos. Por isso, sempre tenha um plano B e acompanhe as atualizações da sua operadora.</p>
      `
    }
  ];

  const blogPosts = allBlogPosts.slice(0, 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `*Nova Cotação - Landing Page*\n\nNome: ${formData.nome}\nTelefone: ${formData.telefone}\nCidade: ${formData.cidade}\nIdade: ${formData.idade}\nTipo: ${formData.tipoContratacao}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/5511999999999?text=${encodedMessage}`, '_blank');
    setShowModal(false);
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/5511999999999', '_blank');
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

      <nav className={`fixed top-10 w-full z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className={`text-2xl font-bold transition-colors duration-300 ${
                isScrolled ? 'text-slate-900' : 'text-slate-900'
              }`}>Kifer Saúde</span>
            </div>
            <div className="hidden md:flex items-center space-x-6 flex-1 justify-center">
              <a href="#quem-somos" className={`font-medium transition-colors ${
                isScrolled ? 'text-slate-700 hover:text-orange-600' : 'text-slate-800 hover:text-orange-600'
              }`}>Quem Somos</a>
              <a href="#como-funciona" className={`font-medium transition-colors ${
                isScrolled ? 'text-slate-700 hover:text-orange-600' : 'text-slate-800 hover:text-orange-600'
              }`}>Como Funciona</a>
              <a href="#planos" className={`font-medium transition-colors ${
                isScrolled ? 'text-slate-700 hover:text-orange-600' : 'text-slate-800 hover:text-orange-600'
              }`}>Planos</a>
              <a href="#faq" className={`font-medium transition-colors ${
                isScrolled ? 'text-slate-700 hover:text-orange-600' : 'text-slate-800 hover:text-orange-600'
              }`}>FAQ</a>
              <a href="#contato" className={`font-medium transition-colors ${
                isScrolled ? 'text-slate-700 hover:text-orange-600' : 'text-slate-800 hover:text-orange-600'
              }`}>Contato</a>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="hidden md:block px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:scale-105"
            >
              Cotação Grátis
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 relative overflow-hidden min-h-[85vh] flex items-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-400 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="text-left order-2 lg:order-1">
              <div className="mb-6">
                <span className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-full text-sm font-bold shadow-lg animate-pulse">
                  <Star className="w-4 h-4 mr-2 fill-current" />
                  Especialista #1 em Planos de Saúde RJ
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 leading-tight">
                O plano ideal começa com <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">gente de verdade.</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-700 mb-5 font-light leading-relaxed">
                Atendimento humano e especializado em planos de saúde para todo o estado do Rio de Janeiro.
                <span className="block mt-2 font-semibold text-orange-700">Mais de 500 clientes satisfeitos!</span>
              </p>

              <div className="flex gap-2 mb-6">
                <div className="inline-flex items-center px-4 py-2 bg-slate-800/10 backdrop-blur-sm rounded-full border border-slate-300/50">
                  <Shield className="w-4 h-4 mr-1.5 text-orange-600" />
                  <span className="font-semibold text-slate-900 text-sm">100% Gratuito</span>
                </div>
                <div className="inline-flex items-center px-4 py-2 bg-slate-800/10 backdrop-blur-sm rounded-full border border-slate-300/50">
                  <CheckCircle className="w-4 h-4 mr-1.5 text-orange-600" />
                  <span className="font-semibold text-slate-900 text-sm">Sem Compromisso</span>
                </div>
                <div className="inline-flex items-center px-4 py-2 bg-slate-800/10 backdrop-blur-sm rounded-full border border-slate-300/50">
                  <ThumbsUp className="w-4 h-4 mr-1.5 text-orange-600" />
                  <span className="font-semibold text-slate-900 text-sm">98% Satisfação</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowModal(true)}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-base md:text-lg rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-2xl hover:shadow-orange-300 hover:scale-105 transform whitespace-nowrap"
                >
                  Quero minha cotação gratuita
                </button>

                <button
                  onClick={openWhatsApp}
                  className="px-8 py-4 bg-green-600 text-white text-base md:text-lg rounded-xl font-bold hover:bg-green-700 transition-all shadow-xl hover:scale-105 transform whitespace-nowrap"
                >
                  <MessageCircle className="inline-block mr-2 w-5 h-5" />
                  Falar no WhatsApp
                </button>
              </div>
            </div>

            <div className="flex justify-center order-1 lg:order-2 relative">
              <div className="relative pt-20 pb-8">

                <div className="absolute top-20 -left-2 bg-white rounded-2xl shadow-xl px-5 py-3 z-10">
                  <div className="text-2xl font-bold text-orange-600 mb-0">500+</div>
                  <div className="text-xs font-medium text-slate-600">Clientes</div>
                </div>

                <div className="absolute bottom-32 -right-2 bg-white rounded-2xl shadow-xl px-5 py-3 z-10">
                  <div className="text-2xl font-bold text-orange-600 mb-0">4.9★</div>
                  <div className="text-xs font-medium text-slate-600">Avaliação</div>
                </div>

                <div className="relative w-[320px] h-[480px] md:w-[360px] md:h-[540px]">
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-xl px-4 py-2 flex items-center gap-2 z-20 whitespace-nowrap animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="font-bold text-white text-xs">Online Agora</span>
                  </div>
                  <div className="absolute inset-0 rounded-[1rem] overflow-hidden border-4 border-white shadow-2xl bg-gradient-to-br from-orange-200 to-amber-200">
                    <img
                      src="/image.png"
                      alt="Luiza Kifer - Especialista em Planos de Saúde"
                      className="w-full h-full object-cover object-[center_35%] scale-105"
                    />
                  </div>
                </div>

                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl px-8 py-4 text-center min-w-[280px] z-10">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Luiza Kifer</h3>
                  <p className="text-orange-600 font-semibold whitespace-nowrap">Sua especialista em saúde</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="quem-somos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="w-full h-[500px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="/freepik__portrait-of-a-natural-redhaired-woman-about-158-me__96601.png"
                  alt="Luiza Kifer - Especialista em Planos de Saúde"
                  className="w-full h-full object-cover object-[center_20%]"
                />
              </div>
            </div>

            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                Quem Somos
              </h2>
              <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl mb-6">
                <p className="text-lg text-slate-700 italic mb-4">
                  "Sou a Luiza Kifer, especialista em planos de saúde. Acredito que contratar um plano não é só uma escolha financeira — é uma decisão sobre cuidado, segurança e tranquilidade."
                </p>
                <p className="text-sm text-slate-600 font-semibold">— Luiza Kifer, Fundadora</p>
              </div>
              <p className="text-lg text-slate-700 mb-6">
                A Kifer Saúde nasceu para simplificar o acesso aos melhores planos, com atendimento humano e soluções que cabem no seu bolso.
              </p>
              <button onClick={() => setShowHistoriaModal(true)} className="text-orange-600 font-semibold hover:text-orange-700 inline-flex items-center">
                Conheça nossa história completa
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 scroll-mt-32">
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

      <section id="planos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-32">
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
            <button onClick={() => setShowAvaliacoesModal(true)} className="text-orange-600 font-semibold hover:text-orange-700 inline-flex items-center">
              Mais avaliações no Google
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
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

      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-xl text-slate-600">
              Tire suas dúvidas sobre planos de saúde
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {faqData.map((faq, index) => (
              <div key={index} className="bg-slate-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                >
                  <span className="text-lg font-semibold text-slate-900 pr-8">{faq.question}</span>
                  <ChevronDown
                    className={`w-6 h-6 text-orange-600 transition-transform flex-shrink-0 ${
                      openFaqIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaqIndex === index && (
                  <div className="px-8 pb-6">
                    <p className="text-slate-700 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-slate-600 mb-4">Não encontrou sua resposta?</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-8 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
            >
              Fale com um especialista
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Blog e Conteúdos
            </h2>
            <p className="text-xl text-slate-600">
              Aprenda tudo sobre planos de saúde
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {blogPosts.map((post, index) => (
              <article key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group">
                <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                  <FileText className="w-20 h-20 text-orange-400" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">
                      {post.category}
                    </span>
                    <span className="text-sm text-slate-500 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {post.date}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-orange-600 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <button className="text-orange-600 font-semibold hover:text-orange-700 inline-flex items-center">
                    Ler mais
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-12">
            <button onClick={() => setShowBlogModal(true)} className="px-8 py-3 border-2 border-orange-600 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-colors">
              Ver todos os artigos
            </button>
          </div>
        </div>
      </section>

      <section id="cotacao" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 scroll-mt-32">
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

      <section id="contato" className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8 scroll-mt-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Entre em Contato
            </h2>
            <p className="text-xl text-slate-300">
              Estamos prontos para te ajudar a encontrar o plano ideal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <a href="tel:+5511999999999" className="bg-slate-800 rounded-2xl p-8 hover:bg-slate-700 transition-all group">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center">Telefone</h3>
              <p className="text-slate-300 text-center">(11) 99999-9999</p>
            </a>

            <a href="mailto:contato@kifersaude.com.br" className="bg-slate-800 rounded-2xl p-8 hover:bg-slate-700 transition-all group">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center">E-mail</h3>
              <p className="text-slate-300 text-center">contato@kifersaude.com.br</p>
            </a>

            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="bg-slate-800 rounded-2xl p-8 hover:bg-slate-700 transition-all group">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center">WhatsApp</h3>
              <p className="text-slate-300 text-center">Atendimento rápido</p>
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">Kifer Saúde</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Corretora especializada em planos de saúde para todo o estado do Rio de Janeiro.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Links Úteis</h3>
              <ul className="space-y-3 text-slate-400">
                <li><a href="#quem-somos" className="hover:text-orange-400 transition-colors">Sobre Nós</a></li>
                <li><a href="#cotacao" className="hover:text-orange-400 transition-colors">Planos</a></li>
                <li><button onClick={() => setShowBlogModal(true)} className="hover:text-orange-400 transition-colors text-left">Blog</button></li>
                <li><a href="#contato" className="hover:text-orange-400 transition-colors">Contato</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Contato</h3>
              <div className="space-y-3 text-slate-400">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-orange-500" />
                  <span>Rio de Janeiro, RJ</span>
                </div>
                <a href="mailto:contato@kifersaude.com.br" className="flex items-start hover:text-orange-400 transition-colors">
                  <Mail className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-orange-500" />
                  <span>contato@kifersaude.com.br</span>
                </a>
                <a href="https://instagram.com/kifer.saude" target="_blank" rel="noopener noreferrer" className="flex items-start hover:text-orange-400 transition-colors">
                  <Instagram className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-orange-500" />
                  <span>@kifer.saude</span>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Legal</h3>
              <div className="space-y-2 text-slate-400">
                <p className="text-sm">CNPJ: 12.345.678/0001-90</p>
                <p className="text-sm">ANS: 123456</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>© 2025 Kifer Saúde. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-3xl flex justify-between items-center">
              <h2 className="text-3xl font-bold">Faça sua Cotação</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <p className="text-slate-600 mb-6 text-center">
                Preencha os dados abaixo e receba sua cotação personalizada via WhatsApp
              </p>

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
                Enviar cotação via WhatsApp
                <MessageCircle className="inline-block ml-2 w-5 h-5" />
              </button>

              <p className="text-center text-sm text-slate-500 mt-4">
                Resposta em até 10 minutos
              </p>
            </form>
          </div>
        </div>
      )}

      {showHistoriaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-3xl flex justify-between items-center">
              <h2 className="text-3xl font-bold">Nossa História</h2>
              <button
                onClick={() => setShowHistoriaModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="prose max-w-none">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Como Tudo Começou</h3>
                <p className="text-slate-700 leading-relaxed mb-4">
                  A Kifer Saúde nasceu da visão de tornar o acesso a planos de saúde mais simples, transparente e humano. Percebi que as pessoas se sentiam perdidas em meio a tantas opções, siglas técnicas e processos burocráticos no mercado de saúde suplementar.
                </p>
                <p className="text-slate-700 leading-relaxed mb-4">
                  Por isso, criei uma corretora que não vende apenas planos, mas oferece consultoria personalizada e acompanhamento em cada etapa da jornada do cliente. Mesmo jovem, trouxe uma abordagem moderna e acessível para um mercado que precisava de renovação.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mb-4 mt-8">Nossa Missão</h3>
                <p className="text-slate-700 leading-relaxed mb-4">
                  Acreditamos que contratar um plano de saúde não deve ser complicado. Por isso, nossa missão é traduzir o "juridiquês" para a linguagem do dia a dia, comparar as melhores opções do mercado e encontrar o plano que realmente faz sentido para cada pessoa e família.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mb-4 mt-8">Por Que Somos Diferentes</h3>
                <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl mb-6">
                  <ul className="space-y-3 text-slate-700">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span><strong>Atendimento Humanizado:</strong> Tratamos cada cliente como único, entendendo suas necessidades e particularidades</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span><strong>Transparência Total:</strong> Explicamos cada detalhe, sem letras miúdas ou surpresas desagradáveis</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span><strong>Acompanhamento Contínuo:</strong> Não desaparecemos após a venda. Estamos aqui para ajudar sempre que precisar</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span><strong>Especialização Regional:</strong> Conhecemos profundamente o mercado do Rio de Janeiro e suas particularidades</span>
                    </li>
                  </ul>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-4 mt-8">Nossos Valores</h3>
                <p className="text-slate-700 leading-relaxed mb-4">
                  Construímos nossa empresa sobre três pilares fundamentais: <strong>confiança</strong>, <strong>transparência</strong> e <strong>compromisso</strong>. Cada cliente que atendemos não é apenas um número, mas uma relação de longo prazo baseada em respeito e cuidado genuíno.
                </p>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-8 mt-8">
                  <h3 className="text-2xl font-bold mb-4">Mais de 500 Clientes Satisfeitos</h3>
                  <p className="text-white/90 leading-relaxed mb-4">
                    Já ajudamos centenas de famílias a encontrarem o plano de saúde perfeito. Nossa taxa de satisfação de 98% reflete o compromisso que temos com cada pessoa que confia em nosso trabalho.
                  </p>
                  <button
                    onClick={() => {
                      setShowHistoriaModal(false);
                      setShowModal(true);
                    }}
                    className="px-6 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-all"
                  >
                    Faça parte dessa história
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAvaliacoesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-3xl flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold">Avaliações de Clientes</h2>
                <p className="text-white/90 mt-1">Nota média: 4.9 ⭐ (127 avaliações)</p>
              </div>
              <button
                onClick={() => setShowAvaliacoesModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    name: "Regina Silva",
                    age: 44,
                    rating: 5,
                    date: "Há 2 semanas",
                    review: "Eu achava que plano bom era caro, mas com a Luiza consegui pagar menos e ainda ter Rede D'Or. Atendimento nota 10! Ela explicou cada detalhe e me ajudou a escolher o melhor custo-benefício."
                  },
                  {
                    name: "Marcelo Santos",
                    age: 38,
                    rating: 5,
                    date: "Há 1 mês",
                    review: "Atendimento super rápido pelo WhatsApp. Em menos de 1 hora já tinha minha cotação com várias opções. A Luiza é muito atenciosa e profissional!"
                  },
                  {
                    name: "Ana Paula Ferreira",
                    age: 52,
                    rating: 5,
                    date: "Há 1 mês",
                    review: "Excelente suporte durante todo o processo. A Kifer Saúde realmente se importa com o cliente! Tirou todas as minhas dúvidas e ainda me ligou depois para saber se estava tudo certo."
                  },
                  {
                    name: "Carlos Eduardo",
                    age: 29,
                    rating: 5,
                    date: "Há 2 meses",
                    review: "Como MEI, consegui economizar muito no plano empresarial. A Luiza me mostrou opções que eu nem sabia que existiam. Recomendo demais!"
                  },
                  {
                    name: "Juliana Oliveira",
                    age: 35,
                    rating: 5,
                    date: "Há 2 meses",
                    review: "Contratei plano para toda minha família e foi super tranquilo. A Luiza tem um conhecimento incrível sobre as operadoras e me ajudou a escolher o melhor."
                  },
                  {
                    name: "Roberto Alves",
                    age: 47,
                    rating: 5,
                    date: "Há 3 meses",
                    review: "Precisava migrar de operadora urgente e a Kifer Saúde resolveu tudo rapidinho. Atendimento excepcional e muito profissional!"
                  },
                  {
                    name: "Fernanda Costa",
                    age: 41,
                    rating: 5,
                    date: "Há 3 meses",
                    review: "Melhor experiência que tive contratando plano de saúde. Nada de empurrar plano caro, a Luiza realmente busca o que é melhor para o cliente."
                  },
                  {
                    name: "Paulo Henrique",
                    age: 55,
                    rating: 5,
                    date: "Há 4 meses",
                    review: "Sempre tive plano pela empresa, mas agora como autônomo precisava contratar por conta. A Luiza me orientou perfeitamente e consegui um plano ótimo com preço justo!"
                  },
                  {
                    name: "Camila Rodrigues",
                    age: 33,
                    rating: 4,
                    date: "Há 4 meses",
                    review: "Muito bom! A Luiza é bem atenciosa e me ajudou bastante na escolha. Única observação é que demorou um pouco mais que o esperado para ativar, mas foi culpa da operadora."
                  },
                  {
                    name: "André Luiz",
                    age: 42,
                    rating: 5,
                    date: "Há 5 meses",
                    review: "Consultoria de primeira! A Luiza não só me vendeu um plano, ela me educou sobre como funciona todo o sistema de saúde suplementar. Vale muito a pena!"
                  }
                ].map((review, index) => (
                  <div key={index} className="bg-slate-50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center mr-3">
                          <span className="text-orange-700 font-bold text-lg">{review.name[0]}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{review.name}</p>
                          <p className="text-sm text-slate-600">{review.age} anos</p>
                        </div>
                      </div>
                      <span className="text-sm text-slate-500">{review.date}</span>
                    </div>
                    <div className="flex items-center mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-slate-300'}`} />
                      ))}
                    </div>
                    <p className="text-slate-700 leading-relaxed">{review.review}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center">
                <p className="text-slate-700 mb-4">
                  Quer deixar sua avaliação ou tirar dúvidas com nossos clientes?
                </p>
                <a
                  href="https://www.google.com/search?q=kifer+saude"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
                >
                  Ver no Google
                  <ChevronRight className="w-5 h-5 ml-2" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBlogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-3xl flex justify-between items-center">
              <h2 className="text-3xl font-bold">Blog e Conteúdos</h2>
              <button
                onClick={() => setShowBlogModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Como escolher o plano de saúde ideal para sua família",
                    excerpt: "Descubra os principais critérios para avaliar e escolher o melhor plano de saúde considerando sua realidade familiar. Entenda sobre abrangência, carências e coberturas.",
                    date: "15 de Janeiro, 2025",
                    category: "Guias",
                    readTime: "8 min"
                  },
                  {
                    title: "Planos empresariais: como MEI pode economizar até 40%",
                    excerpt: "Entenda como microempreendedores individuais podem contratar planos de saúde com preços muito mais acessíveis e quais são os requisitos necessários.",
                    date: "10 de Janeiro, 2025",
                    category: "Economia",
                    readTime: "6 min"
                  },
                  {
                    title: "Rede credenciada: como verificar hospitais e médicos",
                    excerpt: "Aprenda a pesquisar e confirmar se seus médicos e hospitais favoritos fazem parte da rede do seu plano. Dicas práticas para não errar na escolha.",
                    date: "5 de Janeiro, 2025",
                    category: "Dicas",
                    readTime: "5 min"
                  },
                  {
                    title: "Coparticipação vale a pena? Entenda quando escolher",
                    excerpt: "Descubra se o modelo de coparticipação é ideal para seu perfil e como calcular se realmente vai economizar com essa modalidade de plano.",
                    date: "28 de Dezembro, 2024",
                    category: "Guias",
                    readTime: "7 min"
                  },
                  {
                    title: "Carências em planos de saúde: tudo que você precisa saber",
                    excerpt: "Entenda os prazos de carência para cada tipo de procedimento, como funciona a portabilidade e casos em que há redução ou isenção de carências.",
                    date: "20 de Dezembro, 2024",
                    category: "Educação",
                    readTime: "10 min"
                  },
                  {
                    title: "Plano nacional vs estadual: qual escolher?",
                    excerpt: "Compare as diferenças entre planos com abrangência nacional e estadual. Descubra qual faz mais sentido para seu estilo de vida e orçamento.",
                    date: "15 de Dezembro, 2024",
                    category: "Comparativos",
                    readTime: "6 min"
                  },
                  {
                    title: "Como funciona a portabilidade de carências",
                    excerpt: "Aprenda a migrar de plano sem precisar cumprir novas carências. Veja os requisitos e passo a passo para fazer a portabilidade corretamente.",
                    date: "10 de Dezembro, 2024",
                    category: "Dicas",
                    readTime: "9 min"
                  },
                  {
                    title: "Planos de saúde para idosos: direitos e cuidados",
                    excerpt: "Conheça os direitos dos idosos em relação a planos de saúde, estatuto do idoso e como garantir um atendimento de qualidade na terceira idade.",
                    date: "5 de Dezembro, 2024",
                    category: "Direitos",
                    readTime: "8 min"
                  },
                  {
                    title: "O que a ANS fiscaliza nos planos de saúde?",
                    excerpt: "Entenda o papel da Agência Nacional de Saúde Suplementar e como ela protege os beneficiários. Saiba como fazer reclamações e denúncias.",
                    date: "1 de Dezembro, 2024",
                    category: "Educação",
                    readTime: "7 min"
                  },
                  {
                    title: "Reajuste anual: como funciona e como se preparar",
                    excerpt: "Descubra como é calculado o reajuste anual dos planos de saúde, quais os limites legais e dicas para lidar com os aumentos de mensalidade.",
                    date: "25 de Novembro, 2024",
                    category: "Economia",
                    readTime: "6 min"
                  },
                  {
                    title: "Telemedicina: como usar pelo plano de saúde",
                    excerpt: "Aprenda a utilizar os serviços de telemedicina oferecidos pelos planos de saúde. Veja quais consultas podem ser feitas online e como agendar.",
                    date: "20 de Novembro, 2024",
                    category: "Tecnologia",
                    readTime: "5 min"
                  },
                  {
                    title: "Maternidade em planos de saúde: coberturas e carências",
                    excerpt: "Guia completo sobre cobertura de maternidade, pré-natal, parto e pós-parto. Entenda carências e planejamento para quem deseja engravidar.",
                    date: "15 de Novembro, 2024",
                    category: "Guias",
                    readTime: "11 min"
                  }
                ].map((post, index) => (
                  <article key={index} className="bg-slate-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all group cursor-pointer">
                    <div className="h-40 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                      <FileText className="w-16 h-16 text-orange-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                          {post.category}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {post.date}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {post.readTime}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                      <button
                        onClick={() => {
                          setSelectedArticle(index);
                          setShowBlogModal(false);
                        }}
                        className="text-orange-600 font-semibold text-sm hover:text-orange-700 inline-flex items-center"
                      >
                        Ler artigo completo
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-8 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-8 text-center">
                <h3 className="text-2xl font-bold mb-3">Ficou com alguma dúvida?</h3>
                <p className="text-white/90 mb-6">
                  Converse comigo pelo WhatsApp e tire todas as suas dúvidas sobre planos de saúde
                </p>
                <button
                  onClick={() => {
                    setShowBlogModal(false);
                    openWhatsApp();
                  }}
                  className="px-8 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-all inline-flex items-center"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Falar no WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedArticle !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-3xl flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full">
                    {allBlogPosts[selectedArticle].category}
                  </span>
                  <span className="text-xs text-white/80 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {allBlogPosts[selectedArticle].date}
                  </span>
                  <span className="text-xs text-white/80 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {allBlogPosts[selectedArticle].readTime}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">{allBlogPosts[selectedArticle].title}</h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors ml-4"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div
                className="prose prose-slate max-w-none
                  prose-headings:text-slate-900 prose-headings:font-bold
                  prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                  prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-4
                  prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                  prose-li:text-slate-700 prose-li:mb-2
                  prose-strong:text-slate-900 prose-strong:font-semibold"
                dangerouslySetInnerHTML={{ __html: allBlogPosts[selectedArticle].content }}
              />

              <div className="mt-12 pt-8 border-t border-slate-200">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-8 text-center">
                  <h3 className="text-2xl font-bold mb-3">Gostou do artigo?</h3>
                  <p className="text-white/90 mb-6">
                    Entre em contato e tire suas dúvidas sobre planos de saúde com nossa equipe especializada
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => {
                        setSelectedArticle(null);
                        setShowModal(true);
                      }}
                      className="px-6 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-all"
                    >
                      Fazer cotação gratuita
                    </button>
                    <button
                      onClick={() => {
                        setSelectedArticle(null);
                        openWhatsApp();
                      }}
                      className="px-6 py-3 bg-white/10 backdrop-blur text-white rounded-xl font-bold hover:bg-white/20 transition-all inline-flex items-center justify-center"
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Falar no WhatsApp
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">Leia também</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {allBlogPosts
                      .filter((_, index) => index !== selectedArticle)
                      .slice(0, 2)
                      .map((post, index) => (
                        <article
                          key={index}
                          onClick={() => {
                            const actualIndex = allBlogPosts.findIndex(p => p.title === post.title);
                            setSelectedArticle(actualIndex);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="bg-slate-50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="h-32 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                            <FileText className="w-12 h-12 text-orange-400 group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="p-4">
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                              {post.category}
                            </span>
                            <h4 className="text-lg font-bold text-slate-900 mt-3 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
                              {post.title}
                            </h4>
                            <p className="text-slate-600 text-sm line-clamp-2">{post.excerpt}</p>
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
