import { Mail, Send, Inbox, Archive, Star } from 'lucide-react';

export default function EmailManager() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Email</h1>
        <p className="text-slate-600">Gerencie seus emails e campanhas de marketing</p>
      </div>

      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Mail className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Sistema de Email em Desenvolvimento
          </h2>

          <p className="text-lg text-slate-700 mb-8">
            Em breve você terá acesso a uma caixa de email integrada e ferramentas completas de email marketing para se comunicar com seus clientes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <Inbox className="w-8 h-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">Caixa de Email</h3>
              <p className="text-sm text-slate-600">
                Gerencie todos os seus emails em um só lugar
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <Send className="w-8 h-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">Email Marketing</h3>
              <p className="text-sm text-slate-600">
                Crie campanhas e envie emails em massa
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <Star className="w-8 h-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">Templates</h3>
              <p className="text-sm text-slate-600">
                Use templates prontos para seus envios
              </p>
            </div>
          </div>

          <div className="mt-8 text-sm text-slate-500">
            Fique atento! Esta funcionalidade estará disponível em breve.
          </div>
        </div>
      </div>
    </div>
  );
}
