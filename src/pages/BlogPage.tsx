import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Calendar, Clock, ChevronRight, ArrowLeft, Heart, Phone, Mail, Instagram, MapPin, MessageCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

export default function BlogPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  useEffect(() => {
    if (slug) {
      loadPostBySlug(slug);
    } else {
      loadPosts();
    }
  }, [slug]);

  const loadPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
    setLoading(false);
  };

  const loadPostBySlug = async (postSlug: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', postSlug)
      .eq('published', true)
      .maybeSingle();

    if (!error && data) {
      setSelectedPost(data);
      incrementViewCount(data.id);
      loadRelatedPosts(data.category, data.id);
    }
    setLoading(false);
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

  const filteredPosts = selectedCategory === 'Todos'
    ? posts
    : posts.filter(p => p.category === selectedCategory);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/5521964681047?text=Olá! Vim através do blog e gostaria de mais informações sobre planos de saúde.', '_blank');
  };

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-slate-50">
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

            <div className="border-t border-slate-200 pt-8">
              <div
                className="prose prose-slate max-w-none
                  prose-headings:text-slate-900 prose-headings:font-bold
                  prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                  prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-lg
                  prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                  prose-li:text-slate-700 prose-li:mb-2
                  prose-strong:text-slate-900 prose-strong:font-semibold
                  prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8"
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
              <p>&copy; 2025 Kifer Saúde. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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

        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {categories.map((category) => (
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

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-slate-500">Nenhum artigo publicado ainda.</p>
          </div>
        ) : (
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
          </div>
        )}
      </div>

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
            <p>&copy; 2025 Kifer Saúde. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
