import {
  ActionSurface, Avatar, BrandWordmark, Button, ConfirmDialog, DesignSystemProvider, DialogTitle, Drawer,
  DrawerBody, DrawerHeader, DropdownOption, IconButton, LoadingState, PANEL_THEME_STORAGE_KEY,
  Popover, PopoverContent, PopoverTrigger, Text, WorkspaceHeader, readPanelTheme,
} from '../design-system';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { gsap } from 'gsap';
import {
  Bell, Brain, BookOpen, Calendar, ChevronDown, ChevronsDown, ChevronsUp, FileText, LayoutDashboard, Link2,
  LogOut, MessageCircle, PanelLeftClose, PanelLeftOpen, Plug, Plus, Search, Send,
  Settings, User, Users, Wallet, Workflow, X, type LucideIcon,
} from 'lucide-react';
import { WorkspaceSearch, type WorkspaceDestination } from './WorkspaceSearch';
import {
  deduplicateBirthdayPeople,
  loadNotificationSummarySource,
  subscribeToReminderChanges,
  type NotificationContract,
  type NotificationReminder,
} from '../features/reminders';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { getContractBonusSummary } from '../lib/contractBonus';
import { getCommissionInstallmentSummary } from '../lib/contractCommission';
import { cx } from '../lib/cx';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TabNavigationOptions } from '../types/navigation';
import { usePanelMotion } from '../hooks/usePanelMotion';
import { getAllowedConfigTabs, getConfigAreaForTab, type ConfigTabType } from '../features/config';

type TabConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  configTab?: ConfigTabType;
};

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  headerTitle?: string;
  useFullBleedContent?: boolean;
  onTabChange: (tab: string, options?: TabNavigationOptions) => void;
  unreadReminders: number;
  unreadInboxChats?: number;
  hasActiveNotification?: boolean;
  newLeadsCount?: number;
};

