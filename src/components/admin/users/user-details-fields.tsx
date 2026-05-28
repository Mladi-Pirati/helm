"use client";

import type { UserRole } from "@/db/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

type UserDetailsValues = {
  role: UserRole;
};

type UserDetailsFieldsProps<TValues extends FieldValues & UserDetailsValues> = {
  form: UseFormReturn<TValues>;
  roleDescription?: string;
  roleDisabled?: boolean;
};

export function UserDetailsFields<
  TValues extends FieldValues & UserDetailsValues,
>({
  form,
  roleDescription,
  roleDisabled = false,
}: UserDetailsFieldsProps<TValues>) {
  return (
    <FormField
      control={form.control}
      name={"role" as FieldPath<TValues>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Role</FormLabel>
          <Select
            disabled={roleDisabled}
            onValueChange={field.onChange}
            value={field.value}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="viewer">viewer</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          {roleDescription ? (
            <FormDescription>{roleDescription}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
