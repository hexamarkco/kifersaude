import AutoContactFlowSettings from './AutoContactFlowSettings';

export default function AutomationFlowsTab() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Fluxos de automacao</h2>
          <p className="text-sm text-slate-500 mt-1">
            Crie automacoes generalistas com gatilhos, condicoes, bifurcacoes e acoes.
          </p>
        </div>
      </div>

      <AutoContactFlowSettings />
    </div>
  );
}
