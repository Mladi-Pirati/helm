"use client";

import { useRef } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

export function FilterSelect({
  defaultValue,
  name,
  options,
  placeholder,
}: {
  defaultValue?: string;
  name: string;
  options: { label: string; value: string }[];
  placeholder: string;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const uniqueOptions = Array.from(
    new Map(options.map((option) => [option.value, option])).values(),
  );

  function applySelection(nextValue: string) {
    if (!hiddenInputRef.current) {
      return;
    }

    hiddenInputRef.current.value = nextValue === ALL_VALUE ? "" : nextValue;
    hiddenInputRef.current.form?.requestSubmit();
  }

  return (
    <>
      <input
        ref={hiddenInputRef}
        defaultValue={defaultValue ?? ""}
        key={`${name}-input-${defaultValue ?? ALL_VALUE}`}
        name={name}
        type="hidden"
      />
      <Select
        defaultValue={defaultValue || ALL_VALUE}
        key={`${name}-select-${defaultValue || ALL_VALUE}`}
        onValueChange={applySelection}
      >
        <SelectTrigger className="w-full min-w-0">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>
          {uniqueOptions.map((option) => (
            <SelectItem key={`${name}-${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
