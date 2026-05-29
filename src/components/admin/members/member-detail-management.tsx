"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVerticalIcon, RotateCwIcon } from "lucide-react";

import {
  appendMembershipRenewalAction,
  deleteAddressAction,
  deleteContactAction,
  endMembershipAction,
  reorderContactsAction,
  setMemberDisabledAction,
  syncMemberFromKeycloakAction,
  updateMemberProfileAction,
  updateMemberRolesAction,
  upsertAddressAction,
  upsertContactAction,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ADDRESS_LABELS, CONTACT_TYPES, type AddressLabel, type ContactType } from "@/db/schema";
import { formatSlovenianDateTime } from "@/lib/date-format";
import { cn } from "@/lib/utils";

type RoleOption = {
  id: string;
  key: string;
  name: string;
};

type AssignedRole = RoleOption & {
  expiresAt: string | null;
};

type ContactRow = {
  id: string;
  isPrimary: boolean;
  label: string | null;
  sortOrder: number;
  type: ContactType;
  value: string;
};

type AddressRow = {
  city: string;
  country: string;
  id: string;
  label: AddressLabel;
  postalCode: string;
  street: string;
};

type MembershipRow = {
  endedAt: string | null;
  expiresAt: string | null;
  extendedAt: string;
  id: string;
};

type MemberDetail = {
  disabledAt: string | null;
  firstName: string;
  id: string;
  keycloakId: string;
  lastName: string;
  notes: string | null;
  primaryEmail: string;
  username: string;
};

function dateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function Message({ value }: { value: string | null }) {
  if (!value) return null;
  return <p className="text-xs font-medium text-muted-foreground">{value}</p>;
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}

function ProfileTab({
  canUpdate,
  member,
}: {
  canUpdate: boolean;
  member: MemberDetail;
}) {
  const router = useRouter();
  const [profileForm, setProfileForm] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    notes: member.notes ?? "",
    primaryEmail: member.primaryEmail,
    username: member.username,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateMemberProfileAction(member.id, {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        notes: profileForm.notes,
        primaryEmail: profileForm.primaryEmail,
        username: profileForm.username,
      });
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  function sync() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncMemberFromKeycloakAction(member.id);
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  function toggleDisabled() {
    setMessage(null);
    startTransition(async () => {
      const result = await setMemberDisabledAction(member.id, !member.disabledAt);
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-bold">Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 p-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <label className="text-xs font-medium">First name</label>
              <Input
                disabled={!canUpdate}
                name="firstName"
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
                required
                value={profileForm.firstName}
              />
            </Field>
            <Field>
              <label className="text-xs font-medium">Last name</label>
              <Input
                disabled={!canUpdate}
                name="lastName"
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
                required
                value={profileForm.lastName}
              />
            </Field>
          </div>
          <Field>
            <label className="text-xs font-medium">Username</label>
            <Input
              disabled={!canUpdate}
              name="username"
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              required
              value={profileForm.username}
            />
          </Field>
          <Field>
            <label className="text-xs font-medium">Primary email</label>
            <Input
              disabled={!canUpdate}
              name="primaryEmail"
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  primaryEmail: event.target.value,
                }))
              }
              required
              type="email"
              value={profileForm.primaryEmail}
            />
          </Field>
          <Field>
            <label className="text-xs font-medium">Notes</label>
            <Textarea
              disabled={!canUpdate}
              name="notes"
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              value={profileForm.notes}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button disabled={!canUpdate || isPending} type="submit">
              {isPending ? "Saving..." : "Save profile"}
            </Button>
            <Button
              disabled={!canUpdate || isPending}
              onClick={sync}
              type="button"
              variant="outline"
            >
              <RotateCwIcon />
              Sync from Keycloak
            </Button>
            <Button
              disabled={!canUpdate || isPending}
              onClick={toggleDisabled}
              type="button"
              variant={member.disabledAt ? "outline" : "destructive"}
            >
              {member.disabledAt ? "Re-enable member" : "Disable member"}
            </Button>
            <Message value={message} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SortableContactRow({
  canUpdate,
  contact,
  index,
  memberId,
  onDeleted,
}: {
  canUpdate: boolean;
  contact: ContactRow;
  index: number;
  memberId: string;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const { handleRef, ref, isDragging } = useSortable({
    id: contact.id,
    index,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await upsertContactAction(
        memberId,
        {
          isPrimary: formData.get("isPrimary") === "on",
          label: String(formData.get("label") ?? ""),
          type: String(formData.get("type") ?? contact.type) as ContactType,
          value: String(formData.get("value") ?? ""),
        },
        contact.id,
      );
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteContactAction(memberId, contact.id);
      setMessage(result.message ?? null);
      if (result.ok) {
        onDeleted();
        router.refresh();
      }
    });
  }

  return (
    <form
      className={cn(
        "grid gap-2 border-b p-3 md:grid-cols-[auto_120px_minmax(0,1fr)_120px_auto_auto] md:items-center",
        isDragging && "opacity-60",
      )}
      onSubmit={save}
      ref={ref}
    >
      <button
        className="flex size-8 items-center justify-center border text-muted-foreground"
        disabled={!canUpdate}
        ref={handleRef}
        type="button"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <Select defaultValue={contact.type} name="type">
        <SelectTrigger disabled={!canUpdate}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTACT_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input defaultValue={contact.value} disabled={!canUpdate} name="value" />
      <Input
        defaultValue={contact.label ?? ""}
        disabled={!canUpdate}
        name="label"
        placeholder="Label"
      />
      <label className="flex items-center gap-2 text-xs">
        <input
          defaultChecked={contact.isPrimary}
          disabled={!canUpdate}
          name="isPrimary"
          type="checkbox"
        />
        Primary
      </label>
      <div className="flex gap-2 md:justify-end">
        <Button disabled={!canUpdate || isPending} size="xs" type="submit">
          Save
        </Button>
        <Button
          disabled={!canUpdate || isPending}
          onClick={remove}
          size="xs"
          type="button"
          variant="destructive"
        >
          Delete
        </Button>
      </div>
      <div className="md:col-span-6">
        <Message value={message} />
      </div>
    </form>
  );
}

