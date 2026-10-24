import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  Menu,
  Monitor,
  Moon,
  Palette,
  Smartphone,
  Sun,
  Tablet,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  Button,
  DesignSystemProvider,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerHeader,
  EmptyState,
  IconButton,
  NavigationList,
  SearchInput,
  SegmentedControl,
  ToastProvider,
  Tooltip,
} from '../../design-system';
import Foundations from './showcase/Foundations';
import ComponentCatalog from './showcase/ComponentCatalog';
import States from './showcase/States';
import WorkspacePreview from './showcase/WorkspacePreview';
import {
  isPattern,
  isSection,
  normalizeSearch,
  patterns,
  sections,
  type Pattern,
  type SectionId,
  type ShowcaseTheme,
} from './showcase/catalog';
import {
  ExploreButton,
  PreviewLink,
  SectionIntro,
  UsageNote,
} from './showcase/ShowcaseParts';
import './design-system-showcase.css';

const storageKey = 'kifer-ds-showcase-theme';
function readTheme(): ShowcaseTheme {
  try {
    return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
function currentSection(): SectionId {
  const value = window.location.hash.slice(1);
  return isSection(value) ? value : 'overview';
}

export default function DesignSystemShowcase() {
  const query = new URLSearchParams(window.location.search);
  const preview = query.get('preview') === '1';
  const requestedPattern = query.get('pattern') ?? 'list';
  const [theme, setTheme] = useState<ShowcaseTheme>(() =>
    preview ? (query.get('theme') === 'dark' ? 'dark' : 'light') : readTheme(),
  );
  useEffect(() => {
    if (!preview) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        /* Theme still works without browser storage. */
      }
    }
  }, [preview, theme]);
  return (
    <DesignSystemProvider
      theme={theme}
      className={`ds-showcase${preview ? ' ds-preview-document' : ''}`}
    >
      <Helmet>
        <title>Design system | Kifer Saúde</title>
      </Helmet>
      <ToastProvider position="bottom-right">
        {preview ? (
          <WorkspacePreview
            initialPattern={
              isPattern(requestedPattern) ? requestedPattern : 'list'
            }
          />
        ) : (
          <Showcase
            theme={theme}
            onThemeChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        )}
      </ToastProvider>
    </DesignSystemProvider>
  );
}

