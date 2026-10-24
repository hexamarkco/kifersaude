import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Filter,
  LayoutDashboard,
  Menu,
  Pencil,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  Button,
  Card,
  ChartCard,
  Checkbox,
  DateTimePicker,
  EmptyState,
  Field,
  FilterBar,
  FilterSelect,
  FormActions,
  IconButton,
  Input,
  KpiCard,
  NavigationList,
  ListPage,
  DetailPage,
  FormPage,
  FormSection,
  DashboardPage,
  PageActions,
  ResponsiveCollection,
  type PageHeaderProps,
  PageSection,
  Pagination,
  Progress,
  SearchInput,
  SectionHeader,
  Select,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  ToolbarActions,
  ToolbarSearch,
  useTableSorting,
  sortTableRows,
  useToast,
} from '../../../design-system';
import { type Pattern, patterns } from './catalog';

import {
  demoContacts,
  operatorOptions,
  statusOptions,
  statuses,
  type DemoContact,
} from './demoData';

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  );

export function ContactStatus({ status }: { status: string }) {
  return (
    <Badge
      tone={
        status === 'Contratado'
          ? 'success'
          : status === 'Proposta enviada'
            ? 'warning'
            : status === 'Novo contato'
              ? 'info'
              : 'accent'
      }
    >
      {status}
    </Badge>
  );
}