function ContactsTab({
  canUpdate,
  contacts: initialContacts,
  memberId,
}: {
  canUpdate: boolean;
  contacts: ContactRow[];
  memberId: string;
}) {
  const router = useRouter();
  const [contactsState, setContactsState] = useState(initialContacts);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await upsertContactAction(memberId, {
        isPrimary: formData.get("isPrimary") === "on",
        label: String(formData.get("label") ?? ""),
        type: String(formData.get("type") ?? "email") as ContactType,
        value: String(formData.get("value") ?? ""),
      });
      setMessage(result.message ?? null);
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-bold">Contacts</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) return;
            const next = move(contactsState, event) as ContactRow[];
            setContactsState(next);
            startTransition(async () => {
              const result = await reorderContactsAction(
                memberId,
                next.map((contact) => contact.id),
              );
              setMessage(result.message ?? null);
              if (result.ok) router.refresh();
            });
          }}
        >
          {contactsState.map((contact, index) => (
            <SortableContactRow
              canUpdate={canUpdate}
              contact={contact}
              index={index}
              key={contact.id}
              memberId={memberId}
              onDeleted={() =>
                setContactsState((current) =>
                  current.filter((row) => row.id !== contact.id),
                )
              }
            />
          ))}
        </DragDropProvider>
        <form className="grid gap-2 p-4 md:grid-cols-[140px_minmax(0,1fr)_140px_auto_auto] md:items-center" onSubmit={add}>
          <Select defaultValue="email" name="type">
            <SelectTrigger disabled={!canUpdate}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input disabled={!canUpdate} name="value" placeholder="Value" />
          <Input disabled={!canUpdate} name="label" placeholder="Label" />
          <label className="flex items-center gap-2 text-xs">
            <input disabled={!canUpdate} name="isPrimary" type="checkbox" />
            Primary
          </label>
          <Button disabled={!canUpdate || isPending} type="submit">
            Add contact
          </Button>
          <div className="md:col-span-5">
            <Message value={message} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AddressesTab({
  addresses: rows,
  canUpdate,
  memberId,
}: {
  addresses: AddressRow[];
  canUpdate: boolean;
  memberId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>, addressId?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await upsertAddressAction(
        memberId,
        {
          city: String(formData.get("city") ?? ""),
          country: String(formData.get("country") ?? ""),
          label: String(formData.get("label") ?? "primary") as AddressLabel,
          postalCode: String(formData.get("postalCode") ?? ""),
          street: String(formData.get("street") ?? ""),
        },
        addressId,
      );
      setMessage(result.message ?? null);
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  function remove(addressId: string) {
    startTransition(async () => {
      const result = await deleteAddressAction(memberId, addressId);
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-bold">Addresses</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        {rows.map((address) => (
          <form
            className="grid gap-2 border p-3 md:grid-cols-[130px_minmax(0,1fr)_120px_140px_120px_auto]"
            key={address.id}
            onSubmit={(event) => submit(event, address.id)}
          >
            <Select defaultValue={address.label} name="label">
              <SelectTrigger disabled={!canUpdate}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDRESS_LABELS.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input defaultValue={address.street} disabled={!canUpdate} name="street" />
            <Input defaultValue={address.city} disabled={!canUpdate} name="city" />
            <Input defaultValue={address.postalCode} disabled={!canUpdate} name="postalCode" />
            <Input defaultValue={address.country} disabled={!canUpdate} name="country" />
            <div className="flex gap-2">
              <Button disabled={!canUpdate || isPending} size="xs" type="submit">
                Save
              </Button>
              <Button
                disabled={!canUpdate || isPending}
                onClick={() => remove(address.id)}
                size="xs"
                type="button"
                variant="destructive"
              >
                Delete
              </Button>
            </div>
          </form>
        ))}
        <form
          className="grid gap-2 border p-3 md:grid-cols-[130px_minmax(0,1fr)_120px_140px_120px_auto]"
          onSubmit={(event) => submit(event)}
        >
          <Select defaultValue="primary" name="label">
            <SelectTrigger disabled={!canUpdate}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADDRESS_LABELS.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input disabled={!canUpdate} name="street" placeholder="Street" />
          <Input disabled={!canUpdate} name="city" placeholder="City" />
          <Input disabled={!canUpdate} name="postalCode" placeholder="Postal code" />
          <Input disabled={!canUpdate} name="country" placeholder="Country" />
          <Button disabled={!canUpdate || isPending} type="submit">
            Add address
          </Button>
        </form>
        <Message value={message} />
      </CardContent>
    </Card>
  );
}

