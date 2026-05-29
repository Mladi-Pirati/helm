"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { createRoleAction } from "@/actions/roles";
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
  createRoleSchema,
  type CreateRoleInput,
} from "@/lib/validation/roles";

const defaultValues: CreateRoleInput = {
  key: "",
  name: "",
  description: "",
  rank: 1,
};

export function AddRoleSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
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
      const result = await createRoleAction(values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof CreateRoleInput, { message });
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
        description="Create a new role. Rank determines hierarchy (lower = higher priority)."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Creating..."
        serverMessage={serverMessage}
        submitLabel="Create role"
        title="Add role"
        trigger={<Button>Add role</Button>}
      >
        <FormField
          control={form.control}
          name="key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Key</FormLabel>
              <FormControl>
                <Input placeholder="admin, moderator, member" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Admin" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rank</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value),
                    )
                  }
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
