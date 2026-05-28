"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";

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
import { formatSlovenianDateTime } from "@/lib/date-format";
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

function formatDateTime(value: string) {
  return formatSlovenianDateTime(new Date(value));
}

function formatMembership(value: MemberListRow["currentMembership"]) {
  if (!value) return "No active membership";
  if (!value.expiresAt) return "Indefinite";
  return formatSlovenianDateTime(new Date(value.expiresAt));
}

function AddMemberSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedUser, setSelectedUser] =
    React.useState<KeycloakUserOption | null>(null);
  const [memberForm, setMemberForm] = React.useState({
    firstName: "",
    lastName: "",
    notes: "",
    primaryEmail: "",
    username: "",
  });
  const [users, setUsers] = React.useState<KeycloakUserOption[]>([]);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isSearching, startSearchTransition] = React.useTransition();
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setUsers([]);
      return;
    }

    startSearchTransition(async () => {
      const result = await searchKeycloakUsersAction(query);
      if (result.ok) {
        setUsers(result.users);
      } else {
        setServerMessage(result.message);
      }
    });
  }, [open, query]);

  function reset() {
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
                  onChange={(event) => setQuery(event.target.value)}
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

export function MembersManagement({
  canCreate,
  page,
  pageCount,
  rows,
  totalCount,
}: {
  canCreate: boolean;
  page: number;
  pageCount: number;
  rows: MemberListRow[];
  totalCount: number;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 58,
    getScrollElement: () => parentRef.current,
    overscan: 8,
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
        {rows.length ? (
          <>
            <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_110px_minmax(150px,1fr)_150px_84px] border-b px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Member</span>
              <span>Email</span>
              <span>Status</span>
              <span>Roles</span>
              <span>Membership</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="overflow-auto" ref={parentRef} style={{ height: 520 }}>
              <div
                className="relative"
                style={{ height: rowVirtualizer.getTotalSize() }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  const fullName = `${row.firstName} ${row.lastName}`.trim();
                  return (
                    <div
                      className="absolute left-0 grid w-full grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_110px_minmax(150px,1fr)_150px_84px] items-center gap-3 border-b px-4 py-3 text-xs"
                      data-index={virtualRow.index}
                      key={row.id}
                      ref={rowVirtualizer.measureElement}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <div className="min-w-0">
                        <Link
                          className="block truncate font-medium text-foreground hover:underline"
                          href={`/admin/members/${row.id}`}
                        >
                          {fullName || row.username}
                        </Link>
                        <p className="truncate text-muted-foreground">
                          @{row.username}
                        </p>
                      </div>
                      <span className="truncate text-muted-foreground">
                        {row.primaryEmail ?? "No email"}
                      </span>
                      <span>
                        {row.disabledAt ? (
                          <Badge variant="outline">Disabled</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </span>
                      <div className="flex min-w-0 flex-wrap gap-1">
                        {row.roles.length ? (
                          row.roles.slice(0, 3).map((role) => (
                            <Badge key={role.id} variant="outline">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">No roles</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "truncate",
                          row.currentMembership
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                        title={row.currentMembership?.expiresAt ?? undefined}
                      >
                        {formatMembership(row.currentMembership)}
                      </span>
                      <div className="flex justify-end">
                        <Button asChild size="xs" variant="outline">
                          <Link href={`/admin/members/${row.id}`}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between border-t p-4 text-xs">
              <span className="text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <span className="text-muted-foreground">
                Updated {rows[0] ? formatDateTime(rows[0].updatedAt) : ""}
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-48 items-center justify-center px-4 text-center text-xs text-muted-foreground">
            No members match the current filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
