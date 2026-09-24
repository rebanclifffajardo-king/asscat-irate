"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useServerAction, formValues } from "@/lib/hooks/use-server-action";
import { updateMyProfile, uploadMyAvatar } from "@/app/actions/profile";

export function AvatarUpload() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload profile picture"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) { toast.error("Image must be 2 MB or smaller."); return; }
          const fd = new FormData();
          fd.set("avatar", f);
          startTransition(async () => {
            const res = await uploadMyAvatar(fd);
            if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.error);
            if (ref.current) ref.current.value = "";
          });
        }} />
      <Button variant="secondary" size="sm" loading={pending} onClick={() => ref.current?.click()}>
        {!pending && <Camera className="h-4 w-4" />} Change picture
      </Button>
    </>
  );
}

export function AdminNameForm({ first, middle, last }: { first: string; middle: string; last: string }) {
  const { run, pending, fieldErrors: fe } = useServerAction(updateMyProfile);
  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); run(formValues(e.currentTarget)); }}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First name" htmlFor="first_name" error={fe.first_name} required><Input id="first_name" name="first_name" defaultValue={first} maxLength={100} aria-describedby="first_name-msg" /></Field>
        <Field label="Middle name" htmlFor="middle_name" error={fe.middle_name}><Input id="middle_name" name="middle_name" defaultValue={middle} maxLength={100} aria-describedby="middle_name-msg" /></Field>
        <Field label="Last name" htmlFor="last_name" error={fe.last_name} required><Input id="last_name" name="last_name" defaultValue={last} maxLength={100} aria-describedby="last_name-msg" /></Field>
      </div>
      <Button type="submit" loading={pending}>{!pending && <Save className="h-4 w-4" />} Save profile</Button>
    </form>
  );
}
