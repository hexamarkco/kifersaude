import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import ContractStatusDropdown from '../../../src/features/contracts/components/ContractStatusDropdown';
import '../../../src/index.css';
function App() { const [status,setStatus]=useState('Em análise'); const [result,setResult]=useState(''); return <div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] p-6"><ContractStatusDropdown status={status} code="DEMO" tone="info" canEdit saving={false} operators={[{user_id:'operador',display_name:'Operadora demonstração',active:true}]} options={[{value:'Em análise',label:'Em análise'},{value:'Ativo',label:'Ativo'},{value:'Documentos pendentes',label:'Documentos pendentes'}]} getOptionTone={v=>v==='Ativo'?'success':'info'} onChange={async (v,op)=>{setStatus(v);setResult(op??'sem responsável')}} /><p>{result}</p></div> }
createRoot(document.getElementById('root')!).render(<App/>);
