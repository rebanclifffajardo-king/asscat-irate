"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import type { MenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/ui/row-actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteEntity, setEntityActive, type SimpleEntity } from "@/app/admin/common-actions";

/**
 * Standard row menu: Edit / Activate-Deactivate / Delete (with confirmation).
 * Deletion is refused by the database when the record is in use.
 */
export function EntityRowActions({ entity, id, name, isActive, onEdit, extra = [], canDelete = true }: {
  entity: SimpleEntity; id: string; name: string; isActive: boolean; onEdit?: () => void; extra?: MenuItem[]; canDelete?: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | "toggle" | "delete">(null);

  const items: MenuItem[] = [
    ...extra,
    ...(onEdit ? [{ label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: onEdit }] : []),
    {
      label: isActive ? "Deactivate" : "Activate",
      icon: isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />,
      onSelect: () => setConfirm("toggle"),
    },
    ...(canDelete
      ? [{ type: "separator" as const }, { label: "Delete", icon: <Trash2 className="h-4 w-4" />, tone: "danger" as const, onSelect: () => setConfirm("delete") }]
      : []),
  ];

  return (
    <>
      <RowActions items={items} label={`Actions for ${name}`} />
      <ConfirmationDialog
        open={confirm === "toggle"}
        onClose={() => setConfirm(null)}
        tone={isActive ? "warning" : "primary"}
        title={isActive ? "Deactivate record?" : "Activate record?"}
        message={isActive
          ? <>Deactivate <strong>{name}</strong>? It will no longer be available for new records, but existing and historical data are preserved.</>
          : <>Activate <strong>{name}</strong>?</>}
        confirmLabel={isActive ? "Deactivate" : "Activate"}
        onConfirm={async () => {
          const res = await setEntityActive({ entity, id, active: !isActive });
          if (res.ok) { toast.success(res.message); setConfirm(null); router.refresh(); } else toast.error(res.error);
        }}
      />
      <ConfirmationDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete permanently?"
        message={<>Delete <strong>{name}</strong>? This cannot be undone. Records that are already in use cannot be deleted — deactivate them instead.</>}
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteEntity({ entity, id });
          if (res.ok) { toast.success(res.message); setConfirm(null); router.refresh(); } else toast.error(res.error);
        }}
      />
    </>
  );
}
