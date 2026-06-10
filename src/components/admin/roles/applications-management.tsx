"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, RotateCcwIcon } from "lucide-react";

import {
  createAccessApplicationAction,
  listKeycloakClientRolesAction,
  searchKeycloakClientsAction,
  setAccessApplicationArchivedAction,
  updateAccessApplicationAction,
} from "@/actions/access-applications";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateAccessApplicationInput,
  UpdateAccessApplicationInput,
} from "@/lib/validation/access-applications";

export type AccessApplicationListRow = {
  archivedAt: string | null;
  assignedMemberCount: number;
  description: string | null;
  id: string;
  keycloakClientId: string;
  keycloakRoleName: string;
  name: string;
};

type KeycloakClientOption = { clientId: string; id: string };
type KeycloakRoleOption = { id: string; name: string };
type FieldErrors = Partial<Record<keyof CreateAccessApplicationInput, string>>;

const emptyForm: CreateAccessApplicationInput = {
  description: "",
  keycloakClientId: "",
  keycloakRoleName: "",
  name: "",
};

function ApplicationFormSheet({
  application,
}: {
  application?: AccessApplicationListRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateAccessApplicationInput>(
    application
      ? {
          description: application.description ?? "",
          keycloakClientId: application.keycloakClientId,
          keycloakRoleName: application.keycloakRoleName,
          name: application.name,
        }
      : emptyForm,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [clientQuery, setClientQuery] = useState(
    application?.keycloakClientId ?? "",
  );
  const [clients, setClients] = useState<Array<KeycloakClientOption>>([]);
  const [roles, setRoles] = useState<Array<KeycloakRoleOption>>([]);
  const [isPending, startTransition] = useTransition();
  const [isLookupPending, startLookupTransition] = useTransition();

  const isEdit = Boolean(application);

  function reset() {
    const nextValues = application
      ? {
          description: application.description ?? "",
          keycloakClientId: application.keycloakClientId,
          keycloakRoleName: application.keycloakRoleName,
          name: application.name,
        }
      : emptyForm;
    setValues(nextValues);
    setClientQuery(nextValues.keycloakClientId);
    setClients([]);
    setRoles([]);
    setFieldErrors({});
    setServerMessage(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
    if (nextOpen && application?.keycloakClientId) {
      loadRoles(application.keycloakClientId);
    }
  }

  function setField<K extends keyof CreateAccessApplicationInput>(
    field: K,
    value: CreateAccessApplicationInput[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function searchClients() {
    setServerMessage(null);
    startLookupTransition(async () => {
      const result = await searchKeycloakClientsAction(clientQuery);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setClients(result.clients);
    });
  }

  function loadRoles(clientId: string) {
    setServerMessage(null);
    startLookupTransition(async () => {
      const result = await listKeycloakClientRolesAction(clientId);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setRoles(result.roles);
    });
  }

  function chooseClient(clientId: string) {
    setField("keycloakClientId", clientId);
    setField("keycloakRoleName", "");
    setClientQuery(clientId);
    loadRoles(clientId);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = application
        ? await updateAccessApplicationAction(
            application.id,
            values as UpdateAccessApplicationInput,
          )
        : await createAccessApplicationAction(values);

      if (!result.ok) {
        setServerMessage(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <FormSheet
      description={
        isEdit
          ? "Update the Keycloak client role behind this application."
          : "Create an application backed by one Keycloak client role."
      }
      isPending={isPending}
      onOpenChange={handleOpenChange}
      onSubmit={submit}
      open={open}
      pendingLabel={isEdit ? "Saving..." : "Creating..."}
      serverMessage={serverMessage}
      submitLabel={isEdit ? "Save changes" : "Create application"}
      title={isEdit ? "Edit application" : "Add application"}
      trigger={
        <Button
          size={isEdit ? "xs" : "default"}
          type="button"
          variant={isEdit ? "outline" : "default"}
        >
          {isEdit ? "Edit" : "Add application"}
        </Button>
      }
    >
      <div className="grid gap-2">
        <Label>Name</Label>
        <Input
          aria-invalid={Boolean(fieldErrors.name)}
          onChange={(event) => setField("name", event.target.value)}
          value={values.name}
        />
        {fieldErrors.name ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea
          aria-invalid={Boolean(fieldErrors.description)}
          onChange={(event) => setField("description", event.target.value)}
          value={values.description ?? ""}
        />
        {fieldErrors.description ? (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label>Keycloak client</Label>
        <div className="flex gap-2">
          <Input
            aria-invalid={Boolean(fieldErrors.keycloakClientId)}
            onChange={(event) => setClientQuery(event.target.value)}
            placeholder="Client id"
            value={clientQuery}
          />
          <Button
            disabled={isLookupPending || !clientQuery.trim()}
            onClick={searchClients}
            type="button"
            variant="outline"
          >
            Search
          </Button>
        </div>
        {fieldErrors.keycloakClientId ? (
          <p className="text-xs text-destructive">
            {fieldErrors.keycloakClientId}
          </p>
        ) : null}
        {clients.length ? (
          <div className="flex flex-wrap gap-2">
            {clients.map((client) => (
              <Button
                key={client.id}
                onClick={() => chooseClient(client.clientId)}
                size="xs"
                type="button"
                variant={
                  values.keycloakClientId === client.clientId
                    ? "default"
                    : "outline"
                }
              >
                {client.clientId}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label>Client role</Label>
        <Input disabled value={values.keycloakRoleName} />
        {fieldErrors.keycloakRoleName ? (
          <p className="text-xs text-destructive">
            {fieldErrors.keycloakRoleName}
          </p>
        ) : null}
        {roles.length ? (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Button
                key={role.id}
                onClick={() => setField("keycloakRoleName", role.name)}
                size="xs"
                type="button"
                variant={
                  values.keycloakRoleName === role.name ? "default" : "outline"
                }
              >
                {role.name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select a client to load roles.
          </p>
        )}
      </div>
    </FormSheet>
  );
}

function ArchiveApplicationButton({
  application,
}: {
  application: AccessApplicationListRow;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const archived = Boolean(application.archivedAt);

  function toggleArchived() {
    setMessage(null);
    startTransition(async () => {
      const result = await setAccessApplicationArchivedAction(
        application.id,
        !archived,
      );
      setMessage(result.message ?? null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={isPending}
        onClick={toggleArchived}
        size="xs"
        type="button"
        variant="outline"
      >
        {archived ? <RotateCcwIcon /> : <ArchiveIcon />}
        {archived ? "Restore" : "Archive"}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}

function ApplicationRows({ rows }: { rows: Array<AccessApplicationListRow> }) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No applications configured.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div
          className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          key={row.id}
        >
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{row.name}</span>
              <Badge variant={row.archivedAt ? "outline" : "default"}>
                {row.archivedAt ? "Archived" : "Active"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {row.assignedMemberCount} assigned
              </span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">{row.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{row.keycloakClientId}</span>
              <span>{row.keycloakRoleName}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {!row.archivedAt ? (
              <ApplicationFormSheet application={row} />
            ) : null}
            <ArchiveApplicationButton application={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApplicationsManagement({
  rows,
}: {
  rows: Array<AccessApplicationListRow>;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Applications</h2>
          <p className="text-xs text-muted-foreground">
            Configure Keycloak client roles that can be assigned to members.
          </p>
        </div>
        <ApplicationFormSheet />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All applications</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ApplicationRows rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
