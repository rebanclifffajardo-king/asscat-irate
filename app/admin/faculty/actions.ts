"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { bulkIds, bulkMessage, dbError, formToObject, parseInput, runAction, UserFacingError, type ActionResult, type BulkResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { facultySchema } from "@/lib/validation/people";
import { createFacultyRecord } from "@/lib/people/create";
import { deleteAccount, resetAccountPassword, setAccountActive, updateAccountEmail } from "@/lib/auth/accounts";
import { validateImageFile } from "@/lib/storage";
import { formatPersonName } from "@/lib/format";

const UNIQUE_MSG = "A faculty member with this Faculty ID or email already exists.";
const BUCKET = "faculty-photos";

function photoFrom(formData: FormData): File | null {
  const f = formData.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
}

async function uploadPhoto(supabase: ServerSupabase, facultyId: string, file: File): Promise<string> {
  const check = await validateImageFile(file);
  if (!check.ok) throw new UserFacingError(check.error, { photo: [check.error] });
  const path = `${facultyId}/${Date.now()}.${check.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) {
    console.error("[storage]", error.message);
    throw new UserFacingError("The photo could not be uploaded. Please try again.");
  }
  return path;
}

export async function createFaculty(formData: FormData): Promise<ActionResult<{ tempPassword: string; email: string }>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(facultySchema, formToObject(formData));
    const photo = photoFrom(formData);
    if (photo) {
      const check = await validateImageFile(photo);
      if (!check.ok) throw new UserFacingError(check.error, { photo: [check.error] });
    }
    const supabase = await createClient();
    const [{ count: byId }, { count: byEmail }] = await Promise.all([
      supabase.from("faculty").select("id", { count: "exact", head: true }).eq("faculty_number", v.faculty_number),
      supabase.from("faculty").select("id", { count: "exact", head: true }).eq("email", v.email),
    ]);
    if (byId) throw new UserFacingError(UNIQUE_MSG, { faculty_number: ["Faculty ID is already in use."] });
    if (byEmail) throw new UserFacingError(UNIQUE_MSG, { email: ["Email is already in use."] });

    const data = await createFacultyRecord(supabase, user.id, v);
    if (photo) {
      try {
        const path = await uploadPhoto(supabase, data.id, photo);
        await supabase.from("faculty").update({ photo_path: path }).eq("id", data.id);
      } catch (e) {
        console.error("[faculty-photo]", e);
      }
    }
    await logActivity({
      user, module: "Faculty", action: "Created faculty account",
      description: `${v.faculty_number} – ${formatPersonName(v.first_name, v.middle_name, v.last_name)}`, entityType: "faculty", entityId: data.id,
    });
    revalidatePath("/admin/faculty");
    return { tempPassword: data.tempPassword, email: v.email };
  }, "Faculty account created.");
}

export async function updateFaculty(formData: FormData): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const raw = formToObject(formData);
    const { id } = parseInput(z.object({ id: z.uuid() }), raw);
    const v = parseInput(facultySchema, raw);
    const removePhoto = raw.remove_photo === true;
    const photo = photoFrom(formData);
    const supabase = await createClient();
    const { data: before } = await supabase.from("faculty").select("email, profile_id, photo_path").eq("id", id).single();
    if (!before) throw new UserFacingError("Faculty member not found.");

    let photoPath = before.photo_path;
    if (photo) photoPath = await uploadPhoto(supabase, id, photo);
    else if (removePhoto) photoPath = null;

    const { error } = await supabase.from("faculty").update({ ...v, photo_path: photoPath }).eq("id", id);
    if (error) throw dbError(error, { unique: UNIQUE_MSG, foreignKey: "Select a valid program." });
    if (before.photo_path && before.photo_path !== photoPath) {
      await supabase.storage.from(BUCKET).remove([before.photo_path]);
    }
    if (before.profile_id && before.email.toLowerCase() !== v.email) {
      try {
        await updateAccountEmail(before.profile_id, v.email);
      } catch (e) {
        await supabase.from("faculty").update({ email: before.email }).eq("id", id);
        throw e;
      }
    }
    await logActivity({ user, module: "Faculty", action: "Updated faculty", description: v.faculty_number, entityType: "faculty", entityId: id });
    revalidatePath("/admin/faculty");
    return null;
  }, "Faculty updated.");
}

export async function setFacultyActive(input: { id: string; active: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(z.object({ id: z.uuid(), active: z.boolean() }), input);
    const supabase = await createClient();
    const { data, error } = await supabase.from("faculty").update({ is_active: v.active }).eq("id", v.id).select("faculty_number, profile_id").single();
    if (error) throw dbError(error);
    if (data.profile_id) await setAccountActive(data.profile_id, v.active);
    await logActivity({ user, module: "Faculty", action: v.active ? "Activated faculty" : "Deactivated faculty", description: data.faculty_number, entityType: "faculty", entityId: v.id });
    revalidatePath("/admin/faculty");
    return null;
  }, input.active ? "Faculty activated." : "Faculty deactivated. The account can no longer sign in.");
}

export async function deleteFaculty(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const fid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { data, error } = await supabase.from("faculty").delete().eq("id", fid).select("faculty_number, profile_id, photo_path").maybeSingle();
    if (error) throw dbError(error, { foreignKey: "This faculty member has assigned classes or evaluation records and cannot be deleted. Deactivate instead." });
    if (!data) throw new UserFacingError("Faculty member not found.");
    if (data.photo_path) await supabase.storage.from(BUCKET).remove([data.photo_path]);
    if (data.profile_id) await deleteAccount(data.profile_id);
    await logActivity({ user, module: "Faculty", action: "Deleted faculty", description: data.faculty_number, entityType: "faculty", entityId: fid });
    revalidatePath("/admin/faculty");
    return null;
  }, "Faculty deleted.");
}

/**
 * Bulk version of deleteFaculty. Same rule: faculty with assigned classes
 * (including archived ones) are skipped (deactivate them instead); nothing is
 * cascaded. Photos and login accounts of deleted faculty are removed afterwards.
 */
export async function deleteFaculties(ids: string[]): Promise<ActionResult<BulkResult>> {
  const res = await runAction(async () => {
    const user = await assertRole("admin");
    const fids = [...new Set(parseInput(bulkIds, ids))];
    const supabase = await createClient();
    const [{ data: rows, error }, { data: classes, error: clsError }] = await Promise.all([
      supabase.from("faculty").select("id, faculty_number, first_name, last_name").in("id", fids),
      supabase.from("subject_offerings").select("faculty_id").in("faculty_id", fids),
    ]);
    if (error || clsError) throw dbError((error ?? clsError)!);
    const found = new Map((rows ?? []).map((r) => [r.id, r]));
    const hasClasses = new Set((classes ?? []).map((c) => c.faculty_id));
    const label = (id: string) => { const r = found.get(id); return r ? `${r.last_name}, ${r.first_name} (${r.faculty_number})` : "Unknown faculty"; };

    const skipped: BulkResult["skipped"] = [];
    const candidates: string[] = [];
    for (const id of fids) {
      if (!found.has(id)) skipped.push({ id, label: label(id), reason: "not found" });
      else if (hasClasses.has(id)) skipped.push({ id, label: label(id), reason: "has assigned classes" });
      else candidates.push(id);
    }

    // One statement for all; if a class was assigned since the check (FK error), retry row by row.
    type Deleted = { id: string; faculty_number: string; profile_id: string | null; photo_path: string | null };
    let deleted: Deleted[] = [];
    if (candidates.length) {
      const del = await supabase.from("faculty").delete().in("id", candidates).select("id, faculty_number, profile_id, photo_path");
      if (!del.error) deleted = del.data ?? [];
      else if (del.error.code === "23503") {
        for (const id of candidates) {
          const one = await supabase.from("faculty").delete().eq("id", id).select("id, faculty_number, profile_id, photo_path").maybeSingle();
          if (one.error?.code === "23503") skipped.push({ id, label: label(id), reason: "has assigned classes" });
          else if (one.error) throw dbError(one.error);
          else if (one.data) deleted.push(one.data);
        }
      } else throw dbError(del.error);
    }
    const photos = deleted.map((d) => d.photo_path).filter((p): p is string => !!p);
    if (photos.length) await supabase.storage.from(BUCKET).remove(photos);
    for (const d of deleted) if (d.profile_id) await deleteAccount(d.profile_id);

    if (deleted.length) {
      await logActivity({
        user, module: "Faculty", action: "Deleted faculty",
        description: `${deleted.length} deleted, ${skipped.length} skipped: ${deleted.map((d) => d.faculty_number).join(", ")}`,
        metadata: { deleted: deleted.map((d) => d.id), skipped: skipped.map((x) => ({ id: x.id, reason: x.reason })) },
      });
      revalidatePath("/admin/faculty");
    }
    return { done: deleted.length, skipped };
  });
  return res.ok ? { ...res, message: bulkMessage(res.data.done, "deleted", res.data.skipped) } : res;
}

export async function resetFacultyPassword(id: string): Promise<ActionResult<{ tempPassword: string }>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const fid = parseInput(z.uuid(), id);
    const supabase = await createClient();
    const { data } = await supabase.from("faculty").select("faculty_number, profile_id").eq("id", fid).single();
    if (!data?.profile_id) throw new UserFacingError("This faculty member has no login account.");
    const tempPassword = await resetAccountPassword(data.profile_id);
    await logActivity({ user, module: "Faculty", action: "Reset faculty password", description: data.faculty_number, entityType: "faculty", entityId: fid });
    return { tempPassword };
  }, "Temporary password generated.");
}
