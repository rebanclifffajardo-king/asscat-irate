"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Trash2 } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteOffering } from "@/app/admin/surveys/actions";

export function OfferingRowActions({ id, name, completed }: { id: string; name: string; completed: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <RowActions
        label={`Actions for ${name}`}
        items={[
          { label: "View", icon: <Eye className="h-4 w-4" />, onSelect: () => router.push(`/admin/surveys/${id}`) },
          { type: "separator" },
          { label: "Delete", icon: <Trash2 className="h-4 w-4" />, tone: "danger", onSelect: () => setConfirm(true) },
        ]}
      />
      <ConfirmationDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this subject from the survey?"
        message={
          <>
            <p>Remove <strong>{name}</strong> from the survey list?</p>
            {completed > 0 && (
              <p className="mt-2">It has <strong>{completed}</strong> completed evaluation(s). The records are archived (not destroyed) to protect historical data, but will no longer appear in lists and reports.</p>
            )}
          </>
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteOffering(id);
          if (res.ok) { toast.success(res.message); setConfirm(false); router.refresh(); } else toast.error(res.error);
        }}
      />
    </>
  );
}