function MembershipsTab({
  canUpdate,
  memberId,
  memberships,
}: {
  canUpdate: boolean;
  memberId: string;
  memberships: MembershipRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    endedAt?: string;
    expiresAt?: string;
    extendedAt?: string;
  }>({});
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFieldErrors({});
    startTransition(async () => {
      const result = await appendMembershipRenewalAction(memberId, {
        endedAt: String(formData.get("endedAt") ?? ""),
        expiresAt: String(formData.get("expiresAt") ?? ""),
        extendedAt: String(formData.get("extendedAt") ?? ""),
      });
      setMessage(result.message ?? null);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  function endMembership(membershipId: string) {
    startTransition(async () => {
      const result = await endMembershipAction(memberId, membershipId);
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  function formatMembershipEnd(membership: MembershipRow) {
    if (membership.endedAt) {
      return `Ended ${formatSlovenianDateTime(new Date(membership.endedAt))}`;
    }

    if (membership.expiresAt) {
      return `Expires ${formatSlovenianDateTime(new Date(membership.expiresAt))}`;
    }

    return "Indefinite";
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-bold">Memberships</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        <div className="divide-y border">
          {memberships.map((membership) => (
            <div
              className="grid gap-2 p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={membership.id}
            >
              <div className="grid gap-1 sm:grid-cols-2">
                <span>
                  Extended{" "}
                  {formatSlovenianDateTime(new Date(membership.extendedAt))}
                </span>
                <span>{formatMembershipEnd(membership)}</span>
              </div>
              {!membership.endedAt ? (
                <Button
                  disabled={!canUpdate || isPending}
                  onClick={() => endMembership(membership.id)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  End
                </Button>
              ) : null}
            </div>
          ))}
          {!memberships.length ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No membership renewals recorded.
            </div>
          ) : null}
        </div>
        <form className="flex flex-wrap items-start gap-2" onSubmit={submit}>
          <Field>
            <label className="text-xs font-medium">Extended at</label>
            <Input
              aria-invalid={Boolean(fieldErrors.extendedAt)}
              disabled={!canUpdate}
              name="extendedAt"
              type="date"
            />
            {fieldErrors.extendedAt ? (
              <p className="text-xs text-destructive">
                {fieldErrors.extendedAt}
              </p>
            ) : null}
          </Field>
          <Field>
            <label className="text-xs font-medium">Expires at</label>
            <Input
              aria-invalid={Boolean(fieldErrors.expiresAt)}
              disabled={!canUpdate}
              name="expiresAt"
              type="date"
            />
            {fieldErrors.expiresAt ? (
              <p className="text-xs text-destructive">
                {fieldErrors.expiresAt}
              </p>
            ) : null}
          </Field>
          <Field>
            <label className="text-xs font-medium">Ended at</label>
            <Input
              aria-invalid={Boolean(fieldErrors.endedAt)}
              disabled={!canUpdate}
              name="endedAt"
              type="date"
            />
            {fieldErrors.endedAt ? (
              <p className="text-xs text-destructive">{fieldErrors.endedAt}</p>
            ) : null}
          </Field>
          <div className="pt-6">
            <Button disabled={!canUpdate || isPending} type="submit">
              Add renewal
            </Button>
          </div>
        </form>
        <Message value={message} />
      </CardContent>
    </Card>
  );
}

function RolesTab({
  assignedRoles,
  canManageRoles,
  memberId,
  roles,
}: {
  assignedRoles: AssignedRole[];
  canManageRoles: boolean;
  memberId: string;
  roles: RoleOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const assignments = roles
      .filter((role) => formData.get(`role-${role.id}`) === "on")
      .map((role) => ({
        roleId: role.id,
        expiresAt: String(formData.get(`expiresAt-${role.id}`) ?? ""),
      }));

    startTransition(async () => {
      const result = await updateMemberRolesAction(memberId, assignments);
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-bold">Roles</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 p-4" onSubmit={submit}>
          {roles.map((role) => {
            const assigned = assignedRoles.find((row) => row.id === role.id);
            return (
              <div
                className="grid gap-2 border p-3 sm:grid-cols-[minmax(0,1fr)_180px]"
                key={role.id}
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    defaultChecked={Boolean(assigned)}
                    disabled={!canManageRoles}
                    name={`role-${role.id}`}
                  />
                  {role.name}
                  <span className="text-xs text-muted-foreground">
                    {role.key}
                  </span>
                </label>
                <Input
                  defaultValue={dateInputValue(assigned?.expiresAt ?? null)}
                  disabled={!canManageRoles}
                  name={`expiresAt-${role.id}`}
                  type="date"
                />
              </div>
            );
          })}
          <div className="flex items-center gap-2 border-t pt-4">
            <Button disabled={!canManageRoles || isPending} type="submit">
              Save roles
            </Button>
            <Message value={message} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MemberDetailManagement({
  addresses,
  assignedRoles,
  canManageRoles,
  canUpdate,
  contacts,
  member,
  memberships,
  roles,
}: {
  addresses: AddressRow[];
  assignedRoles: AssignedRole[];
  canManageRoles: boolean;
  canUpdate: boolean;
  contacts: ContactRow[];
  member: MemberDetail;
  memberships: MembershipRow[];
  roles: RoleOption[];
}) {
  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const profileKey = [
    member.id,
    member.firstName,
    member.lastName,
    member.notes ?? "",
    member.primaryEmail,
    member.username,
  ].join(":");
  const contactsKey = [
    member.id,
    ...contacts.map((contact) =>
      [
        contact.id,
        contact.type,
        contact.value,
        contact.label ?? "",
        contact.isPrimary ? "primary" : "secondary",
        contact.sortOrder,
      ].join(":"),
    ),
  ].join("|");

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{fullName || member.username}</h1>
            {member.disabledAt ? (
              <Badge variant="outline">Disabled</Badge>
            ) : (
              <Badge>Active</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            @{member.username} - {member.primaryEmail || "No primary email"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/members">Back to members</Link>
        </Button>
      </div>
      
      <ProfileTab canUpdate={canUpdate} key={profileKey} member={member} />

      <ContactsTab
        canUpdate={canUpdate}
        contacts={contacts}
        key={contactsKey}
        memberId={member.id}
      />

      <AddressesTab
        addresses={addresses}
        canUpdate={canUpdate}
        memberId={member.id}
      />

      <MembershipsTab
        canUpdate={canUpdate}
        memberId={member.id}
        memberships={memberships}
      />

      <RolesTab
        assignedRoles={assignedRoles}
        canManageRoles={canManageRoles}
        memberId={member.id}
        roles={roles}
      />

      {/* <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="overview">
          <ProfileTab canUpdate={canUpdate} member={member} />
        </TabsContent>
        <TabsContent className="mt-4" value="contacts">
          <ContactsTab
            canUpdate={canUpdate}
            contacts={contacts}
            memberId={member.id}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="addresses">
          <AddressesTab
            addresses={addresses}
            canUpdate={canUpdate}
            memberId={member.id}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="memberships">
          <MembershipsTab
            canUpdate={canUpdate}
            memberId={member.id}
            memberships={memberships}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="roles">
          <RolesTab
            assignedRoles={assignedRoles}
            canManageRoles={canManageRoles}
            memberId={member.id}
            roles={roles}
          />
        </TabsContent>
      </Tabs> */}
    </div>
  );
}
