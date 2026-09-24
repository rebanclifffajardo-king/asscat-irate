import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABEL, ROLE_HOME } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FacultyAvatar } from "@/components/ui/faculty-avatar";
import { Badge } from "@/components/ui/status-badge";
import { PasswordForm } from "@/components/auth/password-form";
import { changePassword } from "@/app/(auth)/actions";
import { AdminNameForm, AvatarUpload } from "./profile-forms";

/** "My Profile" + "Change Password" for every role. */
export function ProfilePage({ user }: { user: SessionUser }) {
  const details: [string, string | null][] = user.role === "admin"
    ? [["Email", user.email], ["Role", ROLE_LABEL.admin]]
    : [
        [user.role === "student" ? "Student ID" : "Faculty ID", user.recordNumber],
        ["Email", user.email],
        ["Program", user.programCode ? `${user.programCode} – ${user.programName}` : null],
        ["Department", user.departmentName],
        ...(user.role === "student" ? [["Year Level", user.yearLevel] as [string, string | null]] : []),
      ];
  return (
    <>
      <PageHeader title="My Profile" breadcrumbs={[{ label: "Home", href: ROLE_HOME[user.role] }, { label: "My Profile" }]} />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card outline="brand" className="self-start">
          <CardBody className="flex flex-col items-center text-center">
            <FacultyAvatar name={user.displayName} src={user.avatarUrl} size="xl" className="ring-brand-100" />
            <p className="mt-3 text-lg font-semibold text-gray-900">{user.displayName}</p>
            <Badge tone="green" className="mt-1">{ROLE_LABEL[user.role]}</Badge>
            <div className="mt-4">
              {user.role === "faculty" ? (
                <p className="text-xs text-gray-500">Your official photo is managed by the administrator.</p>
              ) : <AvatarUpload />}
            </div>
          </CardBody>
          <dl className="divide-y divide-gray-100 border-t border-gray-100 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-gray-500">{k}</dt>
                <dd className="break-all text-right font-medium text-gray-800">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {user.role !== "admin" && (
            <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">To correct your name, ID or program, please contact the registrar or system administrator.</p>
          )}
        </Card>
        <div className="space-y-5">
          {user.role === "admin" && (
            <Card>
              <CardHeader title="Profile details" />
              <CardBody><AdminNameForm first={user.firstName ?? ""} middle={user.middleName ?? ""} last={user.lastName ?? ""} /></CardBody>
            </Card>
          )}
          <Card>
            <div id="password" className="scroll-mt-20" />
            <CardHeader title="Change Password" description="You will stay signed in on this device." />
            <CardBody className="max-w-md"><PasswordForm action={changePassword} mode="voluntary" /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
