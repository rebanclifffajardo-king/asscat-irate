"use client";

import { useId, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Alert } from "./alert";
import { formValues } from "@/lib/hooks/use-server-action";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  pending: boolean;
  error?: string | null;
  onSubmit: (values: Record<string, string | boolean>, form: HTMLFormElement) => void;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
};

/** Modal containing a form; the footer submit button is bound to the form by id. */
export function FormModal({ open, onClose, title, description, submitLabel, pending, error, onSubmit, size = "md", children }: Props) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form={formId} loading={pending}>{submitLabel}</Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          onSubmit(formValues(e.currentTarget), e.currentTarget);
        }}
        className="space-y-4"
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {children}
      </form>
    </Modal>
  );
}
