"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth/session";
import { dbError, parseInput, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { profileSchema } from "@/lib/validation/people";
import { validateImageFile } from "@/lib/storage";

/** Administrators edit their own display name (student/faculty names are master data). */
export async function updateMyProfile(raw: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole("admin");
    const v = parseInput(profileSchema, raw);
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update(v).eq("id", user.id);
    if (error) throw dbError(error);
    await logActivity({ user, module: "Profile", action: "Updated own profile" });
    revalidatePath("/", "layout");
    return null;
  }, "Profile updated.");
}

export async function uploadMyAvatar(formData: FormData): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertRole(["admin", "faculty", "student"]);
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Choose an image to upload.");
    const check = await validateImageFile(file);
    if (!check.ok) throw new UserFacingError(check.error);
    const supabase = await createClient();
    const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
    const path = `${user.id}/${Date.now()}.${check.ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw new UserFacingError("The image could not be uploaded. Please try again.");
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
    if (error) throw dbError(error);
    if (before?.avatar_path) await supabase.storage.from("avatars").remove([before.avatar_path]);
    await logActivity({ user, module: "Profile", action: "Changed profile picture" });
    revalidatePath("/", "layout");
    return null;
  }, "Profile picture updated.");
}
