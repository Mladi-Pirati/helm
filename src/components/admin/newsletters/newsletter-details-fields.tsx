"use client";

import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateNewsletterInput,
  UpdateNewsletterInput,
} from "@/lib/validation/newsletters";

type NewsletterDetailsFieldsProps<TValues extends UpdateNewsletterInput> = {
  form: UseFormReturn<TValues>;
  onSlugChange?: () => void;
  showSlug?: boolean;
};

export function NewsletterDetailsFields<
  TValues extends CreateNewsletterInput | UpdateNewsletterInput,
>({
  form,
  onSlugChange,
  showSlug = false,
}: NewsletterDetailsFieldsProps<TValues>) {
  return (
    <>
      <FormField
        control={form.control}
        name={"name" as never}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="legalizirajmo.si" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {showSlug ? (
        <FormField
          control={form.control}
          name={"slug" as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  placeholder="legalizirajmo-si"
                  {...field}
                  onChange={(event) => {
                    onSlugChange?.();
                    field.onChange(event);
                  }}
                />
              </FormControl>
              <FormDescription>
                Used in public signup URLs. It cannot be changed after creation.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      <FormField
        control={form.control}
        name={"description" as never}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                className="min-h-28"
                placeholder="Short internal description"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