export function ContactForm({
  initial,
  onSave,
  onCancel,
  header,
}: {
  initial?: DemoContact;
  onSave: (contact: DemoContact) => void;
  onCancel: () => void;
  header?: PageHeaderProps;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [operator, setOperator] = useState(initial?.operator ?? 'Amil');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    name:
      name.trim().length < 3
        ? 'Informe um nome com pelo menos 3 caracteres.'
        : undefined,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? undefined
      : 'Informe um e-mail válido, como nome@exemplo.com.',
    phone:
      phone.replace(/\D/g, '').length < 10
        ? 'Informe o DDD e o telefone com 10 ou 11 dígitos.'
        : undefined,
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalid = (
      Object.keys(errors) as Array<keyof typeof errors>
    ).find((key) => errors[key]);
    if (firstInvalid) {
      const field = event.currentTarget.elements.namedItem(firstInvalid);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    onSave({
      id: initial?.id ?? Date.now(),
      name: name.trim(),
      email,
      phone,
      operator,
      status: initial?.status ?? 'Novo contato',
      value: initial?.value ?? 0,
      notes,
    });
  };
  const fields = (
    <>
      <FormSection
        title="Dados do contato"
        description="Campos com * são obrigatórios."
      >
        <Field
          label="Nome completo"
          required
          error={submitted ? errors.name : undefined}
        >
          <Input
            name="name"
            placeholder="Ex.: Ana Paula Ribeiro"
            value={name}
            onChange={(event) => setName(event.target.value)}
            invalid={submitted && Boolean(errors.name)}
            autoComplete="off"
          />
        </Field>
        <Field
          label="E-mail"
          required
          error={submitted ? errors.email : undefined}
        >
          <Input
            name="email"
            type="email"
            placeholder="nome@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={submitted && Boolean(errors.email)}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Telefone"
          required
          hint="Informe o DDD. A formatação é automática."
          error={submitted ? errors.phone : undefined}
        >
          <Input
            name="phone"
            autoFormat="phone"
            inputMode="tel"
            placeholder="(11) 99999-0000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            invalid={submitted && Boolean(errors.phone)}
            autoComplete="off"
          />
        </Field>
        <Field label="Operadora de interesse">
          <Select
            value={operator}
            onChange={(event) => setOperator(event.target.value)}
            options={operatorOptions}
          />
        </Field>
      </FormSection>
      <FormSection title="Contexto do atendimento">
        <Field
          label="Observações"
          hint="Este exemplo mantém os dados somente enquanto a prévia estiver aberta."
        >
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Preferências e próximos passos da conversa"
            rows={3}
          />
        </Field>
      </FormSection>
    </>
  );
  const actions = (
    <FormActions
      onCancel={() => {
        setName(initial?.name ?? '');
        setEmail(initial?.email ?? '');
        setPhone(initial?.phone ?? '');
        setOperator(initial?.operator ?? 'Amil');
        setNotes(initial?.notes ?? '');
        setSubmitted(false);
        onCancel();
      }}
      submitLabel={initial ? 'Salvar alterações' : 'Criar contato'}
      message="Demonstração · dados somente nesta prévia"
    />
  );
  return header ? (
    <FormPage header={header} onSubmit={submit} noValidate actions={actions}>
      {fields}
    </FormPage>
  ) : (
    <form className="ds-demo-form" onSubmit={submit} noValidate>
      {fields}
      {actions}
    </form>
  );
}

export function ContactList({
  contacts = demoContacts,
  onOpen,
  onCreate,
  header,
}: {
  contacts?: DemoContact[];
  onOpen?: (contact: DemoContact) => void;
  onCreate?: () => void;
  header?: PageHeaderProps;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const { sorting, sortBy } = useTableSorting<'name' | 'value'>('name');
  const filtered = contacts.filter(
    (contact) =>
      `${contact.name} ${contact.email} ${contact.operator}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')) &&
      (!status || contact.status === status),
  );
  const sorted = sortTableRows(filtered, sorting, (row, key) => row[key]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / 4));
  const currentPage = Math.min(page, totalPages);
  const rows = sorted.slice((currentPage - 1) * 4, currentPage * 4);
  const hasFilters = Boolean(search || status);
  const searchControl = (
    <>
      <SearchInput
        aria-label="Buscar contatos"
        placeholder="Buscar nome, e-mail ou operadora"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
    </>
  );
  const filters = (
    <>
      <FilterSelect
        icon={Filter}
        placeholder="Todos os status"
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        options={statusOptions}
      />
      {hasFilters && (
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            setSearch('');
            setStatus('');
            setPage(1);
          }}
        >
          Limpar filtros
        </Button>
      )}
    </>
  );
  const summary = (
    <div className="ds-list-summary">
      <span>
        {filtered.length} contatos
        {hasFilters ? ' encontrados' : ' na demonstração'}
      </span>
      {selected.length > 0 && <Badge>{selected.length} selecionados</Badge>}
    </div>
  );
  const pagination =
    rows.length > 0 ? (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        itemsPerPage={4}
        totalItems={filtered.length}
      />
    ) : null;
  const content = rows.length ? (
    <>
      <ResponsiveCollection
        table={
          <>
            <Table
              aria-label="Contatos demonstrativos"
              columnWidths={[
                'var(--space-16)',
                'auto',
                'auto',
                'auto',
                'auto',
                'var(--space-16)',
              ]}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      touchTarget
                      aria-label="Selecionar contatos desta página"
                      checked={rows.every((row) => selected.includes(row.id))}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [
                                ...new Set([
                                  ...current,
                                  ...rows.map((row) => row.id),
                                ]),
                              ]
                            : current.filter(
                                (id) => !rows.some((row) => row.id === id),
                              ),
                        )
                      }
                    />
                  </TableHead>
                  <SortableTableHead
                    label="Nome"
                    sortDirection={
                      sorting.key === 'name' ? sorting.direction : null
                    }
                    onSort={() => sortBy('name')}
                  />
                  <TableHead>Operadora</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableTableHead
                    label="Valor mensal"
                    align="right"
                    sortDirection={
                      sorting.key === 'value' ? sorting.direction : null
                    }
                    onSort={() => sortBy('value')}
                  />
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} selected={selected.includes(row.id)}>
                    <TableCell>
                      <Checkbox
                        touchTarget
                        aria-label={`Selecionar ${row.name}`}
                        checked={selected.includes(row.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="ds-person">
                        <Avatar name={row.name} size="sm" />
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.email}</small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{row.operator}</TableCell>
                    <TableCell>
                      <ContactStatus status={row.status} />
                    </TableCell>
                    <TableCell align="right">{currency(row.value)}</TableCell>
                    <TableCell>
                      <IconButton
                        aria-label={`Ver ${row.name}`}
                        size="sm"
                        onClick={() => onOpen?.(row)}
                        disabled={!onOpen}
                      >
                        <ArrowUpRight />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        }
        cards={
          <div className="ds-mobile-contacts">
            <Select
              aria-label="Ordenar contatos"
              value={`${sorting.key}-${sorting.direction}`}
              onChange={(event) => {
                const key = event.target.value.startsWith('value-')
                  ? 'value'
                  : 'name';
                sortBy(key);
              }}
              options={[
                {
                  value: `name-${sorting.direction}`,
                  label: 'Nome',
                },
                {
                  value: `value-${sorting.direction}`,
                  label: 'Valor mensal',
                },
              ]}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => sortBy(sorting.key ?? 'name')}
            >
              {sorting.direction === 'asc'
                ? 'Ordem crescente'
                : 'Ordem decrescente'}{' '}
              · inverter
            </Button>
            {rows.map((row) => (
              <Card key={row.id} padding="sm">
                <div className="ds-between">
                  <div className="ds-person">
                    <Avatar name={row.name} size="sm" />
                    <strong>{row.name}</strong>
                  </div>
                  <Checkbox
                    touchTarget
                    aria-label={`Selecionar ${row.name}`}
                    checked={selected.includes(row.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, row.id]
                          : current.filter((id) => id !== row.id),
                      )
                    }
                  />
                </div>
                <div className="ds-between">
                  <span>{row.operator}</span>
                  <ContactStatus status={row.status} />
                </div>
                <div className="ds-between">
                  <strong>
                    {currency(row.value)}
                    <small>/mês</small>
                  </strong>
                  <Button
                    size="sm"
                    variant="text"
                    onClick={() => onOpen?.(row)}
                    disabled={!onOpen}
                  >
                    Ver detalhes
                    <ArrowUpRight />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        }
      />
    </>
  ) : (
    <EmptyState
      icon={<Search />}
      title={
        hasFilters
          ? 'Nenhum contato encontrado'
          : 'Sua lista está pronta para começar'
      }
      description={
        hasFilters
          ? 'Tente outro nome ou ajuste os filtros para ampliar a busca.'
          : 'Adicione o primeiro contato para organizar o atendimento.'
      }
      action={
        hasFilters ? (
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setStatus('');
            }}
          >
            Limpar busca e filtros
          </Button>
        ) : (
          <Button onClick={onCreate} disabled={!onCreate}>
            Criar contato
          </Button>
        )
      }
    />
  );
  return header ? (
    <ListPage
      header={header}
      search={searchControl}
      filters={filters}
      summary={summary}
      pagination={pagination}
    >
      {content}
    </ListPage>
  ) : (
    <div className="ds-stack">
      <FilterBar>
        <ToolbarSearch>{searchControl}</ToolbarSearch>
        <ToolbarActions>{filters}</ToolbarActions>
      </FilterBar>
      <div role="status">{summary}</div>
      {content}
      {pagination}
    </div>
  );
}

export default function WorkspacePreview({
  initialPattern,
}: {
  initialPattern: Pattern;
}) {
  const [view, setView] = useState<Pattern>(initialPattern);
  const [contacts, setContacts] = useState(demoContacts);
  const [contact, setContact] = useState(demoContacts[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [period, setPeriod] = useState('month');
  const { toast } = useToast();
  const changeView = (id: string) => {
    if (patterns.some((item) => item.id === id)) setView(id as Pattern);
    setMenuOpen(false);
  };
  const openContact = (next: DemoContact) => {
    setContact(next);
    setView('detail');
  };
  const titles = {
    list: 'Contatos',
    detail: contact.name,
    create: 'Novo contato',
    edit: 'Editar contato',
    dashboard: 'Visão comercial',
  };
  const descriptions = {
    list: 'Consulte os contatos e organize o próximo atendimento.',
    detail: 'Informações e próximos passos do relacionamento.',
    create: 'Organize o início de um novo relacionamento.',
    edit: 'Mantenha as informações do atendimento atualizadas.',
    dashboard: 'Resultados desta base demonstrativa.',
  };
  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbItem>
        <BreadcrumbLink
          href="?preview=1&pattern=list"
          onClick={(event) => {
            event.preventDefault();
            setView('list');
          }}
        >
          CRM
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem isCurrent>
        {view === 'detail' || view === 'edit' ? contact.name : titles[view]}
      </BreadcrumbItem>
    </Breadcrumb>
  );
  const header: PageHeaderProps = {
    title: titles[view],
    description: descriptions[view],
    breadcrumbs,
    identity:
      view === 'detail' ? <Avatar name={contact.name} size="md" /> : undefined,
    status:
      view === 'detail' ? <ContactStatus status={contact.status} /> : undefined,
    actions:
      view === 'list' ? (
        <PageActions
          primary={{
            label: 'Novo contato',
            icon: Plus,
            onClick: () => setView('create'),
          }}
        />
      ) : view === 'detail' ? (
        <PageActions
          secondary={[
            {
              label: 'Voltar',
              icon: ArrowLeft,
              onClick: () => setView('list'),
            },
          ]}
          primary={{
            label: 'Editar contato',
            icon: Pencil,
            onClick: () => setView('edit'),
          }}
        />
      ) : undefined,
  };
  const save = (next: DemoContact) => {
    setContacts((current) =>
      current.some((row) => row.id === next.id)
        ? current.map((row) => (row.id === next.id ? next : row))
        : [next, ...current],
    );
    setContact(next);
    setView('detail');
    toast({
      variant: 'success',
      title: 'Exemplo salvo nesta prévia',
      description:
        'A lista demonstrativa foi atualizada. Recarregar restaura os exemplos.',
    });
  };
  const periodFilter = (
    <Field label="Período do dashboard">
      <Select
        value={period}
        onChange={(event) => setPeriod(event.target.value)}
        options={[
          { value: 'month', label: 'Todos os contatos' },
          { value: 'new', label: 'Novos contatos' },
        ]}
      />
    </Field>
  );
  return (
    <div className="ds-workspace">
      <div className="ds-workspace-top">
        <div className="ds-brand">
          <span className="ds-brand-mark">k.</span>
          <strong>
            Kifer Saúde<span>CRM · demonstração</span>
          </strong>
        </div>
        <div className="ds-row">
          <Badge tone="info">Dados de exemplo</Badge>
          <IconButton
            className="ds-workspace-menu"
            aria-label="Abrir navegação do exemplo"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
          >
            <Menu />
          </IconButton>
          <Avatar name="Marina Costa" size="sm" />
        </div>
      </div>
      <div className="ds-workspace-body">
        <aside className={`ds-workspace-sidebar${menuOpen ? ' is-open' : ''}`}>
          <span className="ds-eyebrow">ÁREA DE TRABALHO</span>
          <NavigationList
            ariaLabel="Navegação do exemplo"
            items={[
              {
                id: 'dashboard',
                label: 'Visão comercial',
                href: '?preview=1&pattern=dashboard',
                icon: LayoutDashboard,
              },
              {
                id: 'list',
                label: 'Contatos',
                href: '?preview=1&pattern=list',
                icon: Users,
              },
              {
                id: 'create',
                label: 'Novo contato',
                href: '?preview=1&pattern=create',
                icon: Plus,
              },
            ]}
            activeId={view === 'detail' || view === 'edit' ? 'list' : view}
            onNavigate={changeView}
          />
        </aside>
        <div className="ds-workspace-content">
          {view === 'list' && (
            <ContactList
              header={header}
              contacts={contacts}
              onOpen={openContact}
              onCreate={() => setView('create')}
            />
          )}
          {(view === 'create' || view === 'edit') && (
            <ContactForm
              key={`${view}-${contact.id}`}
              header={header}
              initial={view === 'edit' ? contact : undefined}
              onSave={save}
              onCancel={() => setView(view === 'edit' ? 'detail' : 'list')}
            />
          )}
          {view === 'detail' && (
            <DetailPage
              header={header}
              aside={
                <Card>
                  <SectionHeader title="Próximo atendimento" as="h2" />
                  <div className="ds-stack">
                    <Field label="Data e horário">
                      <DateTimePicker placeholder="Selecionar atendimento" />
                    </Field>
                    <Alert tone="info">
                      Este agendamento é visual e não cria lembretes.
                    </Alert>
                    <div className="ds-timeline">
                      <CalendarDays size={18} />
                      <div>
                        <strong>Conversa inicial</strong>
                        <p>Interesse em cobertura para a família.</p>
                      </div>
                    </div>
                  </div>
                </Card>
              }
            >
              <Card>
                <SectionHeader title="Informações de contato" as="h2" />
                <dl className="ds-description-list">
                  <div>
                    <dt>E-mail</dt>
                    <dd>{contact.email}</dd>
                  </div>
                  <div>
                    <dt>Telefone</dt>
                    <dd>{contact.phone}</dd>
                  </div>
                  <div>
                    <dt>Operadora</dt>
                    <dd>{contact.operator}</dd>
                  </div>
                  <div>
                    <dt>Valor mensal</dt>
                    <dd>{currency(contact.value)}</dd>
                  </div>
                  {contact.notes && (
                    <div>
                      <dt>Observações</dt>
                      <dd>{contact.notes}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            </DetailPage>
          )}
          {view === 'dashboard' && (
            <Dashboard
              header={header}
              filters={periodFilter}
              contacts={
                period === 'new'
                  ? contacts.filter((row) => row.status === 'Novo contato')
                  : contacts
              }
              onOpen={openContact}
            />
          )}
          <footer className="ds-demo-footer">
            Demonstração · dados ilustrativos · nenhuma comunicação é enviada
          </footer>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  contacts,
  onOpen,
  header,
  filters,
}: {
  header: PageHeaderProps;
  filters: ReactNode;
  contacts: DemoContact[];
  onOpen: (contact: DemoContact) => void;
}) {
  const contracted = contacts.filter((row) => row.status === 'Contratado');
  return (
    <DashboardPage
      header={header}
      filters={filters}
      indicators={
        <>
          <KpiCard
            title="Contatos"
            value={String(contacts.length)}
            subtitle="Nesta base de exemplo"
            icon={<Users />}
          />
          <KpiCard
            title="Contratados"
            value={String(contracted.length)}
            subtitle="Com contratação concluída"
            icon={<CheckCircle2 />}
          />
          <KpiCard
            title="Valor contratado"
            value={currency(
              contracted.reduce((sum, row) => sum + row.value, 0),
            )}
            subtitle="Mensalidades dos exemplos"
            icon={<FileText />}
          />
        </>
      }
    >
      <div className="ds-detail-grid">
        <ChartCard
          title="Etapas do atendimento"
          subtitle="Distribuição dos contatos demonstrativos"
        >
          <div className="ds-stack">
            {statuses.map((status) => (
              <div className="ds-stack ds-gap-small" key={status}>
                <div className="ds-between">
                  <span>{status}</span>
                  <strong>
                    {contacts.filter((row) => row.status === status).length}
                  </strong>
                </div>
                <Progress
                  value={
                    contacts.length
                      ? (contacts.filter((row) => row.status === status)
                          .length /
                          contacts.length) *
                        100
                      : 0
                  }
                />
              </div>
            ))}
          </div>
        </ChartCard>
        <PageSection>
          <SectionHeader title="Contatos em destaque" as="h2" />
          <div className="ds-stack">
            {contacts.slice(0, 3).map((row) => (
              <button
                className="ds-contact-link"
                key={row.id}
                onClick={() => onOpen(row)}
              >
                <Avatar name={row.name} size="sm" />
                <span>
                  {row.name}
                  <small>{row.operator}</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        </PageSection>
      </div>
    </DashboardPage>
  );
}
