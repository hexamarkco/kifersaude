lead.id) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                          title="Contrato cadastrado para este lead"
                        >
                          <FileText className="h-3 w-3" />
                          Contrato
                        </span>
                      )}
                      {!isObserver ? (
                        <StatusDropdown
                          currentStatus={lead.status}
                          leadId={lead.id}
                          onStatusChange={handleStatusChange}
                          disabled={isBulkUpdating}
                          statusOptions={activeLeadStatuses}
                        />
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                          {lead.status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2 break-words">
                        {lead.telefone && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppContact(lead)}
                            className="text-teal-600 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full p-1"
                            title="Conversar no WhatsApp"
                            aria-label={`Conversar com ${lead.nome_completo} no WhatsApp`}
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        )}
                        <span>{lead.telefone}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2 truncate">
                          <button
                            type="button"
                            onClick={() => handleEmailContact(lead)}
                            className="text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-full p-1"
                            title="Enviar e-mail"
                            aria-label={`Enviar e-mail para ${lead.nome_completo}`}
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Origem:</span> {lead.origem}
                      </div>
                      <div>
                        <span className="font-medium">Tipo:</span> {lead.tipo_contratacao}
                      </div>
                    </div>
                    {lead.cidade && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Cidade:</span> {lead.cidade}
                      </div>
                    )}
                    {lead.proximo_retorno && (
                      <div className="mt-2 flex items-center space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="text-orange-600 font-medium">
                          Retorno: {formatDateTimeFullBR(lead.proximo_retorno)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 lg:text-right">
                    <div>
                      Responsável: <span className="font-medium text-slate-700">{lead.responsavel}</span>
                    </div>
                    <div className="mt-1">Criado: {new Date(lead.data_criacao).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedLead(lead)}
                className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                aria-label="Ver detalhes do lead"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Detalhes</span>
              </button>
              {!isObserver && (
                <>
                  <button
                    onClick={() => {
                      setEditingLead(lead);
                      setShowForm(true);
                    }}
                    className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    aria-label="Editar lead"
                  >
                    <Pencil className="w-4 h-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    onClick={() => handleConvertToContract(lead)}
                    className="hidden md:inline-flex items-center space-x-2 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Converter em Contrato</span>
                  </button>
                  <button
                    onClick={() => setReminderLead(lead)}
                    className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                    aria-label="Agendar lembrete"
                    type="button"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="hidden sm:inline">Agendar Lembrete</span>
                  </button>
                  <button
                    onClick={() => handleDeleteLead(lead)}
                    className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    aria-label="Excluir lead"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                  {!showArchived ? (
                    <button
                      onClick={() => handleArchive(lead.id)}
                      className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors sm:ml-auto"
                      aria-label="Arquivar lead"
                    >
                      <Archive className="w-4 h-4" />
                      <span className="hidden sm:inline">Arquivar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnarchive(lead.id)}
                      className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors sm:ml-auto"
                      aria-label="Reativar lead"
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Reativar</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum lead encontrado</h3>
            <p className="text-slate-600">Tente ajustar os filtros ou adicione um novo lead.</p>
          </div>
        )}
        </div>

        {filteredLeads.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredLeads.length}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
        </div>
      )}

      {showForm && (
        <LeadForm
          lead={editingLead}
          onClose={() => {
            setShowForm(false);
            setEditingLead(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditingLead(null);
            loadLeads();
          }}
        />
      )}

      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={loadLeads}
          onEdit={(lead) => {
            setSelectedLead(null);
            setEditingLead(lead);
            setShowForm(true);
          }}
          onDelete={handleDeleteLead}
        />
      )}

      {reminderLead && (
        <ReminderSchedulerModal
          lead={reminderLead}
          onClose={() => setReminderLead(null)}
          onScheduled={(_details) => {
            setReminderLead(null);
            loadLeads();
          }}
          promptMessage="Deseja agendar o primeiro lembrete após a proposta enviada?"
          defaultType="Follow-up"
        />
      )}
      {ConfirmationDialog}
    </div>
  );
}
