"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";

import { updateModuleAction } from "@/actions/modules";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateModuleSchema,
  type UpdateModuleInput,
} from "@/lib/validation/modules";

type EditableModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

export function EditModuleSheet({ module }: { module: EditableModule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultValues: UpdateModuleInput = {
    name: module.name,
    description: module.description ?? "",
  };
  const form = useForm<UpdateModuleInput>({
    resolver: zodResolver(updateModuleSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await updateModuleAction(module.id, values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof UpdateModuleInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <FormSheet
      description={`Update ${module.name}. The key cannot be changed.`}
      isPending={isPending}
      onOpenChange={handleOpenChange}
      onSubmit={onSubmit}
      open={open}
      pendingLabel="Saving..."
      serverMessage={serverMessage}
      submitLabel="Save changes"
      title="Edit module"
      trigger={
        <Button size="xs" type="button" variant="outline">
          Edit
        </Button>
      }
    >
      <div className="grid gap-1">
        <Label>Key</Label>
        <Input disabled value={module.key} />
        <p className="text-xs text-muted-foreground">
          Module keys cannot be changed.
        </p>
      </div>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Name</FieldLabel>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Description</FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              value={field.value ?? ""}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
    </FormSheet>
  );
}