function Showcase({
  theme,
  onThemeChange,
}: {
  theme: ShowcaseTheme;
  onThemeChange: () => void;
}) {
  const [section, setSection] = useState<SectionId>(currentSection);
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const handleHash = () => setSection(currentSection());
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);
  const navigate = (id: string) => {
    if (!isSection(id)) return;
    setSection(id);
    setSearch('');
    setMobileNav(false);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'instant' });
    mainRef.current?.focus({ preventScroll: true });
  };
  const active = sections.find((item) => item.id === section)!;
  const results = sections.filter((item) =>
    normalizeSearch(`${item.label} ${item.description}`).includes(
      normalizeSearch(search),
    ),
  );
  return (
    <>
      <a href="#ds-main" className="ds-skip-link">
        Pular para o conteúdo
      </a>
      <aside className="ds-sidebar">
        <a
          className="ds-brand ds-main-brand"
          href="#overview"
          onClick={(event) => {
            event.preventDefault();
            navigate('overview');
          }}
          aria-label="Kifer Saúde, visão geral do design system"
        >
          <span className="ds-brand-mark">k.</span>
          <strong>
            Kifer Saúde<span>DESIGN SYSTEM</span>
          </strong>
        </a>
        <div className="ds-sidebar-section">
          <span className="ds-eyebrow">BIBLIOTECA DO CRM</span>
        </div>
        <NavigationList
          items={sections.map((item) => ({ ...item, href: `#${item.id}` }))}
          activeId={section}
          ariaLabel="Seções do design system"
          onNavigate={navigate}
        />
        <div className="ds-sidebar-bottom">
          <span className="ds-live-dot" />
          <span>Componentes reais do CRM</span>
          <p>
            Uma base compartilhada.
            <br />
            Cada experiência conectada.
          </p>
          <a className="ds-text-link" href="/painel">
            Acessar o CRM
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
      </aside>
      <Drawer
        open={mobileNav}
        onOpenChange={setMobileNav}
        side="left"
        size="sm"
      >
        <DrawerHeader onClose={() => setMobileNav(false)}>
          <DialogTitle>Design system</DialogTitle>
        </DrawerHeader>
        <DrawerBody>
          <NavigationList
            items={sections.map((item) => ({ ...item, href: `#${item.id}` }))}
            activeId={section}
            ariaLabel="Seções do design system no mobile"
            onNavigate={navigate}
          />
        </DrawerBody>
      </Drawer>
      <div className="ds-content-shell">
        <header className="ds-topbar">
          <div className="ds-row">
            <IconButton
              className="ds-mobile-control"
              aria-label="Abrir navegação"
              onClick={() => setMobileNav(!mobileNav)}
              aria-expanded={mobileNav}
            >
              <Menu />
            </IconButton>
            <Breadcrumb>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#overview"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate('overview');
                  }}
                >
                  Design system
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{active.label}</BreadcrumbItem>
            </Breadcrumb>
          </div>
          <div className="ds-topbar-actions">
            <SearchInput
              size="sm"
              aria-label="Buscar no design system"
              placeholder="Buscar no catálogo…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Tooltip
              content={
                theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'
              }
              side="bottom"
            >
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={
                  theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'
                }
                onClick={onThemeChange}
              >
                {theme === 'light' ? <Moon /> : <Sun />}
              </IconButton>
            </Tooltip>
          </div>
        </header>
        <main id="ds-main" className="ds-main" ref={mainRef} tabIndex={-1}>
          {search.trim() ? (
            <>
              <SectionIntro number="BUSCA" title="Encontre o padrão certo">
                Resultados para “{search}”.
              </SectionIntro>
              <div className="ds-search-results">
                {results.length ? (
                  results.map((item) => (
                    <button
                      key={item.id}
                      className="ds-search-result"
                      onClick={() => navigate(item.id)}
                    >
                      <item.icon size={22} />
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.description}</p>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="Nenhum padrão encontrado"
                    description="Tente buscar por botões, formulário, cores ou mobile."
                    action={
                      <Button variant="secondary" onClick={() => setSearch('')}>
                        Limpar busca
                      </Button>
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <>
              {section === 'overview' && (
                <Overview theme={theme} navigate={navigate} />
              )}
              {section === 'foundations' && <Foundations />}
              {section === 'components' && <ComponentCatalog />}
              {section === 'states' && <States />}
              {(section === 'patterns' || section === 'responsive') && (
                <PatternSection
                  theme={theme}
                  responsive={section === 'responsive'}
                />
              )}
            </>
          )}
          <footer className="ds-page-footer">
            <span>
              Kifer Saúde <span aria-hidden="true">/</span> Design system
            </span>
            <span>Clareza em cada interação.</span>
          </footer>
        </main>
      </div>
    </>
  );
}

function Overview({
  theme,
  navigate,
}: {
  theme: ShowcaseTheme;
  navigate: (id: string) => void;
}) {
  return (
    <>
      <section className="ds-hero">
        <div className="ds-hero-copy">
          <Badge tone="accent" size="sm">
            <span className="ds-live-dot" />
            TERRACOTA CRM
          </Badge>
          <h1>
            Uma base comum.
            <br />
            Mais clareza em
            <br />
            <em>cada experiência.</em>
          </h1>
          <p>
            O design system do Kifer Saúde reúne os fundamentos, componentes e
            padrões que dão forma ao nosso CRM.
          </p>
          <div className="ds-row ds-hero-actions">
            <Button onClick={() => navigate('components')}>
              Explorar componentes
              <ArrowRight />
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                document
                  .getElementById('ds-in-action')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Ver em uso
              <ArrowDown />
            </Button>
          </div>
        </div>
        <div className="ds-identity" aria-label="Identidade visual Terracota">
          <div className="ds-between">
            <span className="ds-eyebrow">A NOSSA LINGUAGEM</span>
            <Palette size={20} />
          </div>
          <div className="ds-identity-aa">
            Aa<span>Playfair Display + Inter</span>
          </div>
          <div className="ds-identity-swatches">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="ds-between">
            <span>
              Humana no tom.
              <br />
              Precisa na operação.
            </span>
            <span className="ds-identity-mark">k.</span>
          </div>
        </div>
      </section>
      <div className="ds-principles">
        {[
          {
            number: '01',
            title: 'Clareza primeiro',
            text: 'Hierarquia que orienta. Uma ação principal por contexto.',
          },
          {
            number: '02',
            title: 'Consistência sempre',
            text: 'Os mesmos componentes, do primeiro contato ao contrato.',
          },
          {
            number: '03',
            title: 'Cuidado nos detalhes',
            text: 'Feedback útil, navegação acessível e espaço para respirar.',
          },
        ].map((item) => (
          <div key={item.number}>
            <span>{item.number}</span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
      <section id="ds-in-action" className="ds-in-action">
        <div className="ds-section-heading">
          <div>
            <span className="ds-eyebrow">DO COMPONENTE À EXPERIÊNCIA</span>
            <h2>O sistema, em uso.</h2>
            <p>
              Explore uma listagem real de componentes. Busque, filtre, edite e
              experimente.
            </p>
          </div>
          <ExploreButton onClick={() => navigate('patterns')}>
            Todos os padrões
          </ExploreButton>
        </div>
        <PreviewStudio theme={theme} compact />
      </section>
      <div className="ds-section-heading">
        <div>
          <span className="ds-eyebrow">COMECE POR AQUI</span>
          <h2>Uma linguagem. Cinco perspectivas.</h2>
        </div>
      </div>
      <div className="ds-overview-links">
        {sections
          .filter((item) => item.id !== 'overview')
          .map((item, index) => (
            <button onClick={() => navigate(item.id)} key={item.id}>
              <item.icon size={22} />
              <span className="ds-eyebrow">0{index + 1}</span>
              <strong>{item.label}</strong>
              <span>
                {
                  [
                    'A matéria-prima de toda interface.',
                    'Blocos reais, prontos para reutilizar.',
                    'Cada ação merece uma resposta clara.',
                    'Páginas que seguem a mesma lógica.',
                    'A mesma experiência, em cada tela.',
                  ][index]
                }
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
      </div>
      <details className="ds-technical">
        <summary>Como esta biblioteca se conecta ao projeto</summary>
        <p>
          React 18, TypeScript e Vite. Componentes em src/design-system; estilos
          em styles.css, foundation.css, components.css, operational.css,
          primitives.css e themes.css. Tailwind compõe o layout; Lucide fornece
          os ícones. Os exemplos importam a API pública usada pelo CRM. As
          interações usam dados locais e não chamam integrações comerciais.
        </p>
      </details>
    </>
  );
}

function PreviewStudio({
  theme,
  compact = false,
}: {
  theme: ShowcaseTheme;
  compact?: boolean;
}) {
  const [pattern, setPattern] = useState<Pattern>('list');
  const [device, setDevice] = useState<
    'desktop' | 'tablet' | 'mobile' | 'compact'
  >('desktop');
  const dimensions = {
    desktop: 'calc(100% - 2px)',
    tablet: '768px',
    mobile: '390px',
    compact: '320px',
  };
  return (
    <div className="ds-studio">
      <div className="ds-studio-toolbar">
        {compact ? (
          <div className="ds-row">
            <Boxes size={16} />
            <strong>Listagem de contatos</strong>
          </div>
        ) : (
          <SegmentedControl
            ariaLabel="Padrão de página"
            size="sm"
            items={patterns}
            value={pattern}
            onChange={setPattern}
          />
        )}
        <div
          className="ds-device-controls"
          role="group"
          aria-label="Largura da prévia"
        >
          {(
            [
              { id: 'desktop', label: 'Desktop', icon: Monitor },
              { id: 'tablet', label: 'Tablet', icon: Tablet },
              { id: 'mobile', label: 'Mobile', icon: Smartphone },
              { id: 'compact', label: '320 px', icon: Smartphone },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <Tooltip key={id} content={label} side="bottom">
              <IconButton
                size="sm"
                variant={device === id ? 'soft' : 'ghost'}
                aria-label={`Visualizar em ${label.toLowerCase()}`}
                aria-pressed={device === id}
                onClick={() => setDevice(id)}
              >
                <Icon />
              </IconButton>
            </Tooltip>
          ))}
        </div>
      </div>
      <div
        className="ds-studio-canvas"
        data-device={device}
        role="region"
        aria-label="Prévia responsiva com rolagem localizada"
        tabIndex={0}
      >
        <div className="ds-browser-frame" style={{ width: dimensions[device] }}>
          <div className="ds-browser-bar">
            <div>
              <i />
              <i />
              <i />
            </div>
            <span>
              kifersaude ·{' '}
              {patterns
                .find((item) => item.id === pattern)
                ?.label.toLocaleLowerCase('pt-BR')}
            </span>
            <span>
              {device === 'desktop'
                ? 'Fluido'
                : device === 'tablet'
                  ? '768 px'
                  : device === 'compact'
                    ? '320 px'
                    : '390 px'}
            </span>
          </div>
          <iframe
            title={`Prévia interativa: ${patterns.find((item) => item.id === pattern)?.label}`}
            src={`/design-system?preview=1&pattern=${pattern}&theme=${theme}`}
            className={`ds-preview-iframe${compact ? ' is-compact' : ''}`}
          />
        </div>
      </div>
      <div className="ds-studio-footer">
        <span>
          <Check size={14} />
          Componentes do projeto · dados demonstrativos
        </span>
        <PreviewLink pattern={pattern} theme={theme} />
      </div>
    </div>
  );
}

function PatternSection({
  theme,
  responsive,
}: {
  theme: ShowcaseTheme;
  responsive: boolean;
}) {
  return (
    <>
      <SectionIntro
        number={responsive ? '05' : '04'}
        title={
          responsive ? 'Uma experiência que se adapta.' : 'Padrões de layout'
        }
      >
        {responsive
          ? 'Teste a largura real da prévia. Os mesmos controles e fluxos se reorganizam para desktop, tablet e mobile.'
          : 'Do cabeçalho ao salvamento, cada página segue uma lógica familiar. Experimente os fluxos com os componentes reais.'}
      </SectionIntro>
      <Alert tone="info">
        As alterações ficam apenas nesta prévia. Você pode criar e editar
        exemplos sem alterar o CRM.
      </Alert>
      <PreviewStudio theme={theme} />
      {responsive ? (
        <>
          <div className="ds-grid ds-grid-three">
            <UsageNote title="Desktop · a partir de 1024 px">
              Navegação lateral visível. Título à esquerda e ações à direita.
              Tabelas mantêm suas colunas e indicadores compartilham a mesma
              linha.
            </UsageNote>
            <UsageNote title="Tablet · 768 a 1023 px">
              Navegação recolhida em menu. Ações podem passar para uma nova
              linha. Formulários usam duas colunas quando há espaço suficiente.
            </UsageNote>
            <UsageNote title="Mobile · abaixo de 768 px">
              Contatos viram cards com as mesmas informações. Formulários usam
              uma coluna. Ações de salvar e cancelar dividem a largura
              disponível.
            </UsageNote>
          </div>
          <UsageNote title="Como comparar">
            A prévia usa um documento próprio, com a largura real escolhida. Em
            telas menores, deslize horizontalmente a área da prévia para
            inspecionar desktop ou tablet. Use “Abrir exemplo” para testar
            diretamente no seu dispositivo.
          </UsageNote>
        </>
      ) : (
        <>
          <div className="ds-subheading">
            <h2>A posição também comunica</h2>
            <span>Convenções para as próximas telas</span>
          </div>
          <div className="ds-ux-rules">
            {[
              [
                '01',
                'Orientação antes da ação',
                'Breadcrumb acima do título. Um título que explica a página, seguido de uma descrição curta. Navegação mantém a seção atual identificada.',
              ],
              [
                '02',
                'Uma ação principal',
                'No cabeçalho, a ação principal fica à direita no desktop e abaixo do título em telas menores. Ações secundárias aparecem antes dela, com menor ênfase.',
              ],
              [
                '03',
                'Busca e filtros juntos',
                'Abaixo do cabeçalho, busca à esquerda e filtros próximos. Mostre quantos resultados foram encontrados e ofereça uma forma explícita de limpar os filtros.',
              ],
              [
                '04',
                'Salvar tem um lugar',
                'Ações no final do formulário: Cancelar antes de Salvar. Use uma barra sticky em páginas longas, sem remover o espaço das ações no documento. Durante o envio, bloqueie repetição e cancelamento.',
              ],
              [
                '05',
                'Detalhes preservam o contexto',
                'Agrupe informações relacionadas em seções. Use drawer para consulta rápida; página para trabalho contínuo; modal para uma tarefa curta ou confirmação. Excluir fica separado de Salvar e exige confirmação.',
              ],
              [
                '06',
                'Estados explicam o próximo passo',
                'Vazio orienta como começar; erro explica como recuperar; sucesso confirma uma ação concluída. Validação fica junto do campo e leva o foco ao primeiro erro.',
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
          <details className="ds-technical">
            <summary>Blocos reutilizáveis destes layouts</summary>
            <p>
              ListPage reúne PageHeader, PageActions, busca, filtros e
              paginação. DetailPage organiza identificação, status e seções;
              FormPage usa FormSection e FormActions; DashboardPage agrupa
              filtros e indicadores. O conteúdo reutiliza Card/Table/EmptyState
              → Pagination. Formulários: Field + controles + FormActions.
              Sobreposições: Dialog/Drawer + cabeçalho + corpo + ações.
              Navegação: NavigationList. Não há importação de repositories ou
              consultas nestes exemplos.
            </p>
          </details>
        </>
      )}
    </>
  );
}
