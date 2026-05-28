"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { createPermissionAction } from "@/actions/permissions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createPermissionSchema,
  type CreatePermissionInput,
} from "@/lib/validation/permissions";

type ModuleOption = {
  id: string;
  name: string;
};

const defaultValues: CreatePermissionInput = {
  moduleId: "",
  action: "",
  description: "",
};

export function AddPermissionSheet({ modules }: { modules: ModuleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<CreatePermissionInput>({
    resolver: zodResolver(createPermissionSchema),
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
      const result = await createPermissionAction(values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof CreatePermissionInput, { message });
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
        description="Create a new permission. The key is auto-generated from the module and action."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Creating..."
        serverMessage={serverMessage}
        submitLabel="Create permission"
        title="Add permission"
        trigger={<Button>Add permission</Button>}
      >
        <FormField
          control={form.control}
          name="moduleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Module</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="action"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action</FormLabel>
              <FormControl>
                <Input
                  placeholder="create, read, update, delete"
                  {...field}
                />
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
                <Textarea
                  placeholder="Optional description..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
