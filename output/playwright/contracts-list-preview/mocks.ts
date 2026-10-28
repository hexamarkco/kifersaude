export const useAuth=()=>({role:'admin'});
export const useConfig=()=>({options:{contract_status:[{value:'Ativo',label:'Ativo',ativo:true},{value:'Cancelado',label:'Cancelado',ativo:true}],lead_responsavel:[]},getRoleModulePermission:()=>({can_view:true,can_edit:!window.location.search.includes("readonly")})});
export const useProductionOperators=()=>({operators:[],error:null});
export const useContractStatus=()=>({changeStatus:async()=>{},savingIds:new Set()});
export const deleteContract=async()=>({error:null});
export const subscribeToContractChanges=()=>()=>{};
let attempts=0;
export const listContractsSearchSnapshot=async()=>{if(window.location.search.includes("error") && attempts++===0) throw new Error("Falha simulada");return ({contracts:Array.from({length:8},(_,i)=>({id:`demo-${i}`,codigo_contrato:`DEMO-00${i+1}`,status:i%2?'Em análise':'Ativo',modalidade:'Individual',operadora:'Amil',produto_plano:'Plano demonstração',mensalidade_total:i===0?0:850+i*100,comissao_prevista:i===0?0:1700+i*200,responsavel:'Operador demonstração'})),holdersByContractId:Object.fromEntries(Array.from({length:7},(_,i)=>[`demo-${i}`, [{id:`holder-${i}`,contract_id:`demo-${i}`,nome_completo:`Pessoa demonstração ${i+1}`}]])),dependentsByContractId:{},failedSources:[]});};
