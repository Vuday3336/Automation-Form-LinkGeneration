// Table wrappers: horizontal scroll inside the card on narrow screens, never the whole page.
export function Table({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = '' }) {
  return (
    <th scope="col" className={`whitespace-nowrap bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-slate-700 ${className}`}>{children}</td>;
}
