import { EmptyState } from "./empty-state";

export type TableRow = {
  id: string;
  cells: Array<React.ReactNode>;
};

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: TableRow[];
}) {
  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E4E7EC] bg-white">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 bg-[#F4F6FB] text-xs font-semibold tracking-wide text-[#667085] uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border-b border-[#E4E7EC] px-5 py-3.5"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-[#F7F8FC]">
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.id}-${columns[index] ?? index}`}
                  className="border-b border-[#E4E7EC] px-5 py-4 text-[#344054] last:border-b-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
