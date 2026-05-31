"use client";

import { useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { BulkMembershipApplicationActionDialog } from "@/components/admin/membership-applications/bulk-membership-application-action-dialog";
import { DeleteMembershipApplicationDialog } from "@/components/admin/membership-applications/delete-membership-application-dialog";
import { formatSlovenianDateTime } from "@/lib/date-format";
import {
  buildMembershipApplicationDetailsHref,
  getMembershipApplicationStatusVariant,
  membershipApplicationStatusLabels,
  participationModeLabels,
  type MembershipApplicationStatus,
  type ParticipationMode,
  type ResidenceRegion,
} from "@/lib/membership-applications";

export type MembershipApplicationListRow = {
  id: string;
  firstName: string;
  lastName: string;
  cityAndPostalCode: string;
  residenceRegion: ResidenceRegion;
  email: string;
  participationMode: ParticipationMode;
  status: MembershipApplicationStatus;
  createdAt: string;
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
  queryString,
  rows,
}: {
  canDelete: boolean;
  queryString: string;
  rows: MembershipApplicationListRow[];
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
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
          <p className="truncate font-medium text-foreground">
            {getApplicationDisplayName(row.original)}
          </p>
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
      accessorKey: "participationMode",
      header: "Participation",
      size: 180,
      cell: ({ row }) => (
        <span className="block truncate">
          {participationModeLabels[row.original.participationMode]}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 140,
      cell: ({ row }) => (
        <Badge variant={getMembershipApplicationStatusVariant(row.original.status)}>
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
        {table.getRowModel().rows.length ? (
          <Table className="table-fixed" style={{ width: table.getTotalSize() }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-extrabold" style={{ width: header.getSize() }}>
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
            No applications match the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
