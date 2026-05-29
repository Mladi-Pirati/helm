"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { updateModuleAction } from "@/actions/modules";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
    <Form {...form}>
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
          <label className="text-sm font-medium">Key</label>
          <Input disabled value={module.key} />
          <p className="text-xs text-muted-foreground">
            Module keys cannot be changed.
          </p>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
