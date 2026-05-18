"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { createNewsletterAction } from "@/actions/newsletters";
import { NewsletterDetailsFields } from "@/components/admin/newsletters/newsletter-details-fields";
import { NewsletterFormSheet } from "@/components/admin/newsletters/newsletter-form-sheet";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { createNewsletterSlug } from "@/lib/newsletters";
import {
  createNewsletterSchema,
  type CreateNewsletterInput,
} from "@/lib/validation/newsletters";

const defaultValues: CreateNewsletterInput = {
  name: "",
  slug: "",
  description: "",
};

export function AddNewsletterSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<CreateNewsletterInput>({
    resolver: zodResolver(createNewsletterSchema),
    defaultValues,
  });
  const nameValue = useWatch({
    control: form.control,
    name: "name",
  });

  React.useEffect(() => {
    if (!slugEdited) {
      form.setValue("slug", createNewsletterSlug(nameValue ?? ""), {
        shouldValidate: Boolean(nameValue),
      });
    }
  }, [form, nameValue, slugEdited]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setSlugEdited(false);
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();

    startTransition(async () => {
      const result = await createNewsletterAction(values);

      if (!result.ok) {
        setServerMessage(result.message);

        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof CreateNewsletterInput, {
                message,
              });
            }
          }
        }

        return;
      }

      handleOpenChange(false);
      router.push(`/admin/newsletters/${result.newsletterSlug}`);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <NewsletterFormSheet
        description="Create a newsletter list for collecting public email signups."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Creating..."
        serverMessage={serverMessage}
        submitLabel="Create newsletter"
        title="Add newsletter"
        trigger={<Button>Add newsletter</Button>}
      >
        <NewsletterDetailsFields
          form={form}
          onSlugChange={() => setSlugEdited(true)}
          showSlug
        />
      </NewsletterFormSheet>
    </Form>
  );
}
