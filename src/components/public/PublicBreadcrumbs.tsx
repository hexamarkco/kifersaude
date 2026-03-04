import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PublicBreadcrumbItem } from './PublicSeo';

type PublicBreadcrumbsProps = {
  items: PublicBreadcrumbItem[];
};

export default function PublicBreadcrumbs({ items }: PublicBreadcrumbsProps) {
  const breadcrumbItems = items.length > 0 && items[0].path !== '/' ? [{ name: 'Inicio', path: '/' }, ...items] : items;

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <section className="px-4 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <span key={`${item.path}-${item.name}`} className="inline-flex items-center gap-2">
                {isLast ? (
                  <span className="text-orange-600" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link to={item.path} className="hover:text-orange-600">
                    {item.name}
                  </Link>
                )}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
