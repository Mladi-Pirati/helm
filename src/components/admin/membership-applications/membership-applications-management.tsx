"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollContainer,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkMembershipApplicationActionDialog } from "@/components/admin/membership-applications/bulk-membership-application-action-dialog";
import { DeleteMembershipApplicationDialog } from "@/components/admin/membership-applications/delete-membership-application-dialog";
import { differenceInYears } from "date-fns";

import { formatSlovenianDateTime, parseDateOnly } from "@/lib/date-format";
import {
  buildMembershipApplicationDetailsHref,
  getMembershipApplicationStatusVariant,
  membershipApplicationStatusLabels,
  type MembershipApplicationStatus,
  type ResidenceRegion,
} from "@/lib/membership-applications";

export type MembershipApplicationListRow = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  cityAndPostalCode: string;
  residenceRegion: ResidenceRegion;
  email: string;
  status: MembershipApplicationStatus;
  createdAt: string;
};

type PageSizeOption = {
  href: string;
  value: number;
};

function formatDateTime(value: string) {
  return formatSlovenianDateTime(new Date(value));
}

function getApplicationDisplayName(
  row: Pick<MembershipApplicationListRow, "firstName" | "lastName">,
) {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function MembershipApplicationsManagement({
  canDelete,
  nextPageHref,
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
  previousPageHref,
  queryString,
  rows,
  totalCount,
}: {
  canDelete: boolean;
  nextPageHref: string;
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: PageSizeOption[];
  previousPageHref: string;
  queryString: string;
  rows: MembershipApplicationListRow[];
  totalCount: number;
}) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  useEffect(() => {
    setRowSelection({});
  }, [rows]);

  const columns: ColumnDef<MembershipApplicationListRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible applications"
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => {
            table.toggleAllRowsSelected(!!value);
            setFeedback(null);
          }}
        />
      ),
      size: 44,
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select application for ${getApplicationDisplayName(row.original)}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(!!value);
            setFeedback(null);
          }}
        />
      ),
    },
    {
      id: "name",
      header: "Applicant",
      size: 220,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            className="truncate font-medium text-foreground hover:underline"
            href={buildMembershipApplicationDetailsHref(
              row.original.id,
              queryString,
            )}
            prefetch={false}
          >
            {getApplicationDisplayName(row.original)} (
            {differenceInYears(
              new Date(),
              parseDateOnly(row.original.dateOfBirth),
            )}
            )
          </Link>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      size: 220,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {row.original.email}
        </span>
      ),
    },
    {
      id: "location",
      header: "Region / city",
      size: 240,
      cell: ({ row }) => (
        <span
          className="block truncate text-muted-foreground"
          title={`${row.original.cityAndPostalCode} - ${row.original.residenceRegion}`}
        >
          {row.original.cityAndPostalCode} - {row.original.residenceRegion}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 140,
      cell: ({ row }) => (
        <Badge
          variant={getMembershipApplicationStatusVariant(row.original.status)}
        >
          {membershipApplicationStatusLabels[row.original.status]}
        </Badge>
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
      id: "actions",
      header: "Actions",
      size: canDelete ? 172 : 96,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button asChild size="xs" variant="outline">
            <Link
              href={buildMembershipApplicationDetailsHref(
                row.original.id,
                queryString,
              )}
              prefetch={false}
            >
              View
            </Link>
          </Button>
          {canDelete ? (
            <DeleteMembershipApplicationDialog row={row.original} />
          ) : null}
        </div>
      ),
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: rows,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });
  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);
  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    estimateSize: () => 48,
    getScrollElement: () => scrollContainerRef.current,
    overscan: 8,
  });
  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;
  const handleBulkSuccess = (message: string) => {
    setFeedback({
      kind: "success",
      message,
    });
    setRowSelection({});
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Applications queue</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-4">
            {feedback ? (
              <p
                className={
                  feedback.kind === "error"
                    ? "text-xs font-medium text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {feedback.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {selectedCount
                  ? `${selectedCount} selected`
                  : "Select applications to use bulk actions."}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <BulkMembershipApplicationActionDialog
              action="approve"
              disabled={!hasSelection}
              onSuccess={handleBulkSuccess}
              rows={selectedRows}
            >
              <Button disabled={!hasSelection} size="xs" type="button">
                Approve
              </Button>
            </BulkMembershipApplicationActionDialog>
            <BulkMembershipApplicationActionDialog
              action="reject"
              disabled={!hasSelection}
              onSuccess={handleBulkSuccess}
              rows={selectedRows}
            >
              <Button
                disabled={!hasSelection}
                size="xs"
                type="button"
                variant="destructive"
              >
                Reject
              </Button>
            </BulkMembershipApplicationActionDialog>
            <BulkMembershipApplicationActionDialog
              action="pending"
              disabled={!hasSelection}
              onSuccess={handleBulkSuccess}
              rows={selectedRows}
            >
              <Button
                disabled={!hasSelection}
                size="xs"
                type="button"
                variant="outline"
              >
                Set pending
              </Button>
            </BulkMembershipApplicationActionDialog>
            {canDelete ? (
              <BulkMembershipApplicationActionDialog
                action="delete"
                disabled={!hasSelection}
                onSuccess={handleBulkSuccess}
                rows={selectedRows}
              >
                <Button
                  disabled={!hasSelection}
                  size="xs"
                  type="button"
                  variant="destructive"
                >
                  Delete
                </Button>
              </BulkMembershipApplicationActionDialog>
            ) : null}
          </div>
        </div>
        <TableScrollContainer
          className="max-h-[calc(100dvh-28rem)]"
          ref={scrollContainerRef}
        >
          <Table
            className="table-fixed"
            style={{ width: table.getTotalSize() }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
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
            <TableBody
              style={
                tableRows.length
                  ? {
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: "relative",
                    }
                  : undefined
              }
            >
              {tableRows.length ? (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = tableRows[virtualRow.index];

                  return (
                    <TableRow
                      key={row.id}
                      style={{
                        position: "absolute",
                        transform: `translateY(${virtualRow.start}px)`,
                        width: table.getTotalSize(),
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    className="h-48 text-center text-muted-foreground"
                    colSpan={columns.length}
                  >
                    No applications match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
        {tableRows.length ? (
          <div className="flex flex-col gap-3 border-t p-4 text-xs md:flex-row md:items-center md:justify-between">
            <span className="text-muted-foreground">
              {totalCount} total · Page {page} of {pageCount}
            </span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-muted-foreground">
                <span>Per page</span>
                <select
                  className="h-8 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  onChange={(event) => {
                    const option = pageSizeOptions.find(
                      ({ value }) => value === Number(event.target.value),
                    );
                    if (option) router.push(option.href);
                  }}
                  value={String(pageSize)}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href={previousPageHref}>Previous</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={nextPageHref}>Next</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
