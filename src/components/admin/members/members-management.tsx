"use client";

import * as React from "react";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowDownAZIcon,
  ArrowUpZAIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FilterIcon,
  PlusIcon,
} from "lucide-react";

import {
  createMemberAction,
  searchKeycloakUsersAction,
} from "@/actions/members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSlovenianDateTime } from "@/lib/date-format";
import {
  NO_ROLES_MEMBER_ROLE_FILTER,
  buildMembersFilterHref,
  buildMembersSortHref,
  type MemberListStatus,
  type MembersListFilters,
} from "@/lib/members";
import { cn } from "@/lib/utils";

export type MemberRoleBadge = {
  id: string;
  key: string;
  name: string;
};

export type MemberListRow = {
  currentMembership: {
    expiresAt: string | null;
    extendedAt: string;
  } | null;
  disabledAt: string | null;
  firstName: string;
  id: string;
  keycloakId: string;
  lastName: string;
  primaryEmail: string | null;
  roles: MemberRoleBadge[];
  updatedAt: string;
  username: string;
};

export type KeycloakUserOption = {
  email: string | null;
  enabled: boolean;
  firstName: string | null;
  fullName: string;
  id: string;
  lastName: string | null;
  username: string;
};

type PageSizeOption = {
  href: string;
  value: number;
};

type RoleOption = {
  id: string;
  name: string;
};

function formatMembership(value: MemberListRow["currentMembership"]) {
  if (!value) return "No active membership";
  if (!value.expiresAt) return "Indefinite";
  return formatSlovenianDateTime(new Date(value.expiresAt));
}

function getStatusSelection(status: MemberListStatus) {
  return {
    active: status === "active" || status === "all",
    disabled: status === "disabled" || status === "all",
  };
}

function getStatusFromSelection(selection: {
  active: boolean;
  disabled: boolean;
}): MemberListStatus {
  if (selection.active && !selection.disabled) return "active";
  if (!selection.active && selection.disabled) return "disabled";
  return "all";
}

function toggleSelectedValue(
  values: string[],
  value: string,
  checked: boolean,
) {
  if (checked) return values.includes(value) ? values : [...values, value];
  return values.filter((currentValue) => currentValue !== value);
}

function FilterIconButton({
  active,
  className,
  label,
  ...props
}: {
  active: boolean;
  label: string;
} & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button
      aria-label={label}
      className={cn(
        "relative text-muted-foreground data-[filter-active=true]:text-foreground data-[filter-active=true]:after:absolute data-[filter-active=true]:after:top-1 data-[filter-active=true]:after:right-1 data-[filter-active=true]:after:size-1 data-[filter-active=true]:after:bg-primary",
        className,
      )}
      data-filter-active={active}
      size="icon-xs"
      type="button"
      variant="ghost"
      {...props}
    >
      <FilterIcon className="size-3" />
    </Button>
  );
}

function AddMemberSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] =
    useState<KeycloakUserOption | null>(null);
  const [memberForm, setMemberForm] = useState({
    firstName: "",
    lastName: "",
    notes: "",
    primaryEmail: "",
    username: "",
  });
  const [users, setUsers] = useState<KeycloakUserOption[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchIdRef = useRef(0);
  const [isSearching, startSearchTransition] = useTransition();
  const [isPending, startTransition] = useTransition();

  function handleSearchChange(nextQuery: string) {
    setQuery(nextQuery);
    const searchId = searchIdRef.current + 1;
    searchIdRef.current = searchId;

    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery.length < 2) {
      setUsers([]);
      return;
    }

    startSearchTransition(async () => {
      const result = await searchKeycloakUsersAction(trimmedQuery);
      if (searchIdRef.current !== searchId) return;

      if (result.ok) {
        setUsers(result.users);
      } else {
        setServerMessage(result.message);
      }
    });
  }

  function reset() {
    searchIdRef.current += 1;
    setQuery("");
    setSelectedUser(null);
    setMemberForm({
      firstName: "",
      lastName: "",
      notes: "",
      primaryEmail: "",
      username: "",
    });
    setUsers([]);
    setServerMessage(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) {
      setServerMessage("Choose a Keycloak user first.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setServerMessage(null);
    startTransition(async () => {
      const result = await createMemberAction({
        firstName: String(formData.get("firstName") ?? ""),
        keycloakId: selectedUser.id,
        lastName: String(formData.get("lastName") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        primaryEmail: String(formData.get("primaryEmail") ?? ""),
        username: String(formData.get("username") ?? ""),
      });

      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }

      reset();
      setOpen(false);
      router.push(`/admin/members/${result.memberId}`);
      router.refresh();
    });
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button type="button">
          <PlusIcon />
          Add member
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Add member</SheetTitle>
          <SheetDescription>
            Search Keycloak and create a linked local member record.
          </SheetDescription>
        </SheetHeader>
        <form className="grid gap-4 p-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-xs font-medium" htmlFor="keycloak-search">
              Keycloak user
            </label>
            <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="justify-between"
                  type="button"
                  variant="outline"
                >
                  {selectedUser
                    ? `${selectedUser.fullName} (@${selectedUser.username})`
                    : "Search Keycloak users"}
                  <ChevronsUpDownIcon className="size-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-96 p-2">
                <Input
                  autoComplete="off"
                  id="keycloak-search"
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search by name, username, or email"
                  value={query}
                />
                <div className="mt-2 grid max-h-72 gap-1 overflow-y-auto">
                  {isSearching ? (
                    <>
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                    </>
                  ) : null}
                  {!isSearching && users.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Enter at least two characters to search.
                    </p>
                  ) : null}
                  {users.map((user) => (
                    <button
                      className="grid gap-0.5 rounded-none px-2 py-2 text-left text-xs hover:bg-muted"
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setMemberForm({
                          firstName: user.firstName ?? "",
                          lastName: user.lastName ?? "",
                          notes: "",
                          primaryEmail: user.email ?? "",
                          username: user.username,
                        });
                        setPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {selectedUser?.id === user.id ? (
                          <CheckIcon className="size-3" />
                        ) : null}
                        {user.fullName}
                      </span>
                      <span className="text-muted-foreground">
                        @{user.username}
                        {user.email ? ` - ${user.email}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              onChange={(event) =>
                setMemberForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              value={memberForm.firstName}
              name="firstName"
              placeholder="First name"
              required
            />
            <Input
              onChange={(event) =>
                setMemberForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              value={memberForm.lastName}
              name="lastName"
              placeholder="Last name"
              required
            />
          </div>
          <Input
            onChange={(event) =>
              setMemberForm((current) => ({
                ...current,
                username: event.target.value,
              }))
            }
            value={memberForm.username}
            name="username"
            placeholder="Username"
            required
          />
          <Input
            onChange={(event) =>
              setMemberForm((current) => ({
                ...current,
                primaryEmail: event.target.value,
              }))
            }
            value={memberForm.primaryEmail}
            name="primaryEmail"
            placeholder="Primary email"
            required
            type="email"
          />
          <Input
            name="notes"
            onChange={(event) =>
              setMemberForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Notes"
            value={memberForm.notes}
          />

          <SheetFooter className="border-t px-0 pb-0">
            {serverMessage ? (
              <p className="flex-1 text-xs font-medium text-destructive">
                {serverMessage}
              </p>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending ? "Creating..." : "Create member"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function StatusFilterDialog({
  filters,
}: {
  filters: MembersListFilters;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(() =>
    getStatusSelection(filters.status),
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setSelection(getStatusSelection(filters.status));
  }

  function applyFilter() {
    router.replace(
      buildMembersFilterHref(filters, {
        status: getStatusFromSelection(selection),
      }),
      { scroll: false },
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <FilterIconButton
          active={filters.status !== "active"}
          label="Filter members by status"
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter by status</DialogTitle>
          <DialogDescription>
            Choose which member statuses should appear in the table.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label
            className="flex items-center gap-2 text-xs"
            htmlFor="members-status-active"
          >
            <Checkbox
              checked={selection.active}
              id="members-status-active"
              onCheckedChange={(checked) =>
                setSelection((current) => ({
                  ...current,
                  active: checked === true,
                }))
              }
            />
            Active
          </label>
          <label
            className="flex items-center gap-2 text-xs"
            htmlFor="members-status-disabled"
          >
            <Checkbox
              checked={selection.disabled}
              id="members-status-disabled"
              onCheckedChange={(checked) =>
                setSelection((current) => ({
                  ...current,
                  disabled: checked === true,
                }))
              }
            />
            Disabled
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={applyFilter} type="button">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesFilterDialog({
  filters,
  roleOptions,
}: {
  filters: MembersListFilters;
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState(filters.roleId);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setSelectedRoleIds(filters.roleId);
  }

  function applyFilter() {
    router.replace(
      buildMembersFilterHref(filters, {
        roleId: selectedRoleIds,
      }),
      { scroll: false },
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <FilterIconButton
          active={filters.roleId.length > 0}
          label="Filter members by role"
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter by roles</DialogTitle>
          <DialogDescription>
            Choose one or more role states to include in the table.
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "grid gap-2",
            roleOptions.length > 12
              ? "max-h-[70vh] overflow-y-auto pr-1"
              : "overflow-visible",
          )}
        >
          <label
            className="flex items-center gap-2 text-xs"
            htmlFor="members-role-none"
          >
            <Checkbox
              checked={selectedRoleIds.includes(NO_ROLES_MEMBER_ROLE_FILTER)}
              id="members-role-none"
              onCheckedChange={(checked) =>
                setSelectedRoleIds((current) =>
                  toggleSelectedValue(
                    current,
                    NO_ROLES_MEMBER_ROLE_FILTER,
                    checked === true,
                  ),
                )
              }
            />
            No roles
          </label>
          {roleOptions.map((role) => (
            <label
              className="flex items-center gap-2 text-xs"
              htmlFor={`members-role-${role.id}`}
              key={role.id}
            >
              <Checkbox
                checked={selectedRoleIds.includes(role.id)}
                id={`members-role-${role.id}`}
                onCheckedChange={(checked) =>
                  setSelectedRoleIds((current) =>
                    toggleSelectedValue(current, role.id, checked === true),
                  )
                }
              />
              {role.name}
            </label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={applyFilter} type="button">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersManagement({
  canCreate,
  filters,
  nextPageHref,
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
  previousPageHref,
  rows,
  roleOptions,
  totalCount,
}: {
  canCreate: boolean;
  filters: MembersListFilters;
  nextPageHref: string;
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: PageSizeOption[];
  previousPageHref: string;
  rows: MemberListRow[];
  roleOptions: RoleOption[];
  totalCount: number;
}) {
  const router = useRouter();
  const columns: ColumnDef<MemberListRow>[] = [
    {
      id: "member",
      header: () => {
        const SortIcon =
          filters.sort === "name-asc" ? ArrowDownAZIcon : ArrowUpZAIcon;

        return (
          <Button asChild className="-ml-2" size="sm" variant="ghost">
            <Link href={buildMembersSortHref(filters)} scroll={false}>
              Member
              <SortIcon className="size-3.5 text-muted-foreground" />
            </Link>
          </Button>
        );
      },
      size: 240,
      cell: ({ row }) => {
        const fullName =
          `${row.original.firstName} ${row.original.lastName}`.trim();

        return (
          <div className="min-w-0">
            <Link
              className="block truncate font-medium text-foreground hover:underline"
              href={`/admin/members/${row.original.id}`}
            >
              {fullName || row.original.username}
            </Link>
            <p className="truncate text-muted-foreground">
              @{row.original.username}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "primaryEmail",
      header: "Email",
      size: 220,
      cell: ({ row }) => (
        <span className="block truncate text-muted-foreground">
          {row.original.primaryEmail ?? "No email"}
        </span>
      ),
    },
    {
      id: "status",
      header: () => (
        <div className="flex items-center gap-1.5">
          <span>Status</span>
          <StatusFilterDialog filters={filters} />
        </div>
      ),
      size: 150,
      cell: ({ row }) =>
        row.original.disabledAt ? (
          <Badge variant="outline">Disabled</Badge>
        ) : (
          <Badge>Active</Badge>
        ),
    },
    {
      id: "roles",
      header: () => (
        <div className="flex items-center gap-1.5">
          <span>Roles</span>
          <RolesFilterDialog filters={filters} roleOptions={roleOptions} />
        </div>
      ),
      size: 260,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-wrap gap-1">
          {row.original.roles.length ? (
            row.original.roles.slice(0, 3).map((role) => (
              <Badge key={role.id} variant="outline">
                {role.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">No roles</span>
          )}
        </div>
      ),
    },
    {
      id: "membership",
      header: "Membership",
      size: 180,
      cell: ({ row }) => (
        <span
          className={cn(
            "block truncate",
            row.original.currentMembership
              ? "text-foreground"
              : "text-muted-foreground",
          )}
          title={row.original.currentMembership?.expiresAt ?? undefined}
        >
          {formatMembership(row.original.currentMembership)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      size: 96,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button asChild size="xs" variant="outline">
            <Link href={`/admin/members/${row.original.id}`}>Open</Link>
          </Button>
        </div>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Members</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {totalCount} total
            </span>
            {canCreate ? <AddMemberSheet /> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={
                        cell.column.id === "roles"
                          ? "whitespace-normal"
                          : undefined
                      }
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-48 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  No members match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {table.getRowModel().rows.length ? (
          <div className="flex flex-col gap-3 border-t p-4 text-xs md:flex-row md:items-center md:justify-between">
            <span className="text-muted-foreground">
              Page {page} of {pageCount}
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
