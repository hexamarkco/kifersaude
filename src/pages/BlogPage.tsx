import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Calendar, Clock, ChevronRight, ArrowLeft, Heart, Mail, Instagram, MapPin, MessageCircle, Eye, Facebook, Linkedin, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/ui/Skeleton';
import { skeletonSurfaces } from '../components/ui/skeletonStyles';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url?: string;
  category: string;
  read_time: string;
  published_at: string;
  views_count: number;
  meta_title?: string;
  meta_description?: string;
}

const BlogFooter = () => (
  <footer className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8 mt-12">
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
            <li><a href="/" className="hover:text-orange-400 transition-colors">Home</a></li>
            <li><a href="/#quem-somos" className="hover:text-orange-400 transition-colors">Sobre Nós</a></li>
            <li><a href="/blog" className="hover:text-orange-400 transition-colors">Blog</a></li>
            <li><a href="/#contato" className="hover:text-orange-400 transition-colors">Contato</a></li>
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
            <a
              href="https://instagram.com/souluizakifer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start hover:text-orange-400 transition-colors"
            >
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
        <p>&copy; 2025 Kifer Saúde. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);

export default function BlogPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [shareFeedback, setShareFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const showShareFeedback = (type: 'success' | 'error', message: string) => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setShareFeedback({ type, message });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    if (slug) {
      loadPostBySlug(slug);
    }
  }, [slug]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar artigos do blog', error);
      setError('Não foi possível carregar os artigos no momento.');
    }

    if (!error && data) {
      setPosts((prev) => (append ? [...prev, ...data] : data));
      setHasMore(data.length === pageSize);
    } else {
      setHasMore(false);
    }

    if (append) {
      setLoadingMore(false);
    } else {
      setLoading(false);
    }
    setLoading(false);
    setIsRetrying(false);
  };

  const loadPostBySlug = async (postSlug: string) => {
    setLoading(true);
    setError(null);
    setSelectedPost(null);
    setRelatedPosts([]);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', postSlug)
      .eq('published', true)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar artigo pelo slug', error);
      setError('Não foi possível carregar este artigo no momento.');
    }

    if (!error && data) {
      setSelectedPost(data);
      incrementViewCount(data.id);
      loadRelatedPosts(data.category, data.id);
    }
    setLoading(false);
    setIsRetrying(false);
  };

  const incrementViewCount = async (postId: string) => {
    await supabase.rpc('increment', {
      row_id: postId,
      table_name: 'blog_posts',
      column_name: 'views_count'
    });
  };

  const loadRelatedPosts = async (category: string, currentPostId: string) => {
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .eq('category', category)
      .neq('id', currentPostId)
      .order('published_at', { ascending: false })
      .limit(2);

    if (data) {
      setRelatedPosts(data);
    }
  };

  const categories = ['Todos', ...Array.from(new Set(posts.map(p => p.category)))];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredPosts = posts.filter((post) => {
    const matchesCategory = selectedCategory === 'Todos' || post.category === selectedCategory;
    const matchesSearch =
      !normalizedSearch ||
      post.title.toLowerCase().includes(normalizedSearch) ||
      post.excerpt.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/5521979302389?text=Olá! Vim através do blog e gostaria de mais informações sobre planos de saúde.', '_blank');
  };

  const shareOnWhatsApp = (post: BlogPost) => {
    const text = `${post.title}\n\nLeia mais: https://kifersaude.com.br/blog/${post.slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOnFacebook = (post: BlogPost) => {
    const url = `https://kifersaude.com.br/blog/${post.slug}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnLinkedIn = (post: BlogPost) => {
    const url = `https://kifersaude.com.br/blog/${post.slug}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  };

  const sharePost = async (post: BlogPost, fallback: 'whatsapp' | 'facebook' | 'linkedin' = 'whatsapp') => {
    const url = `https://kifersaude.com.br/blog/${post.slug}`;
    const shareData = {
      title: post.title,
      text: post.excerpt,
      url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showShareFeedback('success', 'Compartilhamento iniciado!');
        return;
      } catch (error) {
        console.error('Erro ao compartilhar com navigator.share', error);
      }
    }

    if (fallback === 'facebook') {
      shareOnFacebook(post);
    } else if (fallback === 'linkedin') {
      shareOnLinkedIn(post);
    } else {
      shareOnWhatsApp(post);
    }
  };

  const copyLink = async (post: BlogPost) => {
    const url = `https://kifersaude.com.br/blog/${post.slug}`;

    try {
      await navigator.clipboard.writeText(url);
      showShareFeedback('success', 'Link copiado para a área de transferência.');
    } catch (error) {
      console.error('Erro ao copiar link', error);
      showShareFeedback('error', 'Não foi possível copiar o link. Tente novamente.');
    }
  };

  const feedbackToast = shareFeedback ? (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-opacity ${
        shareFeedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
      role="status"
      aria-live="polite"
    >
      {shareFeedback.message}
    </div>
  ) : null;

  const isLoadingPost = Boolean(slug) && loading;
  const isInitialLoading = loading && posts.length === 0;

  if (isLoadingPost) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/blog')}
                className="flex items-center text-slate-600 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar para o blog
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Kifer Saúde</span>
              </div>
            </div>
          </div>
        </nav>

        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="mb-4 rounded-2xl overflow-hidden shadow-lg">
            <Skeleton className="h-[400px] w-full" />
          </div>

          <div className={`${skeletonSurfaces.panel} p-8 md:p-12 space-y-8`}>
            <div className="flex items-center gap-3 flex-wrap">
              <Skeleton variant="line" className="h-8 w-28" />
              <Skeleton variant="line" className="h-6 w-32" />
              <Skeleton variant="line" className="h-6 w-20" />
              <Skeleton variant="line" className="h-6 w-24" />
            </div>

            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-2/3" />

            <div className="flex flex-wrap items-center gap-3 mb-4 pb-6 border-b border-slate-200">
              <Skeleton variant="line" className="h-10 w-32" />
              <Skeleton variant="line" className="h-10 w-32" />
              <Skeleton variant="line" className="h-10 w-32" />
              <Skeleton variant="line" className="h-10 w-32" />
            </div>

            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className={`${skeletonSurfaces.card} p-8 text-center space-y-4`}>
                <Skeleton className="h-8 w-1/2 mx-auto" />
                <Skeleton className="h-5 w-3/4 mx-auto" />
                <Skeleton variant="line" className="h-12 w-40 mx-auto" />
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200 space-y-6">
              <Skeleton className="h-7 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className={`${skeletonSurfaces.card} overflow-hidden`}>
                    <Skeleton className="h-48 w-full" />
                    <div className="p-4 space-y-3">
                      <Skeleton variant="line" className="h-6 w-24" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <BlogFooter />
        {feedbackToast}
      </div>
    );
  }

  if (error && slug) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/blog')}
                className="flex items-center text-slate-600 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar para o blog
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Kifer Saúde</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-6">
          <h1 className="text-3xl font-bold text-slate-900">Ops! Não foi possível carregar o artigo</h1>
          <p className="text-lg text-slate-600">{error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>

        <BlogFooter />
      </div>
    );
  }

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Helmet>
          <title>{selectedPost.meta_title || selectedPost.title} | Kifer Saúde Blog</title>
          <meta name="description" content={selectedPost.meta_description || selectedPost.excerpt} />
          <meta property="og:title" content={selectedPost.meta_title || selectedPost.title} />
          <meta property="og:description" content={selectedPost.meta_description || selectedPost.excerpt} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={`https://kifersaude.com.br/blog/${selectedPost.slug}`} />
          {selectedPost.cover_image_url && (
            <meta property="og:image" content={selectedPost.cover_image_url} />
          )}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={selectedPost.meta_title || selectedPost.title} />
          <meta name="twitter:description" content={selectedPost.meta_description || selectedPost.excerpt} />
          {selectedPost.cover_image_url && (
            <meta name="twitter:image" content={selectedPost.cover_image_url} />
          )}
          <link rel="canonical" href={`https://kifersaude.com.br/blog/${selectedPost.slug}`} />
        </Helmet>
        <nav className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedPost(null);
                  navigate('/blog');
                }}
                className="flex items-center text-slate-600 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar para o blog
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Kifer Saúde</span>
              </div>
            </div>
          </div>
        </nav>

        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {selectedPost.cover_image_url && (
            <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
              <img
                src={selectedPost.cover_image_url}
                alt={selectedPost.title}
                className="w-full h-[400px] object-cover"
              />
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <span className="px-4 py-2 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">
                {selectedPost.category}
              </span>
              <span className="text-sm text-slate-500 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(selectedPost.published_at)}
              </span>
              <span className="text-sm text-slate-500 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {selectedPost.read_time}
              </span>
              <span className="text-sm text-slate-500 flex items-center">
                <Eye className="w-4 h-4 mr-1" />
                {selectedPost.views_count} visualizações
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              {selectedPost.title}
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              {selectedPost.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-8 pb-8 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-600">Compartilhar:</span>
              <button
                onClick={() => sharePost(selectedPost, 'whatsapp')}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
                title="Compartilhar no WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={() => sharePost(selectedPost, 'facebook')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                title="Compartilhar no Facebook"
              >
                <Facebook className="w-4 h-4" />
                Facebook
              </button>
              <button
                onClick={() => sharePost(selectedPost, 'linkedin')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                title="Compartilhar no LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </button>
              <button
                onClick={() => copyLink(selectedPost)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition-colors"
                title="Copiar link"
              >
                <LinkIcon className="w-4 h-4" />
                Copiar link
              </button>
            </div>

            <div className="border-t border-slate-200 pt-8">
              <div
                className="prose prose-lg prose-slate max-w-none
                  prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight
                  prose-h1:text-4xl prose-h1:mt-10 prose-h1:mb-6
                  prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-5 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-3
                  prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
                  prose-h4:text-xl prose-h4:mt-6 prose-h4:mb-3
                  prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-6 prose-p:text-lg
                  prose-ul:my-6 prose-ul:list-disc prose-ul:pl-8 prose-ul:space-y-2
                  prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-8 prose-ol:space-y-2
                  prose-li:text-slate-700 prose-li:text-lg prose-li:leading-relaxed
                  prose-strong:text-slate-900 prose-strong:font-bold
                  prose-em:text-slate-800 prose-em:italic
                  prose-a:text-orange-600 prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                  prose-blockquote:border-l-4 prose-blockquote:border-orange-500 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-slate-600 prose-blockquote:bg-orange-50 prose-blockquote:py-4 prose-blockquote:my-6 prose-blockquote:rounded-r-lg
                  prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-6 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:shadow-lg prose-pre:my-6
                  prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-8 prose-img:w-full prose-img:h-auto
                  prose-hr:border-slate-300 prose-hr:my-10
                  prose-table:w-full prose-table:border-collapse prose-table:my-6
                  prose-th:bg-slate-100 prose-th:p-3 prose-th:text-left prose-th:font-bold prose-th:border prose-th:border-slate-300
                  prose-td:p-3 prose-td:border prose-td:border-slate-300"
                dangerouslySetInnerHTML={{ __html: selectedPost.content }}
              />
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl p-8 text-center">
                <h3 className="text-2xl font-bold mb-3">Gostou do artigo?</h3>
                <p className="text-white/90 mb-6">
                  Entre em contato e tire suas dúvidas sobre planos de saúde
                </p>
                <button
                  onClick={openWhatsApp}
                  className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-all inline-flex items-center justify-center"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Falar no WhatsApp
                </button>
              </div>
            </div>

            {relatedPosts.length > 0 && (
              <div className="mt-12 pt-8 border-t border-slate-200">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Leia também</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {relatedPosts.map((post) => (
                    <article
                      key={post.id}
                      onClick={() => {
                        setSelectedPost(null);
                        navigate(`/blog/${post.slug}`);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="bg-slate-50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
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
                        <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100" />
                      )}
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
            )}
          </div>
        </article>

        <BlogFooter />
        {feedbackToast}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>Blog Kifer Saúde | Dicas e Guias sobre Planos de Saúde</title>
        <meta name="description" content="Aprenda tudo sobre planos de saúde com nossos artigos especializados. Dicas, guias e informações para escolher o melhor plano para você e sua família." />
        <meta property="og:title" content="Blog Kifer Saúde | Dicas e Guias sobre Planos de Saúde" />
        <meta property="og:description" content="Aprenda tudo sobre planos de saúde com nossos artigos especializados." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kifersaude.com.br/blog" />
        <link rel="canonical" href="https://kifersaude.com.br/blog" />
      </Helmet>
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">Kifer Saúde</span>
            </div>
            <a
              href="/"
              className="text-slate-600 hover:text-orange-600 transition-colors font-semibold"
            >
              Voltar ao site
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">Blog Kifer Saúde</h1>
          <p className="text-xl text-slate-600">
            Dicas, guias e informações sobre planos de saúde
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-10">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título ou resumo"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {loading || isRetrying
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} variant="line" className="h-11 w-28" />
              ))
            : categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all ${
                    selectedCategory === category
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'bg-white text-slate-600 hover:bg-orange-50'
                  }`}
                >
                  {category}
                </button>
              ))}
        </div>

        {error ? (
          <div className="max-w-3xl mx-auto text-center bg-white rounded-2xl shadow-sm p-8 space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Ops! Algo deu errado</h2>
            <p className="text-slate-600">{error}</p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center justify-center px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading || isRetrying ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className={`${skeletonSurfaces.card} overflow-hidden`}>
                <Skeleton className="h-56 w-full" />
                <div className="p-6 space-y-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Skeleton variant="line" className="h-7 w-24" />
                    <Skeleton variant="line" className="h-5 w-20" />
                    <Skeleton variant="line" className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-7 w-3/4" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-5/6" />
                  <div className="flex items-center justify-between">
                    <Skeleton variant="line" className="h-6 w-32" />
                    <Skeleton variant="line" className="h-6 w-14" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-slate-500">Nenhum artigo publicado ainda.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                >
                  {post.cover_image_url ? (
                    <div className="h-56 overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ) : (
                    <div className="h-56 bg-gradient-to-br from-orange-100 to-amber-100" />
                  )}

                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                        {post.category}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(post.published_at)}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {post.read_time}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <button className="text-orange-600 font-semibold text-sm hover:text-orange-700 inline-flex items-center">
                        Ler artigo completo
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                      <span className="text-xs text-slate-400 flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        {post.views_count}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
              {(loading || loadingMore) &&
                Array.from({ length: 3 }).map((_, index) => (
                  <article key={`loader-${index}`} className={`${skeletonSurfaces.card} overflow-hidden`}>
                    <Skeleton className="h-56 w-full" />
                    <div className="p-6 space-y-5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Skeleton variant="line" className="h-7 w-24" />
                        <Skeleton variant="line" className="h-5 w-20" />
                        <Skeleton variant="line" className="h-5 w-16" />
                      </div>
                      <Skeleton className="h-7 w-3/4" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-5/6" />
                      <div className="flex items-center justify-between">
                        <Skeleton variant="line" className="h-6 w-32" />
                        <Skeleton variant="line" className="h-6 w-14" />
                      </div>
                    </div>
                  </article>
                ))}
            </div>
            {hasMore && filteredPosts.length > 0 && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loading || loadingMore}
                  className={`px-8 py-3 rounded-full font-semibold transition-all ${
                    loading || loadingMore
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-orange-600 text-white shadow-lg hover:bg-orange-700'
                  }`}
                >
                  {loading || loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BlogFooter />
      {feedbackToast}
    </div>
  );
}
