import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Users,
  FileText,
  LayoutDashboard,
  Bell,
  Moon,
  LogOut,
  Settings,
  MessageCircle,
  Sun,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Briefcase,
  BookOpen,
  PiggyBank,
  DollarSign,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { supabase, Reminder, Contract } from '../lib/supabase';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useNavigate } from 'react-router-dom';
import type { TabNavigationOptions } from '../types/navigation';

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
  const [expandedMobileParent, setExpandedMobileParent] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
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
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const collapsedMenuDragStartY = useRef<number | null>(null);
  const [dropdownAlignment, setDropdownAlignment] = useState<Record<string, 'left' | 'right'>>({});
  const notificationsDropdownRef = useRef<HTMLDivElement | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentRole = role;

  const canView = (moduleId: string) => getRoleModulePermission(currentRole, moduleId).can_view;

  const crmChildren = [
    { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount, badgeColor: 'bg-orange-500' },
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'financeiro-agenda', label: 'Tarefas', icon: Calendar },
    { id: 'reminders', label: 'Lembretes', icon: Bell, badge: unreadReminders },
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
          const customInstallments = Array.isArray(contract.comissao_parcelas)
            ? contract.comissao_parcelas
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

  const handleTabClick = (tab: TabConfig) => {
    if (tab.children && tab.children.length > 0) {
      setExpandedParent(expandedParent === tab.id ? null : tab.id);
    } else {
      onTabChange(tab.id);
      setExpandedParent(null);
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

  const updateDropdownAlignment = useCallback(
    (parentId: string) => {
      const dropdown = dropdownRefs.current[parentId];
      const trigger = triggerRefs.current[parentId];

      if (!dropdown || !trigger) {
        return;
      }

      const dropdownRect = dropdown.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const dropdownWidth = dropdownRect.width;
      const viewportWidth = window.innerWidth;

      let alignment: 'left' | 'right' = 'left';
      const leftAlignedRightEdge = triggerRect.left + dropdownWidth;
      const rightAlignedLeftEdge = triggerRect.right - dropdownWidth;

      if (leftAlignedRightEdge > viewportWidth) {
        alignment = 'right';
      }

      if (alignment === 'right' && rightAlignedLeftEdge < 0) {
        alignment = 'left';
      }

      setDropdownAlignment((previous) => {
        if (previous[parentId] === alignment) {
          return previous;
        }

        return { ...previous, [parentId]: alignment };
      });
    },
    []
  );

  useLayoutEffect(() => {
    if (!expandedParent) {
      return;
    }

    updateDropdownAlignment(expandedParent);

    const handleResize = () => {
      updateDropdownAlignment(expandedParent);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [expandedParent, updateDropdownAlignment]);

  useEffect(() => {
    if (!expandedParent) {
      return;
    }

    const handleScroll = () => {
      updateDropdownAlignment(expandedParent);
    };

    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [expandedParent, updateDropdownAlignment]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
        setExpandedMobileParent(null);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setExpandedMobileParent(null);
  }, [activeTab]);

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
    window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const toggleThemeMode = () => {
    setThemeMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
  };

  const toggleMobileParent = (parentId: string) => {
    setExpandedMobileParent(current => (current === parentId ? null : parentId));
  };

  const renderMobileChildren = (tab: TabConfig) => {
    if (!tab.children || tab.children.length === 0 || expandedMobileParent !== tab.id) {
      return null;
    }

    return (
      <div className="mt-2 space-y-1 pl-10">
        {tab.children.map((child) => {
          const ChildIcon = child.icon;
          return (
            <button
              key={child.id}
              onClick={() => {
                onTabChange(child.id);
                setIsMobileMenuOpen(false);
                setExpandedMobileParent(null);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === child.id ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-100'
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
                  } text-white text-xs font-semibold inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 ${
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
    );
  };

  const handleCollapsedMenuPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    collapsedMenuDragStartY.current = event.clientY;
  }, []);

  const handleCollapsedMenuPointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (collapsedMenuDragStartY.current === null) {
      return;
    }

    const dragDistance = event.clientY - collapsedMenuDragStartY.current;
    collapsedMenuDragStartY.current = null;

    if (dragDistance > 30) {
      setIsMenuCollapsed(false);
    }
  }, []);

  const handleCollapsedMenuPointerCancel = useCallback(() => {
    collapsedMenuDragStartY.current = null;
  }, []);

  return (
    <div
      className={`painel-theme theme-${themeMode} flex min-h-screen flex-col bg-slate-50`}
    >
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <span className="text-lg font-bold text-white">K</span>
              </div>
              <span className="sr-only">Kifer Saúde - Sistema de Gestão</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(current => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 lg:hidden"
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <nav className="hidden items-center gap-2 lg:flex">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = isParentActive(tab);
                  const isExpanded = expandedParent === tab.id;
                  const totalBadge = getTotalBadge(tab);

                  return (
                    <div key={tab.id} className="relative">
                      <button
                        ref={(element) => {
                          triggerRefs.current[tab.id] = element;
                        }}
                        onClick={() => handleTabClick(tab)}
                        className={`relative flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
                          isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        aria-expanded={isExpanded}
                        aria-haspopup={tab.children && tab.children.length > 0 ? 'menu' : undefined}
                        title={tab.label}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="hidden xl:inline">{tab.label}</span>
                        {tab.children && tab.children.length > 0 && (
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                        {totalBadge > 0 && (
                          <span
                            className={`absolute -top-1 -right-1 ${
                              tab.badgeColor || 'bg-orange-500'
                            } flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
                              hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders') ? 'animate-pulse' : ''
                            } ${
                              (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0 ? 'animate-pulse' : ''
                            }`}
                          >
                            {totalBadge > 9 ? '9+' : totalBadge}
                          </span>
                        )}
                      </button>

                      {tab.children && isExpanded && (
                        <div
                          ref={(element) => {
                            dropdownRefs.current[tab.id] = element;
                          }}
                          className={`absolute top-full mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl ${
                            dropdownAlignment[tab.id] === 'right' ? 'right-0 left-auto' : 'left-0'
                          }`}
                        >
                          {tab.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  onTabChange(child.id);
                                  setExpandedParent(null);
                                }}
                                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium transition-colors ${
                                  activeTab === child.id ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <ChildIcon className="h-4 w-4" />
                                  <span>{child.label}</span>
                                </div>
                                {child.badge !== undefined && child.badge > 0 && (
                                  <span
                                    className={`${
                                      child.badgeColor || 'bg-orange-500'
                                    } flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
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
                })}
              </nav>
              <div className="relative">
                <button
                  ref={notificationsButtonRef}
                  onClick={() => setShowNotificationsDropdown((current) => !current)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-orange-50 hover:text-orange-600"
                  title="Notificações"
                  aria-expanded={showNotificationsDropdown}
                  aria-haspopup="true"
                >
                  <Bell className="h-5 w-5" />
                  {unreadReminders > 0 && (
                    <span
                      className={`absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
                        hasActiveNotification ? 'bg-orange-500 animate-pulse' : 'bg-orange-500'
                      }`}
                    >
                      {unreadReminders > 9 ? '9+' : unreadReminders}
                    </span>
                  )}
                  <span className="sr-only">Notificações</span>
                </button>
                {showNotificationsDropdown && (
                  <div
                    ref={notificationsDropdownRef}
                    className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Central do dia</p>
                        <p className="text-xs text-slate-500">Resumo de hoje</p>
                      </div>
                      <button
                        onClick={() => onTabChange('reminders')}
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
                                    {payment.type === 'comissao' ? 'Comissao' : 'Bonificacao'}
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
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
                title={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                aria-label={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              >
                {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
                <span className="sr-only">Sair</span>
              </button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className="absolute inset-x-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl lg:hidden">
              <nav className="flex flex-col gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const totalBadge = getTotalBadge(tab);
                  const isExpanded = expandedMobileParent === tab.id;
                  const isActive = isParentActive(tab);

                  return (
                    <div key={tab.id} className="flex flex-col">
                      <button
                        onClick={() => {
                          if (tab.children && tab.children.length > 0) {
                            toggleMobileParent(tab.id);
                          } else {
                            onTabChange(tab.id);
                          }
                        }}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full ${
                              isActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="flex flex-col text-left">
                            <span>{tab.label}</span>
                            {tab.children && tab.children.length > 0 && (
                              <span className="text-xs font-normal text-slate-500">
                                {isExpanded ? 'Recolher' : 'Expandir'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {totalBadge > 0 && (
                            <span
                              className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-semibold text-white ${
                                tab.badgeColor || 'bg-orange-500'
                              } ${
                                hasActiveNotification && (tab.id === 'crm' || activeTab === 'reminders')
                                  ? 'animate-pulse'
                                  : ''
                              } ${
                                (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0
                                  ? 'animate-pulse'
                                  : ''
                              }`}
                            >
                              {totalBadge > 9 ? '9+' : totalBadge}
                            </span>
                          )}
                          {tab.children && tab.children.length > 0 && (
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </button>
                      {renderMobileChildren(tab)}
                    </div>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className={`flex-1 min-h-0 ${activeTab === 'whatsapp' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div
          className={
            activeTab === 'whatsapp'
              ? 'w-full h-[calc(100vh-4rem)] min-h-0'
              : 'w-full px-4 py-8 sm:px-6 lg:px-8'
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
