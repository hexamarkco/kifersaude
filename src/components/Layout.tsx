import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  Users,
  FileText,
  LayoutDashboard,
  BellRing,
  Moon,
  LogOut,
  Settings,
  MessageCircle,
  Sun,
  ChevronDown,
  Briefcase,
  BookOpen,
  PiggyBank,
  DollarSign,
  Calendar,
  Send,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase, Reminder, Contract } from '../lib/supabase';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { getContractBonusSummary } from '../lib/contractBonus';
import { getCommissionInstallmentSummary } from '../lib/contractCommission';
import { cx } from '../lib/cx';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useNavigate } from 'react-router-dom';
import type { TabNavigationOptions } from '../types/navigation';
import { usePanelMotion } from '../hooks/usePanelMotion';
import { CONFIG_MODULE_IDS } from '../lib/accessControl';

type TabConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  children?: TabConfig[];
};

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  useFullBleedContent?: boolean;
  onTabChange: (tab: string, options?: TabNavigationOptions) => void;
  unreadReminders: number;
  unreadInboxChats?: number;
  hasActiveNotification?: boolean;
  newLeadsCount?: number;
};

type ThemeMode = 'light' | 'dark';

const PANEL_THEME_STORAGE_KEY = 'painel.theme.v2';

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(PANEL_THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return 'light';
};

