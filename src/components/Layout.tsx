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
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { supabase, Reminder, Contract } from '../lib/supabase';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useNavigate } from 'react-router-dom';
import type { TabNavigationOptions } from '../types/navigation';
import { usePanelMotion } from '../hooks/usePanelMotion';

type TabConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeColor?: string;
  children?: TabConfig[];
};

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string, options?: TabNavigationOptions) => void;
  unreadReminders: number;
  hasActiveNotification?: boolean;
  newLeadsCount?: number;
};

type ThemeMode = 'light' | 'dark';

const PANEL_THEME_STORAGE_KEY = 'painel.theme.v1';

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(PANEL_THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function Layout({
  children,
  activeTab,
  onTabChange,
  unreadReminders,
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
  const auroraPrimaryRef = useRef<HTMLDivElement | null>(null);
  const auroraSecondaryRef = useRef<HTMLDivElement | null>(null);
  const auroraTertiaryRef = useRef<HTMLDivElement | null>(null);
  const [activeDropdownTab, setActiveDropdownTab] = useState<string | null>(null);
  const [collapsedDropdownPosition, setCollapsedDropdownPosition] = useState<{
    left: number;
    top: number;
    side: 'right' | 'left';
    caretTop: number;
  } | null>(null);
  const { motionEnabled, enterDuration, sectionStagger, ease } = usePanelMotion();
  const currentRole = role;

  const canView = (moduleId: string) => getRoleModulePermission(currentRole, moduleId).can_view;

  const crmChildren = [
    { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount, badgeColor: 'bg-orange-500' },
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'financeiro-agenda', label: 'Tarefas', icon: Calendar },
    { id: 'reminders', label: 'Lembretes', icon: BellRing, badge: unreadReminders },
  ].filter(child => canView(child.id));

  const comunicacaoChildren = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'blog', label: 'Blog', icon: BookOpen },
  ].filter(child => canView(child.id));

  const financeiroChildren = [
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

  const tabs = canView('config')
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
          const customInstallments: { percentual: number; data_pagamento: string | null }[] = Array.isArray(
            contract.comissao_parcelas
          )
            ? (contract.comissao_parcelas as { percentual: number; data_pagamento: string | null }[])
            : [];

          if (!isUpfront && customInstallments.length > 0) {
            const totalPercentual = customInstallments.reduce(
              (sum, parcel) => sum + (parcel.percentual || 0),
              0
            );

            customInstallments.forEach((parcel, index) => {
              const parcelDate = toDate(parcel.data_pagamento) || commissionDate;
              const parcelValue =
                totalPercentual > 0
                  ? roundCurrency((totalCommission * (parcel.percentual || 0)) / totalPercentual)
                  : roundCurrency(totalCommission);

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
        if (bonusDate && contract.bonus_por_vida_valor && getDateKey(bonusDate) === todayKey) {
          const vidas = contract.vidas_elegiveis_bonus ?? contract.vidas ?? 1;
          const totalBonus = contract.bonus_por_vida_aplicado
            ? contract.bonus_por_vida_valor * vidas
            : contract.bonus_por_vida_valor;
          payments.push({
            id: `${contract.id}-bonus`,
            type: 'bonificacao',
            value: totalBonus,
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
      if (isMenuCollapsed) {
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
          const dropdownWidth = 224;
          const dropdownHeight = collapsedDropdownRef.current?.offsetHeight ?? 260;

          let left = triggerRect.right + sideOffset;
          let side: 'right' | 'left' = 'right';
          if (left + dropdownWidth > window.innerWidth - viewportPadding) {
            left = Math.max(viewportPadding, triggerRect.left - dropdownWidth - sideOffset);
            side = 'left';
          }

          let top = triggerRect.top;
          if (top + dropdownHeight > window.innerHeight - viewportPadding) {
            top = Math.max(viewportPadding, window.innerHeight - dropdownHeight - viewportPadding);
          }

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
    if (!isMenuCollapsed || !activeDropdownTab) {
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
    const dropdownWidth = 224;
    const dropdownHeight = collapsedDropdownRef.current?.offsetHeight ?? 260;

    let left = triggerRect.right + sideOffset;
    let side: 'right' | 'left' = 'right';
    if (left + dropdownWidth > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, triggerRect.left - dropdownWidth - sideOffset);
      side = 'left';
    }

    let top = triggerRect.top;
    if (top + dropdownHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, window.innerHeight - dropdownHeight - viewportPadding);
    }

    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const caretTop = Math.max(12, Math.min(triggerCenterY - top, dropdownHeight - 12));

    setCollapsedDropdownPosition({ left, top, side, caretTop });
  }, [activeDropdownTab, isMenuCollapsed]);

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
    if (!isMenuCollapsed) {
      setActiveDropdownTab(null);
      setCollapsedDropdownPosition(null);
    }
  }, [isMenuCollapsed]);

  useEffect(() => {
    if (!activeDropdownTab || !isMenuCollapsed) {
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
  }, [activeDropdownTab, isMenuCollapsed, updateCollapsedDropdownPosition]);

  useEffect(() => {
    localStorage.setItem('painel.sidebar.collapsed', String(isMenuCollapsed));
  }, [isMenuCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const panelContent = panelContentRef.current;
    if (!panelContent) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(panelContent, {
        autoAlpha: 1,
        y: 0,
        clearProps: 'filter,transform,opacity',
      });
      return;
    }

    const animation = gsap.fromTo(
      panelContent,
      {
        autoAlpha: 0,
        y: 18,
        filter: 'blur(10px)',
      },
      {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: enterDuration,
        ease,
        clearProps: 'filter',
        overwrite: 'auto',
      },
    );

    return () => {
      animation.kill();
    };
  }, [activeTab, ease, enterDuration, motionEnabled]);

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
        clearProps: 'transform,opacity',
      });
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        items,
        {
          autoAlpha: 0,
          x: -12,
        },
        {
          autoAlpha: 1,
          x: 0,
          duration: 0.46,
          ease: 'power2.out',
          stagger: Math.max(0.025, sectionStagger * 0.45),
          overwrite: 'auto',
        },
      );
    }, sidebarElement);

    return () => {
      context.revert();
    };
  }, [isMenuCollapsed, motionEnabled, sectionStagger, tabs.length]);

  useEffect(() => {
    const primary = auroraPrimaryRef.current;
    const secondary = auroraSecondaryRef.current;
    const tertiary = auroraTertiaryRef.current;

    if (!primary || !secondary || !tertiary) {
      return;
    }

    if (!motionEnabled) {
      gsap.set([primary, secondary, tertiary], { clearProps: 'transform' });
      return;
    }

    const animations = [
      gsap.to(primary, {
        xPercent: 8,
        yPercent: -5,
        scale: 1.06,
        duration: 18,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }),
      gsap.to(secondary, {
        xPercent: -7,
        yPercent: 7,
        scale: 0.94,
        duration: 21,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }),
      gsap.to(tertiary, {
        xPercent: 5,
        yPercent: 4,
        scale: 1.08,
        duration: 24,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }),
    ];

    return () => {
      animations.forEach((animation) => animation.kill());
    };
  }, [motionEnabled]);

  useEffect(() => {
    if (!showNotificationsDropdown || !notificationsDropdownRef.current || !motionEnabled) {
      return;
    }

    const animation = gsap.fromTo(
      notificationsDropdownRef.current,
      {
        autoAlpha: 0,
        y: isMenuCollapsed ? 12 : 8,
        scale: 0.985,
        transformOrigin: 'left bottom',
      },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.32,
        ease: 'power2.out',
      },
    );

    return () => {
      animation.kill();
    };
  }, [isMenuCollapsed, motionEnabled, showNotificationsDropdown]);

  useEffect(() => {
    if (!activeDropdownTab || !motionEnabled || (isMenuCollapsed && !collapsedDropdownPosition)) {
      return;
    }

    const dropdown = collapsedDropdownRef.current;
    if (!dropdown) {
      return;
    }

    const fromX = isMenuCollapsed && collapsedDropdownPosition?.side === 'left' ? 6 : -6;

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
        duration: 0.24,
        ease: 'power2.out',
      },
    );

    return () => {
      animation.kill();
    };
  }, [activeDropdownTab, collapsedDropdownPosition, isMenuCollapsed, motionEnabled]);

  const toggleThemeMode = () => {
    setThemeMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
  };

  const renderSidebarItem = (tab: TabConfig) => {
    const Icon = tab.icon;
    const isActive = isParentActive(tab);
    const isExpanded = isMenuCollapsed ? activeDropdownTab === tab.id : expandedParent === tab.id;
    const totalBadge = getTotalBadge(tab);

    if (tab.children && tab.children.length > 0) {
      return (
        <div key={tab.id} className="flex flex-col relative">
          <button
            ref={(el) => { menuItemRefs.current[tab.id] = el; }}
            onClick={(event) => handleTabClick(tab, event.currentTarget)}
            data-sidebar-item
            className={`relative flex w-full items-center rounded-lg py-2.5 text-left text-sm font-medium transition-all duration-200 ${
              isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
            } ${isMenuCollapsed ? 'justify-center px-2' : 'justify-between px-3'}`}
            title={isMenuCollapsed ? tab.label : undefined}
          >
            <div className={`flex items-center transition-all duration-200 ${isMenuCollapsed ? 'w-full justify-center gap-0' : 'gap-3'}`}>
              <div className="relative flex h-5 w-5 items-center justify-center">
                <Icon className="h-5 w-5 flex-shrink-0" />
                {totalBadge > 0 && isMenuCollapsed && (
                  <span
                    className={`${
                      tab.badgeColor || 'bg-orange-500'
                    } absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold text-white ${
                      hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders') ? 'animate-pulse' : ''
                    } ${
                      (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    {totalBadge > 9 ? '9+' : totalBadge}
                  </span>
                )}
              </div>
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isMenuCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{tab.label}</span>
            </div>
            {!isMenuCollapsed && (
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            )}
            {totalBadge > 0 && !isMenuCollapsed && (
              <span
                className={`${
                  tab.badgeColor || 'bg-orange-500'
                } flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold text-white ${
                  hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders') ? 'animate-pulse' : ''
                } ${
                  (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0 ? 'animate-pulse' : ''
                } absolute -right-1 -top-1`}
              >
                {totalBadge > 9 ? '9+' : totalBadge}
              </span>
            )}
          </button>

          {isExpanded && !isMenuCollapsed && (
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
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      isChildActive ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChildIcon className="h-4 w-4" />
                      <span>{child.label}</span>
                    </div>
                    {child.badge !== undefined && child.badge > 0 && (
                      <span
                        className={`${
                          child.badgeColor || 'bg-orange-500'
                        } flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold text-white ${
                          child.id === 'reminders' && hasActiveNotification ? 'animate-pulse' : ''
                        } ${child.id === 'leads' && child.badge > 0 ? 'animate-pulse' : ''}`}
                      >
                        {child.badge > 9 ? '9+' : child.badge}
                      </span>
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
        className={`relative flex w-full items-center rounded-lg py-2.5 text-left text-sm font-medium transition-colors ${
          isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
        } ${isMenuCollapsed ? 'justify-center px-2' : 'justify-between px-3'}`}
        title={isMenuCollapsed ? tab.label : undefined}
      >
        <div className={`flex items-center transition-all duration-200 ${isMenuCollapsed ? 'w-full justify-center gap-0' : 'gap-3'}`}>
          <Icon className="h-5 w-5 flex-shrink-0" />
          <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isMenuCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{tab.label}</span>
        </div>
        {totalBadge > 0 && !isMenuCollapsed && (
          <span
            className={`${
              tab.badgeColor || 'bg-orange-500'
            } flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold text-white ${
              hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders') ? 'animate-pulse' : ''
            } ${
              (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0 ? 'animate-pulse' : ''
            }`}
          >
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>
    );
  };

  const activeCollapsedParentTab =
    isMenuCollapsed && activeDropdownTab
      ? tabs.find((tab) => tab.id === activeDropdownTab && tab.children && tab.children.length > 0)
      : undefined;

  return (
    <div
      className={`painel-theme theme-${themeMode} relative isolate flex min-h-screen bg-slate-50`}
    >
      <div className="panel-shell-bg" aria-hidden="true">
        <div ref={auroraPrimaryRef} className="panel-aurora panel-aurora-primary" />
        <div ref={auroraSecondaryRef} className="panel-aurora panel-aurora-secondary" />
        <div ref={auroraTertiaryRef} className="panel-aurora panel-aurora-tertiary" />
      </div>
      <aside
        ref={sidebarRef}
        className={`panel-glass-strong fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-[width] duration-300 ease-in-out ${
          isMenuCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className={`flex h-16 items-center border-b border-slate-200 px-4 transition-all duration-300 ${isMenuCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 transition-all duration-300 ${isMenuCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <span className="text-base font-bold text-white">K</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">KS Workspace</span>
            </div>
            {isMenuCollapsed && (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <span className="text-base font-bold text-white">K</span>
              </div>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 transition-all duration-300 ${isMenuCollapsed ? 'px-1' : 'px-2'}`}>
            <div className="space-y-1">
              {tabs.map((tab) => renderSidebarItem(tab))}
            </div>
          </nav>

          <div className={`border-t border-slate-200 p-2 space-y-1 ${isMenuCollapsed ? 'px-1' : ''}`}>
            <button
              onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
              data-sidebar-item
              className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-100 ${
                isMenuCollapsed ? 'justify-center px-2 gap-0' : 'gap-3 px-3'
              }`}
              title={isMenuCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {isMenuCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isMenuCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{isMenuCollapsed ? 'Expandir' : 'Recolher'}</span>
            </button>
            <div className="relative">
              <button
                ref={notificationsButtonRef}
                onClick={() => setShowNotificationsDropdown((current) => !current)}
                data-sidebar-item
                className={`flex items-center rounded-lg py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-orange-50 hover:text-orange-600 ${
                  isMenuCollapsed ? 'w-full justify-center px-2 gap-0' : 'gap-3 px-3'
                }`}
                title="Notificações"
                aria-expanded={showNotificationsDropdown}
                aria-haspopup="true"
              >
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <BellRing className="h-5 w-5" />
                  {unreadReminders > 0 && (
                      <span
                        className={`absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold text-white ${
                          hasActiveNotification ? 'bg-orange-500 animate-pulse' : 'bg-orange-500'
                        }`}
                      >
                        {unreadReminders > 9 ? '9+' : unreadReminders}
                      </span>
                    )}
                  </div>
                  <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isMenuCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>Notificações</span>
                </button>
                {showNotificationsDropdown && (
                  <div
                    ref={notificationsDropdownRef}
                    className={`panel-glass-panel absolute z-50 w-96 rounded-2xl border border-slate-200 bg-white shadow-xl ${
                      isMenuCollapsed
                        ? 'left-full bottom-0 ml-2 max-w-[calc(100vw-5rem)]'
                        : 'left-0 bottom-full mb-2 max-w-[calc(100vw-1rem)]'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Central do dia</p>
                        <p className="text-xs text-slate-500">Resumo de hoje</p>
                      </div>
                      <button
                        onClick={() => {
                          onTabChange('reminders');
                          setShowNotificationsDropdown(false);
                        }}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Ver tudo
                      </button>
                    </div>

                    {notificationsLoading ? (
                      <div className="px-4 py-6 text-sm text-slate-500">Carregando...</div>
                    ) : notificationsError ? (
                      <div className="px-4 py-6 text-sm text-red-600">{notificationsError}</div>
                    ) : (
                      <div className="max-h-[70vh] overflow-y-auto">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lembretes do dia</p>
                            <span className="text-xs text-slate-500">{todayReminders.length}</span>
                          </div>
                          {todayReminders.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">Nenhum lembrete para hoje.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {todayReminders.slice(0, 5).map((reminder) => (
                                <div key={reminder.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                  <p className="text-sm font-semibold text-slate-800">{reminder.titulo}</p>
                                  <p className="text-xs text-slate-500">{formatDateTimeFullBR(reminder.data_lembrete)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagamentos do dia</p>
                            <span className="text-xs text-slate-500">{todayPayments.length}</span>
                          </div>
                          {todayPayments.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">Nenhum pagamento previsto para hoje.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {todayPayments.slice(0, 5).map((payment) => (
                                <div key={payment.id} className="rounded-lg border border-slate-100 bg-emerald-50 px-3 py-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {payment.type === 'comissao' ? 'Comissão' : 'Bonificação'}
                                    {payment.installmentLabel ? ` (${payment.installmentLabel})` : ''}
                                  </p>
                                  <p className="text-xs text-slate-600">{payment.contract.codigo_contrato} • {formatCurrency(payment.value)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aniversariantes</p>
                            <span className="text-xs text-slate-500">{todayBirthdays.length}</span>
                          </div>
                          {todayBirthdays.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">Nenhum aniversariante hoje.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {todayBirthdays.slice(0, 5).map((birthday) => (
                                <div key={birthday.id} className="rounded-lg border border-slate-100 bg-pink-50 px-3 py-2">
                                  <p className="text-sm font-semibold text-slate-800">{birthday.name}</p>
                                  <p className="text-xs text-slate-600">
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
              className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-100 ${
                isMenuCollapsed ? 'justify-center px-2 gap-0' : 'gap-3 px-3'
              }`}
              title={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              aria-label={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isMenuCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{themeMode === 'dark' ? 'Claro' : 'Escuro'}</span>
            </button>
            <button
              onClick={handleLogout}
              data-sidebar-item
              className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 ${
                isMenuCollapsed ? 'justify-center px-2 gap-0' : 'gap-3 px-3'
              }`}
              title={isMenuCollapsed ? 'Sair' : undefined}
            >
              <LogOut className="h-5 w-5" />
              <span className={`transition-all duration-200 overflow-hidden whitespace-nowrap ${isMenuCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {activeCollapsedParentTab?.children && collapsedDropdownPosition && (
        <div
          id="collapsed-menu-dropdown"
          ref={collapsedDropdownRef}
          className="panel-glass-panel fixed z-[60] max-h-[calc(100vh-1rem)] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-2xl"
          style={{
            left: collapsedDropdownPosition.left,
            top: collapsedDropdownPosition.top,
          }}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute h-3 w-3 rotate-45 border border-slate-200 bg-white shadow-[0_10px_22px_-14px_rgba(15,23,42,0.8)] ${
              collapsedDropdownPosition.side === 'right'
                ? '-left-1.5 border-b-0 border-r-0'
                : '-right-1.5 border-l-0 border-t-0'
            }`}
            style={{ top: collapsedDropdownPosition.caretTop - 6 }}
          />
          <div className="space-y-1">
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
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isChildActive ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ChildIcon className="h-4 w-4" />
                    <span>{child.label}</span>
                  </div>
                  {child.badge !== undefined && child.badge > 0 && (
                    <span
                      className={`${
                        child.badgeColor || 'bg-orange-500'
                      } flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold text-white ${
                        child.id === 'reminders' && hasActiveNotification ? 'animate-pulse' : ''
                      } ${child.id === 'leads' && child.badge > 0 ? 'animate-pulse' : ''}`}
                    >
                      {child.badge > 9 ? '9+' : child.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${isMenuCollapsed ? 'ml-16' : 'ml-64'}`}>
        <main className={`flex-1 min-h-0 ${activeTab === 'whatsapp' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div
            ref={panelContentRef}
            className={
              activeTab === 'whatsapp'
                ? 'w-full h-[calc(100vh)] min-h-0'
                : 'w-full py-8 px-2 sm:px-3 lg:px-4'
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
