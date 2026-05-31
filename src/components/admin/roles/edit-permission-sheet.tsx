"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { updatePermissionAction } from "@/actions/permissions";
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
  updatePermissionSchema,
  type UpdatePermissionInput,
} from "@/lib/validation/permissions";

type EditablePermission = {
  id: string;
  key: string;
  action: string;
  moduleName: string;
  description: string | null;
};

export function EditPermissionSheet({
  permission,
}: {
  permission: EditablePermission;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultValues: UpdatePermissionInput = {
    description: permission.description ?? "",
  };
  const form = useForm<UpdatePermissionInput>({
    resolver: zodResolver(updatePermissionSchema),
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
      const result = await updatePermissionAction(permission.id, values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof UpdatePermissionInput, { message });
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
        description={`Update ${permission.key}. Module and action cannot be changed.`}
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Saving..."
        serverMessage={serverMessage}
        submitLabel="Save changes"
        title="Edit permission"
        trigger={
          <Button size="xs" type="button" variant="outline">
            Edit
          </Button>
        }
      >
        <div className="grid gap-1">
          <label className="text-sm font-medium">Key</label>
          <Input disabled value={permission.key} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Module</label>
          <Input disabled value={permission.moduleName} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Action</label>
          <Input disabled value={permission.action} />
        </div>
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
