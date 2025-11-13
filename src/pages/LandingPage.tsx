import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Phone, Mail, CheckCircle, Shield, Zap, Search, MessageCircle, Star, TrendingUp, ChevronRight, X, ChevronDown, Calendar, FileText, ThumbsUp, MapPin, Instagram } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/ui/Skeleton';
import { skeletonSurfaces } from '../components/ui/skeletonStyles';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  read_time: string;
  published_at: string;
  cover_image_url?: string;
}

export default function LandingPage() {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    idade: '',
    tipoContratacao: 'PF'
  });
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showHistoriaModal, setShowHistoriaModal] = useState(false);
  const [showAvaliacoesModal, setShowAvaliacoesModal] = useState(false);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    loadBlogPosts();
  }, []);

  const loadBlogPosts = async () => {
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, read_time, published_at, cover_image_url')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setBlogPosts(data);
    }
    setLoadingPosts(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const leadData = {
        nome_completo: formData.nome,
        telefone: formData.telefone,
        cidade: formData.cidade || null,
        origem: 'orgânico',
        tipo_contratacao: formData.tipoContratacao === 'PF' ? 'Pessoa Física' : formData.tipoContratacao,
        status: 'Novo',
        responsavel: 'Luiza',
        observacoes: `Idade dos beneficiários: ${formData.idade}`,
        data_criacao: new Date().toISOString(),
        ultimo_contato: new Date().toISOString(),
        arquivado: false
      };

      const { error } = await supabase
        .from('leads')
        .insert([leadData]);

      if (error) {
        console.error('Erro ao salvar lead:', error);
        alert('Ocorreu um erro ao enviar sua cotação. Por favor, tente novamente ou entre em contato via WhatsApp.');
        return;
      }

      const message = `*Nova Cotação - Landing Page*\n\nNome: ${formData.nome}\nTelefone: ${formData.telefone}\nCidade: ${formData.cidade}\nIdade: ${formData.idade}\nTipo: ${formData.tipoContratacao}`;
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/5521979302389?text=${encodedMessage}`, '_blank');

      setFormData({ nome: '', telefone: '', cidade: '', idade: '', tipoContratacao: 'PF' });
      setShowModal(false);

      alert('✅ Cotação enviada com sucesso! Em breve entraremos em contato.');
    } catch (error) {
      console.error('Erro ao processar formulário:', error);
      alert('Ocorreu um erro ao enviar sua cotação. Por favor, tente novamente.');
    }
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/5521979302389', '_blank');
  };

  const scrollToForm = () => {
    document.getElementById('cotacao')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 ${
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

      <section className="pt-8 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 relative overflow-hidden min-h-[85vh] flex items-center">
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
              Trabalhamos com as principais operadoras do mercado
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 items-center">
            <div className="bg-white rounded-xl p-6 flex items-center justify-center h-32 hover:shadow-lg transition-all group">
              <img
                src="/amil-logo-1-2.png"
                alt="Amil"
                className="max-w-full max-h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center justify-center h-32 hover:shadow-lg transition-all group">
              <img
                src="/porto-logo.png"
                alt="Porto Seguro"
                className="max-w-full max-h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center justify-center h-32 hover:shadow-lg transition-all group">
              <img
                src="/assim-saude-logo.png"
                alt="Assim Saúde"
                className="max-w-full max-h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center justify-center h-32 hover:shadow-lg transition-all group">
              <img
                src="/sulamerica-saude-logo.png"
                alt="SulAmérica Saúde"
                className="max-w-full max-h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center justify-center h-32 hover:shadow-lg transition-all group">
              <img
                src="/bradesco-saude-logo-1-1.png"
                alt="Bradesco Saúde"
                className="max-w-full max-h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center justify-center px-6 py-4 bg-orange-50 rounded-2xl border-2 border-orange-200">
              <CheckCircle className="w-6 h-6 text-orange-600 mr-3 flex-shrink-0" />
              <p className="text-slate-700 text-lg">
                <span className="font-semibold text-slate-900">E muitas outras operadoras!</span> Trabalhamos com diversas opções para encontrar o plano ideal para você.
              </p>
            </div>
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
              <FileText className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Conteúdo educativo</h3>
              <p className="text-slate-600">
                <a href="/blog" className="text-orange-600 hover:text-orange-700 font-semibold">
                  Acesse nosso blog
                </a> com dicas e guias sobre planos de saúde
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Search className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Cotações personalizadas</h3>
              <p className="text-slate-600">Sem custo e totalmente adaptadas ao seu perfil</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <Shield className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Operadoras regulamentadas</h3>
              <p className="text-slate-600">Todas as nossas parceiras são certificadas pela ANS</p>
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

          {loadingPosts ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={index} className={`${skeletonSurfaces.card} overflow-hidden`}>
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6 space-y-5">
                    <div className="flex items-center gap-4">
                      <Skeleton variant="line" className="h-8 w-24" />
                      <Skeleton variant="line" className="h-6 w-32" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                    <div className="flex items-center justify-between">
                      <Skeleton variant="line" className="h-6 w-28" />
                      <Skeleton variant="line" className="h-6 w-16" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : blogPosts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-xl text-slate-500">Em breve teremos artigos incríveis para você!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {blogPosts.map((post) => (
                  <article
                    key={post.id}
                    onClick={() => navigate(`/blog/${post.slug}`)}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                  >
                    {post.cover_image_url ? (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                        <FileText className="w-20 h-20 text-orange-400 group-hover:scale-110 transition-transform" />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">
                          {post.category}
                        </span>
                        <span className="text-sm text-slate-500 flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(post.published_at)}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-orange-600 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-slate-600 mb-4 leading-relaxed line-clamp-3">
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
                <button
                  onClick={() => navigate('/blog')}
                  className="px-8 py-3 border-2 border-orange-600 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-colors inline-flex items-center"
                >
                  Ver todos os artigos
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </>
          )}
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
            <a href="tel:+5521979302389" className="bg-slate-800 rounded-2xl p-8 hover:bg-slate-700 transition-all group">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center">Telefone</h3>
              <p className="text-slate-300 text-center">(21) 97930-2389</p>
            </a>

            <a href="mailto:contato@kifersaude.com.br" className="bg-slate-800 rounded-2xl p-8 hover:bg-slate-700 transition-all group">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center">E-mail</h3>
              <p className="text-slate-300 text-center">contato@kifersaude.com.br</p>
            </a>

            <a href="https://wa.me/5521979302389" target="_blank" rel="noopener noreferrer" className="bg-slate-800 rounded-2xl p-8 hover:bg-slate-700 transition-all group">
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
                <li><a href="/blog" className="hover:text-orange-400 transition-colors">Blog</a></li>
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
                <a href="https://instagram.com/souluizakifer" target="_blank" rel="noopener noreferrer" className="flex items-start hover:text-orange-400 transition-colors">
                  <Instagram className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-orange-500" />
                  <span>@souluizakifer</span>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Legal</h3>
              <div className="space-y-2 text-slate-400">
                <p className="text-sm">CNPJ: 46.423.078/0001-10</p>
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

    </div>
  );
}
