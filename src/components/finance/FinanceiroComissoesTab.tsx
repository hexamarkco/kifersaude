import CommissionCalendar from './CommissionCalendar';
import TodoCalendar from './TodoCalendar';

export default function FinanceiroComissoesTab() {
  return (
    <div className="space-y-6">
      <CommissionCalendar />
      <TodoCalendar />
    </div>
  );
}
