"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type LegalizirajmoSiNewsletterListRow = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function LegalizirajmoSiNewsletterManagement({
  rows,
}: {
  rows: LegalizirajmoSiNewsletterListRow[];
}) {
  const columns: ColumnDef<LegalizirajmoSiNewsletterListRow>[] = [
    {
      accessorKey: "email",
      header: "Email",
      size: 320,
      cell: ({ row }) => (
        <span className="block truncate font-medium text-foreground">
          {row.original.email}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      size: 180,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      size: 180,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {formatDateTime(row.original.updatedAt)}
        </span>
      ),
    },
    {
      accessorKey: "id",
      header: "ID",
      size: 260,
      cell: ({ row }) => (
        <code className="block truncate text-[11px] text-muted-foreground">
          {row.original.id}
        </code>
      ),
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Newsletter subscriptions</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {table.getRowModel().rows.length ? (
          <Table className="table-fixed" style={{ width: table.getTotalSize() }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-48 items-center justify-center px-4 text-center text-xs text-muted-foreground">
            No newsletter emails match the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
