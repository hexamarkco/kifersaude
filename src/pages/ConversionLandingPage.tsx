import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollToPlugin);
import { 
  MessageCircle, Star, ChevronDown, X, Users, Briefcase, UserMinus, 
  CheckCircle, AlertTriangle, Shield, Award, ArrowRight, Heart, 
  Zap, Target, TrendingUp, Phone, MapPin, ThumbsUp,
  Building2, Calculator, Calendar, FileCheck,
  ArrowDown, Sparkles, Rocket, BadgeCheck, Clock, Wallet
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeadOrigem {
  id: number;
  nome: string;
}

interface LeadStatusConfig {
  id: number;
  nome: string;
}

interface ConfigOption {
  id: number;
  nome: string;
  ordem: number;
}

export default function ConversionLandingPage() {
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp: '',
    tipo: 'pf',
  });
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [exitFormData, setExitFormData] = useState({ nome: '', whatsapp: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadOrigins, setLeadOrigins] = useState<LeadOrigem[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusConfig[]>([]);
  const [tipoContratacaoOptions, setTipoContratacaoOptions] = useState<ConfigOption[]>([]);
  
  const [metaPixelId, setMetaPixelId] = useState('');
  const [gtmId, setGtmId] = useState('');

  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && window.innerWidth > 768) {
        setShowExitPopup(true);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  useEffect(() => {
    loadConfigurations();
    loadTrackingSettings();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      animateOnLoad();
    }
  }, []);

  const animateOnLoad = () => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    tl.fromTo('.hero-badge', 
      { opacity: 0, y: -30 }, 
      { opacity: 1, y: 0, duration: 0.6 }
    )
    .fromTo('.hero-title', 
      { opacity: 0, y: 40 }, 
      { opacity: 1, y: 0, duration: 0.8 }, 
      '-=0.3'
    )
    .fromTo('.hero-subtitle', 
      { opacity: 0, y: 30 }, 
      { opacity: 1, y: 0, duration: 0.6 }, 
      '-=0.4'
    )
    .fromTo('.hero-stats', 
      { opacity: 0, x: -30 }, 
      { opacity: 1, x: 0, duration: 0.6 }, 
      '-=0.3'
    )
    .fromTo('.hero-logos', 
      { opacity: 0, y: 20 }, 
      { opacity: 1, y: 0, duration: 0.5 }, 
      '-=0.2'
    )
    .fromTo('.hero-form', 
      { opacity: 0, x: 30, scale: 0.95 }, 
      { opacity: 1, x: 0, scale: 1, duration: 0.8 }, 
      '-=0.5'
    );

    gsap.fromTo('.step-card', 
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, scrollTrigger: { trigger: stepsRef.current, start: 'top 80%' } }
    );

    gsap.fromTo('.target-card', 
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, scrollTrigger: { trigger: cardsRef.current, start: 'top 85%' } }
    );

    gsap.fromTo('.testimonial-card', 
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, scrollTrigger: { trigger: testimonialsRef.current, start: 'top 85%' } }
    );

    gsap.fromTo('.stat-number', 
      { opacity: 0, scale: 0.5 },
      { opacity: 1, scale: 1, duration: 0.8, stagger: 0.2, scrollTrigger: { trigger: statsRef.current, start: 'top 80%' } }
    );
  };

  const loadConfigurations = async () => {
    const [originsRes, statusesRes, tipoRes] = await Promise.all([
      supabase.from('lead_origens').select('*').eq('ativo', true),
      supabase.from('lead_status_config').select('*').eq('ativo', true).order('ordem', { ascending: true }),
      supabase.from('lead_tipos_contratacao').select('*').eq('ativo', true).order('ordem', { ascending: true }),
    ]);
    if (originsRes.data) setLeadOrigins(originsRes.data);
    if (statusesRes.data) setLeadStatuses(statusesRes.data);
    if (tipoRes.data) setTipoContratacaoOptions(tipoRes.data);
  };

  const loadTrackingSettings = async () => {
    const { data: metaPixel } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'meta_pixel')
      .maybeSingle();
    
    const { data: gtm } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'google_tag_manager')
      .maybeSingle();

    if (metaPixel?.settings?.pixelId) {
      setMetaPixelId(metaPixel.settings.pixelId as string);
    }
    if (gtm?.settings?.gtmId) {
      setGtmId(gtm.settings.gtmId as string);
    }
  };

  const getOrigemId = (origens: LeadOrigem[], nome: string) => {
    const found = origens.find(o => o.nome.toLowerCase().includes(nome.toLowerCase()));
    return found?.id;
  };

  const getStatusId = (statuses: LeadStatusConfig[], nome: string) => {
    const found = statuses.find(s => s.nome.toLowerCase().includes(nome.toLowerCase()));
    return found?.id;
  };

  const getTipoId = (tipos: ConfigOption[], label: string) => {
    const found = tipos.find(t => t.nome.toLowerCase().includes(label.toLowerCase()));
    return found?.id;
  };

  const handleSubmit = async (e: React.FormEvent, isExitPopup = false) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const data = isExitPopup ? exitFormData : formData;

    const origemId = getOrigemId(leadOrigins, 'lp');
    const statusId = getStatusId(leadStatuses, 'novo');
    const tipoId = getTipoId(tipoContratacaoOptions, formData.tipo);

    const leadData = {
      nome_completo: data.nome,
      telefone: data.whatsapp,
      origem_id: origemId,
      tipo_contratacao_id: tipoId,
      status_id: statusId,
      responsavel_id: 1,
      observacoes: `Lead Landing Page de Conversão - Tipo: ${formData.tipo}`,
      data_criacao: new Date().toISOString(),
      ultimo_contato: new Date().toISOString(),
      arquivado: false
    };

    const { error } = await supabase.from('leads').insert([leadData]);
    
    if (!error) {
      const waLink = `https://wa.me/5521979302389?text=Olá! Acabei de preencher o formulário no site. Meu nome é ${encodeURIComponent(data.nome)}`;
      window.open(waLink, '_blank');
      if (isExitPopup) setShowExitPopup(false);
      setFormData({ nome: '', whatsapp: '', tipo: 'pf' });
      setExitFormData({ nome: '', whatsapp: '' });
      
      gsap.fromTo('.success-message', 
        { opacity: 0, y: 10, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4 }
      );
    }
    
    setIsSubmitting(false);
  };

  const handleButtonHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, {
      scale: 1.02,
      duration: 0.2,
      ease: 'power2.out'
    });
  };

  const handleButtonLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out'
    });
  };

  const handleCardHover = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      y: -8,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  const handleCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  const handleFaqClick = (index: number) => {
    if (openFaq === index) {
      gsap.to('.faq-answer', {
        height: 0,
        duration: 0.3,
        ease: 'power2.out'
      });
    } else {
      gsap.fromTo('.faq-answer', 
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.4, ease: 'power2.out' }
      );
    }
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    { q: 'Tem carência? Quanto tempo?', a: 'Depende do plano escolhido. Urgências e emergências têm carência de 24h. Consultas e exames simples geralmente 30 dias. Procedimentos complexos podem ter até 180 dias.', icon: Clock },
    { q: 'Cobre consultas com meu médico atual?', a: 'Sim, desde que seu médico esteja na rede credenciada da operadora escolhida. Podemos verificar isso na hora da cotação.', icon: Target },
    { q: 'Posso usar em emergências antes dos 30 dias?', a: 'Sim! Urgências e emergências têm carência de apenas 24h em todos os planos.', icon: AlertTriangle },
    { q: 'Como funciona o rejuste anual?', a: 'Os planos de saúde têm rejuste anual autorizado pela ANS. O índice varia conforme a faixa etária e o plano contratado. Sempre informamos isso antes da contratação.', icon: TrendingUp },
    { q: 'Qual a diferença entre plano individual e empresarial?', a: 'Planos individuais são contratados em seu nome. Planos empresariais são via CNPJ e geralmente têm valores até 40% menores.', icon: Building2 },
    { q: 'Vocês cobram alguma taxa de corretagem?', a: 'Não! Nosso atendimento é 100% gratuito. Você paga apenas a mensalidade do plano escolhido.', icon: Wallet },
  ];

  const testimonials = [
    { name: 'Rafael Silva', city: 'Rio de Janeiro', plan: 'Amil - Família', text: 'Economizei mais de R$200/mês com a ajuda da Luiza. Processo super rápido!', stars: 5, icon: ThumbsUp },
    { name: 'Carla Oliveira', city: 'Niterói', plan: 'SulAmérica - MEI', text: 'Atendimento excelente. Ela explicou tudo sem letra miúda.', stars: 5, icon: Heart },
    { name: 'Marcos Santos', city: 'São Gonçalo', plan: 'Bradesco - Empresa', text: 'Minha empresa agora tem plano de saúde thanks to Kifer Saúde.', stars: 5, icon: BadgeCheck },
  ];

  const scrollToForm = () => {
    gsap.to(window, {
      scrollTo: { y: '#formulario', offsetY: 100 },
      duration: 1,
      ease: 'power3.inOut'
    });
  };

  const renderMetaPixel = () => {
    if (!metaPixelId) return null;
    return (
      <script dangerouslySetInnerHTML={{ __html: `
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${metaPixelId}');
        fbq('track','PageView');
      ` }} />
    );
  };

  const renderGTM = () => {
    if (!gtmId) return null;
    return (
      <script dangerouslySetInnerHTML={{ __html: `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');
      ` }} />
    );
  };

  return (
    <>
      <Helmet>
        <title>Plano de Saúde - Cotação Grátis em 2 Minutos | Kifer Saúde</title>
        <meta name="description" content="Cotação gratuita de planos de saúde. Sem enrolação, sem letra miúda. Atendimento especializado em 2 minutos." />
        {renderMetaPixel()}
        {renderGTM()}
      </Helmet>

      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-lg' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md hover:scale-110 transition-transform duration-300">
              <span className="text-white font-bold text-xl">K</span>
            </div>
            <span className="text-xl font-bold text-slate-800">Kifer Saúde</span>
          </div>
          <a 
            href="https://wa.me/5521979302389" 
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline">Falar no WhatsApp</span>
          </a>
        </div>
      </header>

      <main className="pt-16">
        <section ref={heroRef} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 md:py-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-600 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="hero-badge inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 px-4 py-2 rounded-full text-sm font-semibold mb-6 backdrop-blur-sm hover:scale-105 transition-transform">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  Reajuste previsto para abril — garanta o preço de hoje
                </div>
                <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  Plano de saúde do jeito certo, pelo preço certo
                </h1>
                <p className="hero-subtitle text-xl text-slate-300 mb-8 max-w-xl">
                  Cotação gratuita em 2 minutos. Sem enrolação, sem letra miúda.
                </p>
                <div className="hero-stats flex flex-wrap gap-6 mb-8">
                  <div className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="font-medium">+3.200 clientes atendidos</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 hover:text-yellow-400 transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    </div>
                    <span className="font-medium">4.9★ no Google</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <Award className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="font-medium">+10 anos no mercado</span>
                  </div>
                </div>
                <div className="hero-logos flex flex-wrap gap-4 items-center">
                  <img src="/amil-logo-1-2.png" alt="Amil" className="h-8 brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
                  <img src="/bradesco-saude-logo-1-1.png" alt="Bradesco" className="h-8 brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
                  <img src="/sulamerica-saude-logo.png" alt="SulAmérica" className="h-8 brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
                  <img src="/porto-logo.png" alt="Porto" className="h-8 brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
                  <img src="/assim-saude-logo.png" alt="Assim" className="h-8 brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" />
                </div>
              </div>
              
              <div ref={formRef} className="hero-form order-1 lg:order-2" id="formulario">
                <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-200 hover:shadow-3xl transition-shadow duration-300">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl mb-3 shadow-lg">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">Solicite sua cotação</h3>
                    <p className="text-slate-500 mt-1">É grátis e sem compromisso</p>
                  </div>
                  <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                    <div className="relative">
                      <input 
                        type="text" 
                        required 
                        value={formData.nome} 
                        onChange={(e) => setFormData({...formData, nome: e.target.value})} 
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all pl-12" 
                        placeholder="Seu nome completo" 
                      />
                      <Users className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="relative">
                      <input 
                        type="tel" 
                        required 
                        value={formData.whatsapp} 
                        onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} 
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all pl-12" 
                        placeholder="(21) 99999-9999" 
                      />
                      <MessageCircle className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="relative">
                      <select 
                        value={formData.tipo} 
                        onChange={(e) => setFormData({...formData, tipo: e.target.value})} 
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all bg-white appearance-none"
                      >
                        <option value="pf">Só eu</option>
                        <option value="familia">Eu + família</option>
                        <option value="mei">Empresa/MEI</option>
                      </select>
                      <Target className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
                      onMouseEnter={handleButtonHover}
                      onMouseLeave={handleButtonLeave}
                    >
                      {isSubmitting ? 'Enviando...' : 'Quero minha cotação gratuita'}
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-center text-sm text-slate-500 flex items-center justify-center gap-1">
                      <Shield className="w-4 h-4 text-green-500" />
                      Seus dados estão seguros. Sem spam.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Rocket className="w-4 h-4" />
                Processo Simples
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Como funciona</h2>
              <p className="text-slate-600">Em apenas 3 passos simples</p>
            </div>
            <div ref={stepsRef} className="grid md:grid-cols-3 gap-8">
              <div 
                className="step-card text-center p-8 rounded-2xl bg-slate-50 hover:bg-orange-50 transition-colors cursor-pointer group"
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-10 h-10 text-orange-600" />
                </div>
                <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">
                  1
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Você preenche o formulário</h3>
                <p className="text-slate-600">Em menos de 2 minutos</p>
                <div className="mt-4 flex justify-center">
                  <ArrowDown className="w-5 h-5 text-orange-300 group-hover:translate-y-1 transition-transform" />
                </div>
              </div>
              <div 
                className="step-card text-center p-8 rounded-2xl bg-slate-50 hover:bg-orange-50 transition-colors cursor-pointer group"
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                  <Phone className="w-10 h-10 text-orange-600" />
                </div>
                <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">
                  2
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Um especialista entra em contato</h3>
                <p className="text-slate-600">Em minutos, pelo seu WhatsApp</p>
                <div className="mt-4 flex justify-center">
                  <ArrowDown className="w-5 h-5 text-orange-300 group-hover:translate-y-1 transition-transform" />
                </div>
              </div>
              <div 
                className="step-card text-center p-8 rounded-2xl bg-slate-50 hover:bg-orange-50 transition-colors cursor-pointer group"
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                  <FileCheck className="w-10 h-10 text-orange-600" />
                </div>
                <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Você escolhe o plano ideal</h3>
                <p className="text-slate-600">E assina sem burocracia</p>
              </div>
            </div>
            <div className="text-center mt-10">
              <button 
                onClick={scrollToForm}
                className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2 group"
                onMouseEnter={handleButtonHover}
                onMouseLeave={handleButtonLeave}
              >
                Começar agora
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Target className="w-4 h-4" />
                Ideal Para Você
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Para quem é</h2>
              <p className="text-slate-600">Temos opções para todas as necessidades</p>
            </div>
            <div ref={cardsRef} className="grid md:grid-cols-3 gap-6">
              <div 
                className="target-card bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:border-orange-200 transition-all cursor-pointer group"
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Pessoa Física / Família</h3>
                <p className="text-slate-600 mb-4">Planos individuais e familiares com o melhor custo-benefício.</p>
                <button onClick={scrollToForm} className="text-orange-600 font-semibold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                  Quero esse plano <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div 
                className="target-card bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:border-orange-200 transition-all cursor-pointer group"
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Briefcase className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Empresas e MEI</h3>
                <p className="text-slate-600 mb-4">Economize até 40% com planos empresariais via CNPJ.</p>
                <button onClick={scrollToForm} className="text-orange-600 font-semibold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                  Quero esse plano <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div 
                className="target-card bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:border-orange-200 transition-all cursor-pointer group"
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <UserMinus className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Quem perdeu o plano pelo emprego</h3>
                <p className="text-slate-600 mb-4">Opções acessíveis para manter sua cobertura de saúde.</p>
                <button onClick={scrollToForm} className="text-orange-600 font-semibold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                  Quero esse plano <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Building2 className="w-4 h-4" />
                Parcerias Estratégicas
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Trabalhamos com as maiores operadoras do Brasil</h2>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 mt-8">
              {[
                { src: '/amil-logo-1-2.png', alt: 'Amil' },
                { src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco' },
                { src: '/sulamerica-saude-logo.png', alt: 'SulAmérica' },
                { src: '/porto-logo.png', alt: 'Porto' },
                { src: '/assim-saude-logo.png', alt: 'Assim' },
              ].map((logo, i) => (
                <img 
                  key={i}
                  src={logo.src} 
                  alt={logo.alt} 
                  className="h-12 grayscale hover:grayscale-0 transition-all duration-300 hover:scale-110 cursor-pointer" 
                />
              ))}
            </div>
          </div>
        </section>

        <section ref={testimonialsRef} className="py-16 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Heart className="w-4 h-4" />
                Clientes Satisfeitos
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">O que nossos clientes dizem</h2>
              <p className="text-slate-600">Avaliações reais no Google</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((t, i) => (
                <div 
                  key={i} 
                  className="testimonial-card bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:border-orange-200 transition-all cursor-pointer"
                  onMouseEnter={handleCardHover}
                  onMouseLeave={handleCardLeave}
                >
                  <div className="flex gap-1 mb-3">
                    {[...Array(t.stars)].map((_, j) => <Star key={j} className="w-5 h-5 text-yellow-400 fill-current" />)}
                  </div>
                  <p className="text-slate-700 mb-4 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">{t.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{t.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {t.city}
                      </p>
                      <p className="text-xs text-orange-600 font-medium">{t.plan}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center mt-8">
              <a 
                href="https://g.co/kgs/Y7hLxVh" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-orange-600 font-semibold hover:underline inline-flex items-center gap-1 hover:gap-2 transition-all"
              >
                Ver todas as avaliações no Google <ArrowRight className="w-4 h-4" />
              </a>
            </p>
          </div>
        </section>

        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Calculator className="w-4 h-4" />
                Tire suas Dúvidas
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Dúvidas que aparecem muito por aqui</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => {
                const Icon = faq.icon;
                return (
                  <div 
                    key={i} 
                    className={`border border-slate-200 rounded-xl overflow-hidden transition-all ${openFaq === i ? 'border-orange-300 shadow-md' : ''}`}
                  >
                    <button 
                      onClick={() => handleFaqClick(i)} 
                      className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-semibold text-slate-900 pr-4 flex items-center gap-3">
                        <Icon className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        {faq.q}
                      </span>
                      <ChevronDown className={`w-5 h-5 text-orange-500 transition-transform flex-shrink-0 duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaq === i && (
                      <div className="faq-answer px-6 pb-4 text-slate-600">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-orange-500 to-orange-600 py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          </div>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <Calendar className="w-4 h-4" />
              Não Perca Tempo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ainda sem plano de saúde?</h2>
            <p className="text-orange-100 text-lg mb-8">Isso tem solução em 2 minutos.</p>
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
              <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="relative">
                    <input 
                      type="text" 
                      required 
                      value={formData.nome} 
                      onChange={(e) => setFormData({...formData, nome: e.target.value})} 
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all pl-12" 
                      placeholder="Seu nome" 
                    />
                    <Users className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                  <div className="relative">
                    <input 
                      type="tel" 
                      required 
                      value={formData.whatsapp} 
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} 
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all pl-12" 
                      placeholder="WhatsApp" 
                    />
                    <MessageCircle className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={formData.tipo} 
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})} 
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all bg-white appearance-none"
                  >
                    <option value="pf">Só eu</option>
                    <option value="familia">Eu + família</option>
                    <option value="mei">Empresa/MEI</option>
                  </select>
                  <Target className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
                  onMouseEnter={handleButtonHover}
                  onMouseLeave={handleButtonLeave}
                >
                  {isSubmitting ? 'Enviando...' : 'Quero minha cotação gratuita'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">K</span>
            </div>
            <span className="text-lg font-bold">Kifer Saúde</span>
          </div>
          <p className="text-slate-400 text-sm mb-4">CNPJ: 00.000.000/0001-00 | Regulamentado pela ANS</p>
          <div className="flex justify-center gap-6">
            <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Política de Privacidade</a>
            <a href="https://wa.me/5521979302389" className="text-green-400 hover:text-green-300 text-sm transition-colors flex items-center gap-1">
              <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </footer>

      <a 
        href="https://wa.me/5521979302389" 
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-xl z-50 transition-all hover:scale-110 hover:shadow-2xl animate-bounce"
      >
        <MessageCircle className="w-8 h-8" />
      </a>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-50">
        <a 
          href="https://wa.me/5521979302389" 
          className="block bg-green-500 hover:bg-green-600 text-white text-center py-3 rounded-xl font-semibold transition-all hover:scale-[1.02]"
        >
          💬 Falar com especialista
        </a>
      </div>

      {showExitPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div 
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative animate-in zoom-in-95 duration-200"
            onMouseEnter={() => gsap.fromTo('.popup-content', { scale: 0.9 }, { scale: 1, duration: 0.3 })}
          >
            <button 
              onClick={() => setShowExitPopup(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="popup-content text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Espera! Veja o plano mais contratado essa semana</h3>
            </div>
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <input 
                type="text" 
                required 
                value={exitFormData.nome} 
                onChange={(e) => setExitFormData({...exitFormData, nome: e.target.value})} 
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all" 
                placeholder="Seu nome" 
              />
              <input 
                type="tel" 
                required 
                value={exitFormData.whatsapp} 
                onChange={(e) => setExitFormData({...exitFormData, whatsapp: e.target.value})} 
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:outline-none transition-all" 
                placeholder="WhatsApp" 
              />
              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
                onMouseEnter={handleButtonHover}
                onMouseLeave={handleButtonLeave}
              >
                Ver ofertas
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
