"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { updateNewsletterAction } from "@/actions/newsletters";
import { NewsletterDetailsFields } from "@/components/admin/newsletters/newsletter-details-fields";
import { NewsletterFormSheet } from "@/components/admin/newsletters/newsletter-form-sheet";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  type UpdateNewsletterInput,
  updateNewsletterSchema,
} from "@/lib/validation/newsletters";

type EditableNewsletter = {
  name: string;
  slug: string;
  description: string;
};

export function EditNewsletterSheet({ newsletter }: { newsletter: EditableNewsletter }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const defaultValues: UpdateNewsletterInput = {
    name: newsletter.name,
    description: newsletter.description,
  };
  const form = useForm<UpdateNewsletterInput>({
    resolver: zodResolver(updateNewsletterSchema),
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
      const result = await updateNewsletterAction(newsletter.slug, values);

      if (!result.ok) {
        setServerMessage(result.message);

        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof UpdateNewsletterInput, {
                message,
              });
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
      <NewsletterFormSheet
        description="Update the display details for this newsletter. The public slug stays unchanged."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Saving..."
        serverMessage={serverMessage}
        submitLabel="Save changes"
        title="Edit newsletter"
        trigger={
          <Button size="xs" type="button" variant="outline">
            Edit
          </Button>
        }
      >
        <NewsletterDetailsFields form={form} />
      </NewsletterFormSheet>
    </Form>
  );
}