export default function Layout({
  children,
  activeTab,
  useFullBleedContent = false,
  onTabChange,
  unreadReminders,
  unreadInboxChats = 0,
  hasActiveNotification,
  newLeadsCount = 0,
}: LayoutProps) {
  const { signOut, role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const navigate = useNavigate();
  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('painel.sidebar.collapsed');
    return stored === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
  const [todayPayments, setTodayPayments] = useState<{
    id: string;
    type: 'comissao' | 'bonificacao';
    value: number;
    contract: Contract;
    installmentLabel?: string;
  }[]>([]);
  const [todayBirthdays, setTodayBirthdays] = useState<{
    id: string;
    name: string;
    role: 'Titular' | 'Dependente';
    contract?: Contract | null;
    holderName?: string | null;
  }[]>([]);
  const notificationsDropdownRef = useRef<HTMLDivElement | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const collapsedDropdownRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const themeSwitchFrameRef = useRef<number | null>(null);
  const [activeDropdownTab, setActiveDropdownTab] = useState<string | null>(null);
  const [collapsedDropdownPosition, setCollapsedDropdownPosition] = useState<{
    left: number;
    top: number;
    side: 'right' | 'left';
    caretTop: number;
  } | null>(null);
  const {
    motionEnabled,
    enterDuration,
    sectionStagger,
    microDuration,
    revealDistance,
    ease,
  } = usePanelMotion();
  const isSidebarCollapsed = isMenuCollapsed && !isMobileMenuOpen;
  const currentRole = role;

  const canView = (moduleId: string) => getRoleModulePermission(currentRole, moduleId).can_view;

  const crmChildren: TabConfig[] = [
    { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount },
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'agenda', label: 'Agenda', icon: Calendar, badge: unreadReminders },
  ].filter(child => canView(child.id));

  const comunicacaoChildren: TabConfig[] = [
    { id: 'whatsapp-inbox', label: 'Inbox', icon: MessageCircle, badge: unreadInboxChats },
    { id: 'whatsapp-campaigns', label: 'Disparos', icon: Send },
    { id: 'blog', label: 'Blog', icon: BookOpen },
  ].filter(child => canView(child.id));

  const financeiroChildren: TabConfig[] = [
    { id: 'financeiro-comissoes', label: 'Comissões', icon: DollarSign },
  ].filter(child => canView(child.id));

  const baseTabs: TabConfig[] = [];

  if (canView('dashboard')) {
    baseTabs.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
  }

  if (crmChildren.length > 0) {
    baseTabs.push({ id: 'crm', label: 'CRM', icon: Briefcase, children: crmChildren });
  }

  if (comunicacaoChildren.length > 0) {
    baseTabs.push({ id: 'comunicacao', label: 'Comunicação', icon: MessageCircle, children: comunicacaoChildren });
  }

  if (financeiroChildren.length > 0) {
    baseTabs.push({ id: 'financeiro', label: 'Financeiro', icon: PiggyBank, children: financeiroChildren });
  }

  const canViewConfig = canView('config') || CONFIG_MODULE_IDS.some((moduleId) => canView(moduleId));

  const tabs = canViewConfig
    ? [...baseTabs, { id: 'config', label: 'Configurações', icon: Settings }]
    : baseTabs;

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
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const todayKey = getDateKey(startOfDay);

      const [{ data: remindersData, error: remindersError }, { data: contractsData, error: contractsError }]
        = await Promise.all([
          supabase
            .from('reminders')
            .select('*')
            .gte('data_lembrete', startOfDay.toISOString())
            .lte('data_lembrete', endOfDay.toISOString())
            .eq('lido', false)
            .order('data_lembrete', { ascending: true }),
          supabase
            .from('contracts')
            .select('*')
            .eq('status', 'Ativo'),
        ]);

      if (remindersError) throw remindersError;
      if (contractsError) throw contractsError;

      const activeContracts = contractsData || [];

      const { data: holdersData, error: holdersError } = await supabase
        .from('contract_holders')
        .select('id, contract_id, nome_completo, razao_social, nome_fantasia, data_nascimento');

      if (holdersError) throw holdersError;

      const { data: dependentsData, error: dependentsError } = await supabase
        .from('dependents')
        .select('id, contract_id, nome_completo, data_nascimento');

      if (dependentsError) throw dependentsError;

      const activeContractIds = new Set(activeContracts.map((contract) => contract.id));
      const holders = (holdersData || []).filter((holder) => activeContractIds.has(holder.contract_id));
      const dependents = (dependentsData || []).filter((dependent) => activeContractIds.has(dependent.contract_id));
      const holderByContractId = new Map(holders.map((holder) => [holder.contract_id, holder]));

      const payments: {
        id: string;
        type: 'comissao' | 'bonificacao';
        value: number;
        contract: Contract;
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
        contract?: Contract | null;
        holderName?: string | null;
      }[] = [];

      holders.forEach((holder) => {
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

      dependents.forEach((dependent) => {
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

      setTodayReminders(remindersForToday);
      setTodayPayments(payments);
      setTodayBirthdays(birthdays);
    } catch (error) {
      console.error('Erro ao carregar central de notificações:', error);
      setNotificationsError('Não foi possível carregar o resumo do dia.');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const handleTabClick = (tab: TabConfig, triggerElement?: HTMLButtonElement | null) => {
    if (tab.children && tab.children.length > 0) {
      if (isSidebarCollapsed) {
        if (activeDropdownTab === tab.id) {
          setActiveDropdownTab(null);
          setCollapsedDropdownPosition(null);
          return;
        }

        setActiveDropdownTab(tab.id);
        if (triggerElement) {
          const triggerRect = triggerElement.getBoundingClientRect();
          const viewportPadding = 8;
          const sideOffset = 8;
          const dropdownWidth = collapsedDropdownRef.current?.offsetWidth ?? 220;
          const dropdownHeight = collapsedDropdownRef.current?.offsetHeight ?? 220;

          let left = triggerRect.right + sideOffset;
          let side: 'right' | 'left' = 'right';
          if (left + dropdownWidth > window.innerWidth - viewportPadding) {
            left = Math.max(viewportPadding, triggerRect.left - dropdownWidth - sideOffset);
            side = 'left';
          }

          const top = Math.max(viewportPadding, triggerRect.top);

          const triggerCenterY = triggerRect.top + triggerRect.height / 2;
          const caretTop = Math.max(12, Math.min(triggerCenterY - top, dropdownHeight - 12));

          setCollapsedDropdownPosition({ left, top, side, caretTop });
        }
      } else {
        setExpandedParent(expandedParent === tab.id ? null : tab.id);
      }
    } else {
      onTabChange(tab.id);
      setExpandedParent(null);
      setActiveDropdownTab(null);
      setIsMobileMenuOpen(false);
    }
  };

  const isParentActive = (tab: TabConfig) => {
    if (tab.id === activeTab) return true;
    if (tab.children) {
      return tab.children.some(child => child.id === activeTab);
    }
    return false;
  };

  const getTotalBadge = (tab: TabConfig): number => {
    if (!tab.children) return tab.badge || 0;
    return tab.children.reduce((sum, child) => sum + (child.badge || 0), 0);
  };

  const updateCollapsedDropdownPosition = useCallback(() => {
    if (!isSidebarCollapsed || !activeDropdownTab) {
      setCollapsedDropdownPosition(null);
      return;
    }

    const triggerElement = menuItemRefs.current[activeDropdownTab];
    if (!triggerElement) {
      setCollapsedDropdownPosition(null);
      return;
    }

    const triggerRect = triggerElement.getBoundingClientRect();
    const viewportPadding = 8;
    const sideOffset = 8;
    const dropdownWidth = collapsedDropdownRef.current?.offsetWidth ?? 220;
    const dropdownHeight = collapsedDropdownRef.current?.offsetHeight ?? 220;

    let left = triggerRect.right + sideOffset;
    let side: 'right' | 'left' = 'right';
    if (left + dropdownWidth > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, triggerRect.left - dropdownWidth - sideOffset);
      side = 'left';
    }

    const top = Math.max(viewportPadding, triggerRect.top);

    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const caretTop = Math.max(12, Math.min(triggerCenterY - top, dropdownHeight - 12));

    setCollapsedDropdownPosition({ left, top, side, caretTop });
  }, [activeDropdownTab, isSidebarCollapsed]);

  useEffect(() => {
    if (!showNotificationsDropdown) {
      return;
    }

    loadNotificationsSummary();
    const interval = setInterval(loadNotificationsSummary, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [loadNotificationsSummary, showNotificationsDropdown]);

  useEffect(() => {
    if (!showNotificationsDropdown) {
      return;
    }

    const remindersChannel = supabase
      .channel('notifications-reminders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        () => {
          loadNotificationsSummary();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(remindersChannel);
    };
  }, [loadNotificationsSummary, showNotificationsDropdown]);

  useEffect(() => {
    if (!showNotificationsDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationsDropdownRef.current &&
        notificationsDropdownRef.current.contains(target)
      ) {
        return;
      }
      if (notificationsButtonRef.current && notificationsButtonRef.current.contains(target)) {
        return;
      }
      setShowNotificationsDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationsDropdown]);

  useEffect(() => {
    if (!activeDropdownTab) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const button = menuItemRefs.current[activeDropdownTab];
      if (button && button.contains(target)) {
        return;
      }
      if (collapsedDropdownRef.current && collapsedDropdownRef.current.contains(target)) {
        return;
      }
      setActiveDropdownTab(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdownTab]);

  useEffect(() => {
    if (!isSidebarCollapsed) {
      setActiveDropdownTab(null);
      setCollapsedDropdownPosition(null);
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const closeMobileMenuOnDesktop = () => {
      if (!mobileQuery.matches) {
        setIsMobileMenuOpen(false);
      }
    };

    closeMobileMenuOnDesktop();
    mobileQuery.addEventListener('change', closeMobileMenuOnDesktop);

    return () => {
      mobileQuery.removeEventListener('change', closeMobileMenuOnDesktop);
    };
  }, []);

  useEffect(() => {
    if (!activeDropdownTab || !isSidebarCollapsed) {
      setCollapsedDropdownPosition(null);
      return;
    }

    const syncPosition = () => {
      updateCollapsedDropdownPosition();
    };

    syncPosition();
    const rafId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [activeDropdownTab, isSidebarCollapsed, updateCollapsedDropdownPosition]);

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

  useEffect(() => {
    const sidebarElement = sidebarRef.current;
    if (!sidebarElement) {
      return;
    }

    const items = Array.from(sidebarElement.querySelectorAll<HTMLElement>('[data-sidebar-item]'));
    if (items.length === 0) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(items, {
        autoAlpha: 1,
        x: 0,
        clearProps: 'transform,opacity,willChange',
      });
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        items,
        {
          autoAlpha: 0,
          x: -Math.max(6, Math.round(revealDistance * 0.55)),
          willChange: 'transform,opacity',
        },
        {
          autoAlpha: 1,
          x: 0,
          duration: Math.max(microDuration + 0.08, 0.24),
          ease: 'power2.out',
          stagger: Math.max(0.014, sectionStagger * 0.4),
          overwrite: 'auto',
          clearProps: 'transform,opacity,willChange',
          force3D: true,
        },
      );
    }, sidebarElement);

    return () => {
      context.revert();
    };
  }, [isSidebarCollapsed, microDuration, motionEnabled, revealDistance, sectionStagger, tabs.length]);

  useEffect(() => {
    if (!showNotificationsDropdown || !notificationsDropdownRef.current || !motionEnabled) {
      return;
    }

    const animation = gsap.fromTo(
      notificationsDropdownRef.current,
      {
        autoAlpha: 0,
        y: isSidebarCollapsed ? 12 : 8,
        scale: 0.985,
        transformOrigin: 'left bottom',
      },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: Math.max(microDuration + 0.08, 0.24),
        ease: 'power2.out',
        overwrite: 'auto',
        force3D: true,
      },
    );

    return () => {
      animation.kill();
    };
  }, [isSidebarCollapsed, microDuration, motionEnabled, showNotificationsDropdown]);

  useEffect(() => {
    if (!activeDropdownTab || !motionEnabled || (isSidebarCollapsed && !collapsedDropdownPosition)) {
      return;
    }

    const dropdown = collapsedDropdownRef.current;
    if (!dropdown) {
      return;
    }

    const fromX = isSidebarCollapsed && collapsedDropdownPosition?.side === 'left' ? 6 : -6;

    const animation = gsap.fromTo(
      dropdown,
      {
        autoAlpha: 0,
        x: fromX,
        y: 6,
        scale: 0.98,
      },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: microDuration,
        ease: 'power2.out',
        overwrite: 'auto',
        force3D: true,
      },
    );

    return () => {
      animation.kill();
    };
  }, [activeDropdownTab, collapsedDropdownPosition, isSidebarCollapsed, microDuration, motionEnabled]);

  const toggleThemeMode = () => {
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

    setThemeMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
  };

  const renderSidebarBadge = (count: number, options: { floating?: boolean; pulse?: boolean } = {}) => (
    <span className={cx('kds-sidebar-badge', options.floating && 'absolute -right-1 -top-1', options.pulse && 'animate-pulse')}>
      {count > 9 ? '9+' : count}
    </span>
  );

  const renderSidebarItem = (tab: TabConfig) => {
    const Icon = tab.icon;
    const isActive = isParentActive(tab);
    const isExpanded = isSidebarCollapsed ? activeDropdownTab === tab.id : expandedParent === tab.id;
    const totalBadge = getTotalBadge(tab);

    if (tab.children && tab.children.length > 0) {
      return (
        <div key={tab.id} className="flex flex-col relative">
          <button
            ref={(el) => { menuItemRefs.current[tab.id] = el; }}
            onClick={(event) => handleTabClick(tab, event.currentTarget)}
            data-sidebar-item
            className={cx(
              'kds-sidebar-item relative flex w-full items-center rounded-lg py-2.5 text-left text-sm font-medium transition-all duration-200',
              isActive && 'is-active',
              isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3',
            )}
            title={isSidebarCollapsed ? tab.label : undefined}
          >
            <div className={`flex items-center transition-all duration-200 ${isSidebarCollapsed ? 'w-full justify-center gap-0' : 'gap-3'}`}>
              <div className="relative flex h-5 w-5 items-center justify-center">
                <Icon className="h-5 w-5 flex-shrink-0" />
                {totalBadge > 0 && isSidebarCollapsed && (
                  renderSidebarBadge(totalBadge, {
                    floating: true,
                    pulse:
                      Boolean(hasActiveNotification && (tab.id === 'crm' || activeTab === 'agenda')) ||
                      Boolean((tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0),
                  })
                )}
              </div>
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{tab.label}</span>
            </div>
            {!isSidebarCollapsed && (
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            )}
            {totalBadge > 0 && !isSidebarCollapsed && (
              renderSidebarBadge(totalBadge, {
                floating: true,
                pulse:
                  Boolean(hasActiveNotification && (tab.id === 'crm' || activeTab === 'agenda')) ||
                  Boolean((tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0),
              })
            )}
          </button>

          {isExpanded && !isSidebarCollapsed && (
            <div className="mt-1 space-y-1 pl-4">
              {tab.children.map((child) => {
                const ChildIcon = child.icon;
                const isChildActive = activeTab === child.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => {
                      onTabChange(child.id);
                      setExpandedParent(null);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cx(
                      'kds-sidebar-item flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                      isChildActive && 'is-active',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ChildIcon className="h-4 w-4" />
                      <span>{child.label}</span>
                    </div>
                    {child.badge !== undefined && child.badge > 0 && (
                      renderSidebarBadge(child.badge, {
                        pulse:
                          Boolean(child.id === 'agenda' && hasActiveNotification) ||
                          Boolean((child.id === 'leads' || child.id === 'whatsapp-inbox') && child.badge > 0),
                      })
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={tab.id}
        onClick={() => handleTabClick(tab)}
        data-sidebar-item
        className={cx(
          'kds-sidebar-item relative flex w-full items-center rounded-lg py-2.5 text-left text-sm font-medium transition-colors',
          isActive && 'is-active',
          isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3',
        )}
        title={isSidebarCollapsed ? tab.label : undefined}
      >
        <div className={`flex items-center transition-all duration-200 ${isSidebarCollapsed ? 'w-full justify-center gap-0' : 'gap-3'}`}>
          <Icon className="h-5 w-5 flex-shrink-0" />
          <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{tab.label}</span>
        </div>
        {totalBadge > 0 && !isSidebarCollapsed && (
          renderSidebarBadge(totalBadge, {
            pulse:
              Boolean(hasActiveNotification && (tab.id === 'crm' || activeTab === 'agenda')) ||
              Boolean((tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0),
          })
        )}
      </button>
    );
  };

  const activeCollapsedParentTab =
    isSidebarCollapsed && activeDropdownTab
      ? tabs.find((tab) => tab.id === activeDropdownTab && tab.children && tab.children.length > 0)
      : undefined;

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const menu = sidebarRef.current;
    const menuTrigger = mobileMenuTriggerRef.current;
    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(menu?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
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
      document.removeEventListener('keydown', handleKeyDown);
      menuTrigger?.focus();
    };
  }, [isMobileMenuOpen]);

  return (
    <div
      className={`painel-theme kifer-ds kifer-panel-theme kds-app-shell terracota-shell theme-${themeMode} relative isolate flex min-h-screen`}
    >
      <button
        ref={mobileMenuTriggerRef}
        type="button"
        className="terracota-mobile-menu-trigger"
        onClick={() => setIsMobileMenuOpen((current) => !current)}
        aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="painel-navigation"
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {isMobileMenuOpen && (
        <button
          type="button"
          className="terracota-mobile-menu-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside
        ref={sidebarRef}
        id="painel-navigation"
        className={`kds-sidebar terracota-sidebar fixed left-0 top-0 z-40 h-screen border-r transition-[width] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } ${
          isMobileMenuOpen ? 'is-mobile-open' : ''
        }`}
      >
        <div className="flex h-full flex-col">
          <div className={`kds-sidebar-divider terracota-sidebar-header flex h-16 items-center border-b px-4 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              <div className="kds-brand-mark flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
                <span className="text-base font-bold text-[color:var(--text-on-brand)]">K</span>
              </div>
              <span className="whitespace-nowrap text-sm font-semibold text-[color:var(--text-on-brand)]">Kifer Saúde</span>
            </div>
            {isSidebarCollapsed && (
              <div className="kds-brand-mark flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
                <span className="text-base font-bold text-[color:var(--text-on-brand)]">K</span>
              </div>
            )}
          </div>

          <nav className={`terracota-sidebar-navigation flex-1 overflow-y-auto overflow-x-hidden py-2 transition-all duration-300 ${isSidebarCollapsed ? 'px-1' : 'px-2'}`}>
            <div className="space-y-1">
              {tabs.map((tab) => renderSidebarItem(tab))}
            </div>
          </nav>

          <div className={`kds-sidebar-divider terracota-sidebar-footer space-y-1 border-t p-2 ${isSidebarCollapsed ? 'px-1' : ''}`}>
            <button
              onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
              data-sidebar-item
              className={`terracota-sidebar-collapse-toggle kds-sidebar-item flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                isSidebarCollapsed ? 'justify-center px-2 gap-0' : 'gap-3 px-3'
              }`}
              title={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{isSidebarCollapsed ? 'Expandir' : 'Recolher'}</span>
            </button>
            <div className="relative">
              <button
                ref={notificationsButtonRef}
                onClick={() => setShowNotificationsDropdown((current) => !current)}
                data-sidebar-item
                className={`kds-sidebar-item flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                  isSidebarCollapsed ? 'w-full justify-center px-2 gap-0' : 'gap-3 px-3'
                }`}
                title="Notificações"
                aria-expanded={showNotificationsDropdown}
                aria-haspopup="true"
              >
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <BellRing className="h-5 w-5" />
                  {unreadReminders > 0 && (
                      renderSidebarBadge(unreadReminders, {
                        floating: true,
                        pulse: Boolean(hasActiveNotification),
                      })
                    )}
                  </div>
                  <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>Notificações</span>
                </button>
                {showNotificationsDropdown && (
                  <div
                    ref={notificationsDropdownRef}
                    className={`terracota-sidebar-popover absolute z-50 w-96 rounded-2xl border shadow-xl ${
                      isSidebarCollapsed
                        ? 'left-full bottom-0 ml-2 max-w-[calc(100vw-5rem)]'
                        : 'left-0 bottom-full mb-2 max-w-[calc(100vw-1rem)]'
                    }`}
                  >
                    <div className="kds-popover-section flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Central do dia</p>
                        <p className="text-xs text-[var(--text-muted)]">Resumo de hoje</p>
                      </div>
                      <button
                        onClick={() => {
                          onTabChange('agenda');
                          setShowNotificationsDropdown(false);
                          setIsMobileMenuOpen(false);
                        }}
                        className="text-xs font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]"
                      >
                        Ver tudo
                      </button>
                    </div>

                    {notificationsLoading ? (
                      <div className="px-4 py-6 text-sm text-[var(--text-muted)]">Carregando...</div>
                    ) : notificationsError ? (
                      <div className="px-4 py-6 text-sm text-[var(--danger-text)]">{notificationsError}</div>
                    ) : (
                      <div className="max-h-[70vh] overflow-y-auto">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Lembretes do dia</p>
                            <span className="text-xs text-[var(--text-muted)]">{todayReminders.length}</span>
                          </div>
                          {todayReminders.length === 0 ? (
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum lembrete para hoje.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {todayReminders.slice(0, 5).map((reminder) => (
                                <div key={reminder.id} className="kds-list-item">
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">{reminder.titulo}</p>
                                  <p className="text-xs text-[var(--text-muted)]">{formatDateTimeFullBR(reminder.data_lembrete)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="kds-popover-section border-t px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Pagamentos do dia</p>
                            <span className="text-xs text-[var(--text-muted)]">{todayPayments.length}</span>
                          </div>
                          {todayPayments.length === 0 ? (
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum pagamento previsto para hoje.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {todayPayments.slice(0, 5).map((payment) => (
                                <div key={payment.id} className="kds-list-item kds-list-item-success">
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                                    {payment.type === 'comissao' ? 'Comissão' : 'Bonificação'}
                                    {payment.installmentLabel ? ` (${payment.installmentLabel})` : ''}
                                  </p>
                                  <p className="text-xs text-[var(--text-secondary)]">{payment.contract.codigo_contrato} • {formatCurrency(payment.value)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="kds-popover-section border-t px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Aniversariantes</p>
                            <span className="text-xs text-[var(--text-muted)]">{todayBirthdays.length}</span>
                          </div>
                          {todayBirthdays.length === 0 ? (
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum aniversariante hoje.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {todayBirthdays.slice(0, 5).map((birthday) => (
                                <div key={birthday.id} className="kds-list-item kds-list-item-warning">
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">{birthday.name}</p>
                                  <p className="text-xs text-[var(--text-secondary)]">
                                    {birthday.role}
                                    {birthday.holderName ? ` • Titular: ${birthday.holderName}` : ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            <button
              type="button"
              onClick={toggleThemeMode}
              data-sidebar-item
              className={`kds-sidebar-item flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                isSidebarCollapsed ? 'justify-center px-2 gap-0' : 'gap-3 px-3'
              }`}
              title={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              aria-label={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{themeMode === 'dark' ? 'Claro' : 'Escuro'}</span>
            </button>
            <button
              onClick={handleLogout}
              data-sidebar-item
              className={`kds-sidebar-item kds-sidebar-item-danger flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                isSidebarCollapsed ? 'justify-center px-2 gap-0' : 'gap-3 px-3'
              }`}
              title={isSidebarCollapsed ? 'Sair' : undefined}
            >
              <LogOut className="h-5 w-5" />
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {activeCollapsedParentTab?.children && collapsedDropdownPosition && (
        <div
          id="collapsed-menu-dropdown"
          ref={collapsedDropdownRef}
          className="terracota-sidebar-popover fixed z-[60] w-max min-w-[172px] max-w-[240px] overflow-y-auto rounded-lg border p-1.5 shadow-2xl"
          style={{
            left: collapsedDropdownPosition.left,
            top: collapsedDropdownPosition.top,
          }}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute h-3 w-3 rotate-45 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ${
              collapsedDropdownPosition.side === 'right'
                ? '-left-1.5 border-b-0 border-r-0'
                : '-right-1.5 border-l-0 border-t-0'
            }`}
            style={{ top: collapsedDropdownPosition.caretTop - 6 }}
          />
          <div className="space-y-0.5">
            {activeCollapsedParentTab.children.map((child) => {
              const ChildIcon = child.icon;
              const isChildActive = activeTab === child.id;

              return (
                <button
                  key={child.id}
                  onClick={() => {
                    onTabChange(child.id);
                    setActiveDropdownTab(null);
                    setCollapsedDropdownPosition(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cx(
                    'kds-sidebar-item flex min-w-[156px] items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                    isChildActive && 'is-active',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <ChildIcon className="h-4 w-4" />
                    <span>{child.label}</span>
                  </div>
                  {child.badge !== undefined && child.badge > 0 && (
                    renderSidebarBadge(child.badge, {
                      pulse:
                        Boolean(child.id === 'agenda' && hasActiveNotification) ||
                        Boolean((child.id === 'leads' || child.id === 'whatsapp-inbox') && child.badge > 0),
                    })
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`terracota-content-shell relative z-10 flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-64'} ${useFullBleedContent ? 'is-full-bleed' : ''}`}>
        <main className={`terracota-main flex-1 min-h-0 ${useFullBleedContent ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div
            ref={panelContentRef}
            className={`terracota-panel-content ${
              useFullBleedContent
                ? 'w-full h-[calc(100vh)] min-h-0'
                : 'w-full py-8 px-2 sm:px-3 lg:px-4'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
