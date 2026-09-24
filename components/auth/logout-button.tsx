"use client";

import { useState, type ReactNode } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { signOut } from "@/app/actions/auth";

/** Asks before signing out; signOut() redirects to the login page. */
export function LogoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ConfirmationDialog
      open={open}
      onClose={onClose}
      tone="warning"
      title="Log out?"
      message="Are you sure you want to log out? You will need to sign in again to continue."
      confirmLabel="Log out"
      onConfirm={async () => { await signOut(); }}
    />
  );
}

export function LogoutButton({ className, title, role, children }: { className?: string; title?: string; role?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" role={role} title={title} className={className} onClick={() => setOpen(true)}>{children}</button>
      <LogoutDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