export default function Layout({
  children,
  activeTab,
  headerTitle,
  useFullBleedContent = false,
  onTabChange,
  unreadReminders,
  unreadInboxChats = 0,
  hasActiveNotification,
  newLeadsCount = 0,
}: LayoutProps) {
  const { signOut, role, userProfile } = useAuth();
  const { getRoleModulePermission, accessProfiles } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('painel.sidebar.collapsed');
    return stored === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [themeMode, setThemeMode] = useState(readPanelTheme);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationsWarning, setNotificationsWarning] = useState<string | null>(null);
  const [todayReminders, setTodayReminders] = useState<NotificationReminder[]>([]);
  const [todayPayments, setTodayPayments] = useState<{
    id: string;
    type: 'comissao' | 'bonificacao';
    value: number;
    contract: NotificationContract;
    installmentLabel?: string;
  }[]>([]);
  const [todayBirthdays, setTodayBirthdays] = useState<{
    id: string;
    name: string;
    role: 'Titular' | 'Dependente';
    contract?: NotificationContract | null;
    holderName?: string | null;
  }[]>([]);
  const notificationsRequestIdRef = useRef(0);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarNavigationRef = useRef<HTMLElement | null>(null);
  const [sidebarOverflow, setSidebarOverflow] = useState({ above: false, below: false });
  const mainRef = useRef<HTMLElement | null>(null);
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const themeSwitchFrameRef = useRef<number | null>(null);
  const {
    motionEnabled,
    enterDuration,
    revealDistance,
    ease,
  } = usePanelMotion();
  const isSidebarCollapsed = isMenuCollapsed && !isMobileMenuOpen;
  const sidebarOffset = isSidebarCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)';
  const canView = (moduleId: string) => getRoleModulePermission(role, moduleId).can_view;
  const canEdit = (moduleId: string) => canView(moduleId) && getRoleModulePermission(role, moduleId).can_edit;
  const allowedConfigTabs = getAllowedConfigTabs(role, getRoleModulePermission);
  const currentConfigTab = new URLSearchParams(location.search).get('tab') ?? (activeTab === 'automation-hub' ? 'automation' : 'system');
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname, currentConfigTab]);
  const roleLabel = accessProfiles?.find((profile) => profile.slug === role)?.name
    ?? (role === 'admin' ? 'Administrador' : role === 'observer' ? 'Observador' : undefined);
  const groups: { label: string; items: TabConfig[] }[] = [
    { label: 'Operação', items: [
      { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
      { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount },
      { id: 'contracts', label: 'Contratos', icon: FileText },
      { id: 'agenda', label: 'Agenda', icon: Calendar, badge: unreadReminders },
      { id: 'whatsapp-inbox', label: 'Inbox', icon: MessageCircle, badge: unreadInboxChats },
    ] },
    { label: 'Gestão', items: [
      { id: 'financeiro-comissoes', label: 'Financeiro', icon: Wallet },
      { id: 'automation-hub', label: 'Automações', icon: Workflow, configTab: 'automation' },
      { id: 'automation-hub', label: 'Inteligência artificial', icon: Brain, configTab: 'ai' },
      { id: 'whatsapp-campaigns', label: 'Disparos', icon: Send },
    ] },
    { label: 'Conteúdo', items: [
      { id: 'blog', label: 'Blog', icon: BookOpen },
      { id: 'config', label: 'Formulários', icon: FileText, configTab: 'forms' },
      { id: 'config', label: 'Página de links', icon: Link2, configTab: 'links' },
    ] },
    { label: 'Sistema', items: [
      { id: 'automation-hub', label: 'Integrações', icon: Plug, configTab: 'integrations' },
      { id: 'config', label: 'Configurações', icon: Settings, configTab: allowedConfigTabs.some((tab) => tab.id === 'system') ? 'system' : 'users' },
    ] },
  ];
  const visibleGroups = groups.map(({ label, items }) => ({
    label,
    items: items.filter((item) => item.configTab ? allowedConfigTabs.some((tab) => tab.id === item.configTab) : canView(item.id)),
  })).filter(({ items }) => items.length > 0);
  const sidebarNavigationKey = visibleGroups
    .map(({ label, items }) => `${label}:${items.map((item) => item.configTab ?? item.id).join(',')}`)
    .join('|');

  const updateSidebarOverflow = useCallback(() => {
    const navigation = sidebarNavigationRef.current;
    if (!navigation) return;

    const above = navigation.scrollTop > 2;
    const below = navigation.scrollTop + navigation.clientHeight < navigation.scrollHeight - 2;
    setSidebarOverflow((previous) => (
      previous.above === above && previous.below === below ? previous : { above, below }
    ));
  }, []);

  useEffect(() => {
    const navigation = sidebarNavigationRef.current;
    if (!navigation) return;

    updateSidebarOverflow();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSidebarOverflow);
    observer?.observe(navigation);
    Array.from(navigation.children).forEach((child) => observer?.observe(child));
    window.addEventListener('resize', updateSidebarOverflow);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSidebarOverflow);
    };
  }, [isSidebarCollapsed, isMobileMenuOpen, sidebarNavigationKey, updateSidebarOverflow]);

  useEffect(() => {
    const navigation = sidebarNavigationRef.current;
    const activeItem = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!navigation || !activeItem) return;

    const navigationBounds = navigation.getBoundingClientRect();
    const activeBounds = activeItem.getBoundingClientRect();
    const clearance = 24;
    if (activeBounds.top < navigationBounds.top + clearance) {
      navigation.scrollTop += activeBounds.top - navigationBounds.top - clearance;
    } else if (activeBounds.bottom > navigationBounds.bottom - clearance) {
      navigation.scrollTop += activeBounds.bottom - navigationBounds.bottom + clearance;
    }
    updateSidebarOverflow();
  }, [activeTab, currentConfigTab, isSidebarCollapsed, updateSidebarOverflow]);

  const scrollSidebarNavigation = (direction: -1 | 1) => {
    const navigation = sidebarNavigationRef.current;
    if (!navigation) return;
    navigation.scrollBy({
      top: direction * Math.max(96, navigation.clientHeight * 0.65),
      behavior: 'smooth',
    });
  };
  const availableConfigTabs = allowedConfigTabs.filter((tab) => getConfigAreaForTab(tab.id) === (activeTab === 'automation-hub' ? 'automation' : 'settings'));
  const selectedConfigTab = availableConfigTabs.some((tab) => tab.id === currentConfigTab) ? currentConfigTab : availableConfigTabs[0]?.id;
  const isSelected = (item: TabConfig) => item.id === activeTab && (
    location.pathname === '/chat' ? item.configTab === 'ai'
      : !item.configTab || item.configTab === selectedConfigTab || (item.icon === Settings && selectedConfigTab === 'users')
  );
  const selectDestination = (item: TabConfig) => {
    setIsMobileMenuOpen(false);
    if (item.configTab) {
      const path = item.id === 'automation-hub' ? 'automacoes' : 'config';
      navigate('/painel/' + path + '?tab=' + item.configTab);
    } else {
      onTabChange(item.id);
    }
  };
  const destinations: WorkspaceDestination[] = visibleGroups.flatMap(({ label, items }) => items.map((item) => ({
    id: item.configTab ?? item.id, label: item.label, icon: item.icon, group: label,
    onSelect: () => selectDestination(item),
  })));
  const creationActions = [
    { module: 'leads', path: 'leads', label: 'Novo lead', icon: Users },
    { module: 'contracts', path: 'contratos', label: 'Novo contrato', icon: FileText },
    { module: 'agenda', path: 'agenda', label: 'Nova tarefa', icon: Calendar },
    { module: 'whatsapp-inbox', path: 'inbox', label: 'Nova conversa', icon: MessageCircle },
  ].filter(({ module }) => canEdit(module));

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getDateKey = (date: Date) => date.toISOString().split('T')[0];

  const toDate = (value?: string | null) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isSameDay = (date: Date, other: Date) =>
    date.getFullYear() === other.getFullYear() &&
    date.getMonth() === other.getMonth() &&
    date.getDate() === other.getDate();

  const isSameMonthDay = (date: Date, other: Date) =>
    date.getMonth() === other.getMonth() && date.getDate() === other.getDate();

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const roundCurrency = (value: number) => Math.round(value * 100) / 100;

  const loadNotificationsSummary = useCallback(async () => {
    const requestId = notificationsRequestIdRef.current + 1;
    notificationsRequestIdRef.current = requestId;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const todayKey = getDateKey(startOfDay);

      const {
        reminders: remindersData,
        contracts: activeContracts,
        holders: holdersData,
        dependents: dependentsData,
        failedSources,
      } = await loadNotificationSummarySource(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
      );

      const activeContractIds = new Set(activeContracts.map((contract) => contract.id));
      const holders = (holdersData || []).filter((holder) => activeContractIds.has(holder.contract_id));
      const dependents = (dependentsData || []).filter((dependent) => activeContractIds.has(dependent.contract_id));
      const holderByContractId = new Map(holders.map((holder) => [holder.contract_id, holder]));

      const payments: {
        id: string;
        type: 'comissao' | 'bonificacao';
        value: number;
        contract: NotificationContract;
        installmentLabel?: string;
      }[] = [];

      activeContracts.forEach((contract) => {
        const commissionDate = toDate(contract.previsao_recebimento_comissao);
        if (commissionDate && contract.comissao_prevista) {
          const totalCommission = contract.comissao_prevista;
          const isUpfront = contract.comissao_recebimento_adiantado ?? true;
          const customInstallments = getCommissionInstallmentSummary(contract).installments;

          if (!isUpfront && customInstallments.length > 0) {
            customInstallments.forEach((parcel, index) => {
              const parcelDate = toDate(parcel.data_pagamento) || commissionDate;
              const parcelValue = roundCurrency(parcel.resolvedValue || totalCommission);

              if (getDateKey(parcelDate) === todayKey) {
                payments.push({
                  id: `${contract.id}-comissao-${index + 1}`,
                  type: 'comissao',
                  value: parcelValue,
                  contract,
                  installmentLabel: `${index + 1}/${customInstallments.length}`,
                });
              }
            });
          } else if (!isUpfront && contract.mensalidade_total && contract.mensalidade_total > 0) {
            const monthlyCap = contract.mensalidade_total;
            let remaining = roundCurrency(totalCommission);
            let installmentIndex = 0;
            const MAX_INSTALLMENTS = 60;

            while (remaining > 0.009 && installmentIndex < MAX_INSTALLMENTS) {
              const value = roundCurrency(Math.min(monthlyCap, remaining));
              const installmentDate = new Date(commissionDate);
              installmentDate.setMonth(installmentDate.getMonth() + installmentIndex);

              if (getDateKey(installmentDate) === todayKey) {
                payments.push({
                  id: `${contract.id}-comissao-${installmentIndex + 1}`,
                  type: 'comissao',
                  value,
                  contract,
                  installmentLabel: `${installmentIndex + 1}`,
                });
              }

              remaining = roundCurrency(remaining - value);
              installmentIndex += 1;
            }
          } else if (getDateKey(commissionDate) === todayKey) {
            payments.push({
              id: `${contract.id}-comissao`,
              type: 'comissao',
              value: totalCommission,
              contract,
            });
          }
        }

        const bonusDate = toDate(contract.previsao_pagamento_bonificacao);
        const bonusSummary = getContractBonusSummary(contract);
        if (bonusDate && bonusSummary.total > 0 && getDateKey(bonusDate) === todayKey) {
          payments.push({
            id: `${contract.id}-bonus`,
            type: 'bonificacao',
            value: bonusSummary.total,
            contract,
          });
        }
      });

      const birthdays: {
        id: string;
        name: string;
        role: 'Titular' | 'Dependente';
        contract?: NotificationContract | null;
        holderName?: string | null;
      }[] = [];

      deduplicateBirthdayPeople(holders, activeContracts).forEach((holder) => {
        const birthDate = toDate(holder.data_nascimento);
        if (!birthDate) return;
        if (!isSameMonthDay(birthDate, startOfDay)) return;

        birthdays.push({
          id: holder.id,
          name: holder.nome_completo,
          role: 'Titular',
          contract: activeContracts.find((contract) => contract.id === holder.contract_id) ?? null,
          holderName: holder.nome_fantasia || holder.razao_social || holder.nome_completo,
        });
      });

      deduplicateBirthdayPeople(dependents, activeContracts).forEach((dependent) => {
        const birthDate = toDate(dependent.data_nascimento);
        if (!birthDate) return;
        if (!isSameMonthDay(birthDate, startOfDay)) return;

        const holder = holderByContractId.get(dependent.contract_id);
        birthdays.push({
          id: dependent.id,
          name: dependent.nome_completo,
          role: 'Dependente',
          contract: activeContracts.find((contract) => contract.id === dependent.contract_id) ?? null,
          holderName: holder?.nome_fantasia || holder?.razao_social || holder?.nome_completo || null,
        });
      });

      const remindersForToday = (remindersData || []).filter((reminder) => {
        const reminderDate = toDate(reminder.data_lembrete);
        return reminderDate ? isSameDay(reminderDate, startOfDay) : false;
      });

      if (requestId !== notificationsRequestIdRef.current) return;
      setTodayReminders(remindersForToday);
      setTodayPayments(payments);
      setTodayBirthdays(birthdays);
      setNotificationsWarning(failedSources.length > 0
        ? 'Parte do resumo não pôde ser atualizada agora.'
        : null);
    } catch (error) {
      if (requestId === notificationsRequestIdRef.current) {
        console.error('Erro ao carregar central de notificações:', error);
        setNotificationsError('Não foi possível carregar o resumo do dia.');
        setNotificationsWarning(null);
      }
    } finally {
      if (requestId === notificationsRequestIdRef.current) {
        setNotificationsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!showNotificationsDropdown) {
      return;
    }

    loadNotificationsSummary();
    const interval = setInterval(loadNotificationsSummary, 60000);

    return () => {
      clearInterval(interval);
      notificationsRequestIdRef.current += 1;
    };
  }, [loadNotificationsSummary, showNotificationsDropdown]);

  useEffect(() => {
    if (!showNotificationsDropdown) {
      return;
    }

    const unsubscribe = subscribeToReminderChanges(() => {
      loadNotificationsSummary();
    });

    return () => {
      unsubscribe();
    };
  }, [loadNotificationsSummary, showNotificationsDropdown]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const closeOnDesktop = () => {
      if (!mobileQuery.matches) setIsMobileMenuOpen(false);
    };
    mobileQuery.addEventListener('change', closeOnDesktop);
    return () => mobileQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener('keydown', openSearch);
    return () => document.removeEventListener('keydown', openSearch);
  }, []);

  useEffect(() => {
    localStorage.setItem('painel.sidebar.collapsed', String(isMenuCollapsed));
  }, [isMenuCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && themeSwitchFrameRef.current !== null) {
        window.cancelAnimationFrame(themeSwitchFrameRef.current);
      }

      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('theme-switching');
      }
    };
  }, []);

  useEffect(() => {
    const panelContent = panelContentRef.current;
    if (!panelContent) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(panelContent, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        clearProps: 'transform,opacity,willChange',
      });
      return;
    }

    const animation = gsap.fromTo(
      panelContent,
      {
        autoAlpha: 0,
        y: revealDistance,
        scale: 0.997,
        willChange: 'transform,opacity',
      },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: enterDuration,
        ease,
        clearProps: 'transform,opacity,willChange',
        overwrite: 'auto',
        force3D: true,
      },
    );

    return () => {
      animation.kill();
    };
  }, [activeTab, ease, enterDuration, motionEnabled, revealDistance]);

  const changeThemeMode = (nextMode: 'light' | 'dark') => {
    if (themeMode === nextMode) return;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.documentElement.classList.add('theme-switching');

      if (themeSwitchFrameRef.current !== null) {
        window.cancelAnimationFrame(themeSwitchFrameRef.current);
      }

      themeSwitchFrameRef.current = window.requestAnimationFrame(() => {
        themeSwitchFrameRef.current = window.requestAnimationFrame(() => {
          document.documentElement.classList.remove('theme-switching');
          themeSwitchFrameRef.current = null;
        });
      });
    }

    setThemeMode(nextMode);
  };
  const toggleThemeMode = () => changeThemeMode(themeMode === 'dark' ? 'light' : 'dark');

  const renderSidebarBadge = (count: number) => (
    <span className="kds-sidebar-badge">{count > 99 ? '99+' : count}</span>
  );

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const menu = sidebarRef.current;
    const menuTrigger = mobileMenuTriggerRef.current;
    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(menu?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter(item => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== 'hidden');
    const firstFocusable = focusable()[0];
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      menuTrigger?.focus();
    };
  }, [isMobileMenuOpen]);

  return (
    <DesignSystemProvider
      theme={themeMode}
      workspace
      onThemeChange={changeThemeMode}
      className={`kifer-panel-theme kds-app-shell terracota-shell relative isolate flex h-[100dvh] overflow-hidden ${activeTab === 'whatsapp-inbox' ? 'is-whatsapp-inbox-active' : ''}`}
    >
      {isMobileMenuOpen && (
        <ActionSurface variant="plain" padding="none"
          type="button"
          className="terracota-mobile-menu-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside
        ref={sidebarRef}
        id="painel-navigation"
        role={isMobileMenuOpen ? 'dialog' : undefined}
        aria-modal={isMobileMenuOpen || undefined}
        aria-label="Navegação principal"
        data-collapsed={isSidebarCollapsed}
        className={cx('kds-sidebar terracota-sidebar', isMobileMenuOpen && 'is-mobile-open')}
      >
        <div className="terracota-sidebar-header">
          <BrandWordmark variant={isSidebarCollapsed ? 'symbol' : 'lockup'} />
          {isMobileMenuOpen
            ? <IconButton variant="ghost" aria-label="Fechar menu" onClick={() => setIsMobileMenuOpen(false)}><X aria-hidden="true" /></IconButton>
            : !isSidebarCollapsed && <IconButton variant="ghost" size="sm" className="terracota-sidebar-collapse-toggle" aria-label="Recolher menu" onClick={() => setIsMenuCollapsed(true)}><PanelLeftClose aria-hidden="true" /></IconButton>}
        </div>
        {!isSidebarCollapsed && <Text className="terracota-workspace-name">Nosso espaço de trabalho</Text>}
        <div className="terracota-sidebar-navigation-frame">
          <nav
            ref={sidebarNavigationRef}
            className="terracota-sidebar-navigation"
            aria-label="Áreas do painel"
            onScroll={updateSidebarOverflow}
          >
            {visibleGroups.map(({ label, items }) => (
              <div key={label} className="terracota-nav-group" role="group" aria-label={label}>
                {!isSidebarCollapsed && <Text className="terracota-nav-label">{label}</Text>}
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isSelected(item);
                  return <ActionSurface
                    key={item.configTab ?? item.id}
                    variant="plain"
                    padding="none"
                    className={cx('kds-sidebar-item terracota-nav-item', active && 'is-active')}
                    aria-current={active ? 'page' : undefined}
                    aria-label={isSidebarCollapsed ? item.label : undefined}
                    title={isSidebarCollapsed ? item.label : undefined}
                    onClick={() => selectDestination(item)}
                  >
                    <Icon className="kds-control-icon" aria-hidden="true" />
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                    {Boolean(item.badge) && renderSidebarBadge(item.badge ?? 0)}
                  </ActionSurface>;
                })}
              </div>
            ))}
          </nav>
          {sidebarOverflow.above && (
            <button
              type="button"
              className="terracota-sidebar-scroll-hint terracota-sidebar-scroll-hint--top"
              aria-label="Mostrar itens anteriores do menu"
              onClick={() => scrollSidebarNavigation(-1)}
            >
              <ChevronsUp aria-hidden="true" />
            </button>
          )}
          {sidebarOverflow.below && (
            <button
              type="button"
              className="terracota-sidebar-scroll-hint terracota-sidebar-scroll-hint--bottom"
              aria-label="Mostrar mais itens do menu"
              onClick={() => scrollSidebarNavigation(1)}
            >
              <ChevronsDown aria-hidden="true" />
            </button>
          )}
        </div>
        {isMobileMenuOpen && <div className="terracota-sidebar-footer">
          <Button size="sm" variant="ghost" onClick={() => { setIsMobileMenuOpen(false); setProfileOpen(true); }}><User className="kds-control-icon" aria-hidden="true" />Minha conta</Button>
          <Button size="sm" variant="ghost" onClick={() => { setIsMobileMenuOpen(false); setSignOutOpen(true); }}><LogOut className="kds-control-icon" aria-hidden="true" />Sair do painel</Button>
        </div>}
        {isSidebarCollapsed && <div className="terracota-sidebar-footer">
          <IconButton variant="ghost" className="terracota-sidebar-expand-toggle" aria-label="Expandir menu" title="Expandir menu" onClick={() => setIsMenuCollapsed(false)}><PanelLeftOpen aria-hidden="true" /></IconButton>
        </div>}
      </aside>

      <Drawer open={showNotificationsDropdown} onOpenChange={setShowNotificationsDropdown} className="kds-workspace-notifications">
        <DrawerHeader onClose={() => setShowNotificationsDropdown(false)}><DialogTitle>Central do dia</DialogTitle></DrawerHeader>
        <DrawerBody>
          {canView('agenda') && <div className="kds-workspace-notification-actions">
            <Button variant="secondary" size="sm" onClick={() => { onTabChange('agenda'); setShowNotificationsDropdown(false); }}>Abrir agenda</Button>
          </div>}
          <LoadingState active={notificationsLoading} compact className="px-4 py-6" label="Carregando notificações" fallback={() => notificationsError ? (
            <div className="px-4 py-6 text-sm text-[var(--danger-text)]">{notificationsError}</div>
          ) : (
            <div className="kds-workspace-notification-list">
              {notificationsWarning && (
                <div className="border-b border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-xs text-[var(--warning-text)]" role="status">
                  {notificationsWarning}
                </div>
              )}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Lembretes do dia</Text>
                  <span className="text-xs text-[var(--text-muted)]">{todayReminders.length}</span>
                </div>
                {todayReminders.length === 0 ? (
                  <Text className="mt-2 text-sm text-[var(--text-muted)]">Nenhum lembrete para hoje.</Text>
                ) : (
                  <div className="mt-2 space-y-2">
                    {todayReminders.slice(0, 5).map((reminder) => (
                      <div key={reminder.id} className="kds-list-item">
                        <Text className="text-sm font-semibold text-[var(--text-primary)]">{reminder.titulo}</Text>
                        <Text className="text-xs text-[var(--text-muted)]">{formatDateTimeFullBR(reminder.data_lembrete)}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="kds-popover-section border-t px-4 py-3">
                <div className="flex items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Previsões do dia</Text>
                  <span className="text-xs text-[var(--text-muted)]">{todayPayments.length}</span>
                </div>
                {todayPayments.length === 0 ? (
                  <Text className="mt-2 text-sm text-[var(--text-muted)]">Nenhum pagamento previsto para hoje.</Text>
                ) : (
                  <div className="mt-2 space-y-2">
                    {todayPayments.slice(0, 5).map((payment) => (
                      <div key={payment.id} className="kds-list-item kds-list-item-success">
                        <Text className="text-sm font-semibold text-[var(--text-primary)]">
                          {payment.type === 'comissao' ? 'Comissão' : 'Bonificação'}
                          {payment.installmentLabel ? ` (${payment.installmentLabel})` : ''}
                        </Text>
                        <Text className="text-xs text-[var(--text-secondary)]">{payment.contract.codigo_contrato} • {formatCurrency(payment.value)}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="kds-popover-section border-t px-4 py-3">
                <div className="flex items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Aniversariantes</Text>
                  <span className="text-xs text-[var(--text-muted)]">{todayBirthdays.length}</span>
                </div>
                {todayBirthdays.length === 0 ? (
                  <Text className="mt-2 text-sm text-[var(--text-muted)]">Nenhum aniversariante hoje.</Text>
                ) : (
                  <div className="mt-2 space-y-2">
                    {todayBirthdays.slice(0, 5).map((birthday) => (
                      <div key={birthday.id} className="kds-list-item kds-list-item-warning">
                        <Text className="text-sm font-semibold text-[var(--text-primary)]">{birthday.name}</Text>
                        <Text className="text-xs text-[var(--text-secondary)]">
                          {birthday.role}
                          {birthday.holderName ? ` • Titular: ${birthday.holderName}` : ''}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )} />
        </DrawerBody>
      </Drawer>
      <Drawer open={profileOpen} onOpenChange={setProfileOpen} size="sm">
        <DrawerHeader onClose={() => setProfileOpen(false)}><DialogTitle>Minha conta</DialogTitle></DrawerHeader>
        <DrawerBody className="kds-workspace-profile">
          <div className="kds-workspace-profile-identity">
            <Avatar name={userProfile?.username ?? 'Conta conectada'} tone="brand" size="lg" />
            <div>
              <Text tone="primary" weight="semibold">{userProfile?.username ?? 'Conta conectada'}</Text>
              {roleLabel && <Text size="sm">{roleLabel}</Text>}
              {userProfile?.email && <Text size="sm" tone="muted">{userProfile.email}</Text>}
            </div>
          </div>
          <div className="kds-workspace-profile-theme">
            <Text size="sm" weight="medium">Aparência do painel</Text>
            <Button variant="secondary" size="sm" onClick={toggleThemeMode}>Ativar tema {themeMode === 'dark' ? 'claro' : 'escuro'}</Button>
          </div>
        </DrawerBody>
      </Drawer>
      <ConfirmDialog open={signOutOpen} onOpenChange={setSignOutOpen} onConfirm={handleLogout} closeOnConfirm title="Sair do painel?" description="Entre novamente com sua conta para retomar o trabalho." confirmLabel="Sair" />
      <WorkspaceSearch
        key={String(searchOpen)}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        destinations={destinations}
        onSearchLeads={canView('leads') ? (search) => onTabChange('leads', { search }) : undefined}
        onSearchContracts={canView('contracts') ? (search) => onTabChange('contracts', { search }) : undefined}
      />

      <div
        className={`terracota-content-shell relative z-10 flex min-h-0 min-w-0 flex-1 flex-col transition-[margin,width,max-width] duration-300 ${useFullBleedContent ? 'is-full-bleed' : ''}`}
        style={{ '--terracota-sidebar-width': sidebarOffset } as CSSProperties}
      >
        <WorkspaceHeader
          title={headerTitle ?? visibleGroups.flatMap(({ items }) => items).find(isSelected)?.label ?? 'Painel'}
          username={userProfile?.username}
          roleLabel={roleLabel}
          theme={themeMode}
          mobileMenuOpen={isMobileMenuOpen}
          mobileMenuButtonRef={mobileMenuTriggerRef}
          onToggleMobileMenu={() => setIsMobileMenuOpen((current) => !current)}
          onNavigateHome={() => onTabChange(canView('dashboard') ? 'dashboard' : activeTab)}
          onToggleTheme={toggleThemeMode}
          searchAction={
            <Button variant="secondary" size="sm" className="kds-workspace-search-trigger" aria-label="Buscar no painel" aria-keyshortcuts="Control+K Meta+K" onClick={() => setSearchOpen(true)}>
              <Search className="kds-control-icon" aria-hidden="true" /><span>O que você procura?</span><kbd>Ctrl K</kbd>
            </Button>
          }
          notificationsAction={
            <IconButton variant="ghost" size="sm" className="kds-workspace-notification-trigger" aria-label="Notificações" onClick={() => setShowNotificationsDropdown(true)}>
              <Bell aria-hidden="true" />{(unreadReminders > 0 || hasActiveNotification) && <i aria-hidden="true" />}
            </IconButton>
          }
          createAction={creationActions.length > 0 && (
            <Popover open={createOpen} onOpenChange={setCreateOpen}>
              <PopoverTrigger><IconButton variant="ghost" size="sm" className="kds-workspace-create-trigger" aria-label="Criar registro" aria-expanded={createOpen}><Plus aria-hidden="true" /></IconButton></PopoverTrigger>
              <PopoverContent align="end" className="kds-workspace-action-menu" aria-label="Criar registro">
                {creationActions.map(({ path, label, icon: Icon }) => <DropdownOption key={path} role="button" onClick={() => {
                  setCreateOpen(false);
                  navigate('/painel/' + path + '?criar=1');
                }}><Icon className="kds-control-icon" aria-hidden="true" />{label}</DropdownOption>)}
              </PopoverContent>
            </Popover>
          )}
          accountAction={
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger>
                <Button variant="ghost" size="sm" className="kds-workspace-account-trigger" aria-label="Menu da conta" aria-expanded={accountOpen}>
                  <Avatar name={userProfile?.username ?? 'Conta conectada'} size="sm" tone="brand" />
                  <span className="kds-workspace-username">{userProfile?.username ?? 'Conta conectada'}{roleLabel && <small>{roleLabel}</small>}</span>
                  <ChevronDown className="kds-control-icon" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="kds-workspace-action-menu" aria-label="Menu da conta">
                <DropdownOption role="button" onClick={() => { setAccountOpen(false); setProfileOpen(true); }}><User className="kds-control-icon" aria-hidden="true" />Minha conta</DropdownOption>
                <DropdownOption role="button" onClick={() => { setAccountOpen(false); setSignOutOpen(true); }}><LogOut className="kds-control-icon" aria-hidden="true" />Sair do painel</DropdownOption>
              </PopoverContent>
            </Popover>
          }
        />
        <main ref={mainRef} id="painel-conteudo" className={`terracota-main flex min-h-0 flex-1 flex-col ${useFullBleedContent ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div
            ref={panelContentRef}
            className={`terracota-panel-content ${
              useFullBleedContent
                ? 'w-full h-full min-h-0'
                : 'w-full terracota-page-content'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </DesignSystemProvider>
  );
}
