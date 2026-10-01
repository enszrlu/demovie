import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth";
import { AppearanceControl, CopyButton, NotificationSetting, SaveButton } from "./settings-controls";

export const metadata: Metadata = { title: "Settings · Harborly" };

/** A fictional key, shown in full on purpose: capture tools are expected to redact it. */
const DEMO_API_KEY = "sk\u005flive_51HbX9qLmT4vR2cK8nWd3pZ7";

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 id={id} className="text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const { user, person } = await requireUser();

  return (
    <div className="max-w-5xl space-y-10">
      <SettingsSection id="profile-heading" title="Profile" description="How you appear to your teammates in Harborly.">
        <Card>
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-4">
              <Avatar name={person.name} color={person.avatarColor} size="lg" />
              <div>
                <p className="text-sm font-medium">{person.name}</p>
                <p className="text-[13px] text-muted-foreground">{person.role}</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input id="profile-name" name="name" defaultValue={person.name} autoComplete="name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-role">Role</Label>
                <Input id="profile-role" name="role" defaultValue={person.role} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                name="email"
                type="email"
                defaultValue={user.profileEmail}
                autoComplete="email"
                data-testid="profile-email"
              />
            </div>
          </div>
          <CardFooter className="justify-end bg-muted/30">
            <SaveButton />
          </CardFooter>
        </Card>
      </SettingsSection>

      <SettingsSection
        id="api-keys-heading"
        title="API keys"
        description="Use this key to sync launch plans from your own tools. Keep it secret."
      >
        <Card className="space-y-2 p-6">
          <Label htmlFor="api-key">Secret key</Label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              name="apiKey"
              readOnly
              value={DEMO_API_KEY}
              data-testid="api-key-input"
              className="font-mono text-[13px]"
            />
            <CopyButton value={DEMO_API_KEY} />
          </div>
          <p className="pt-1 text-xs text-muted-foreground">Created Aug 2, 2026 by {person.name}</p>
        </Card>
      </SettingsSection>

      <SettingsSection
        id="notifications-heading"
        title="Notifications"
        description="Choose what Harborly emails you about."
      >
        <Card className="divide-y divide-border p-6">
          <NotificationSetting
            id="notify-launch-reminders"
            label="Launch reminders"
            description="A heads-up three days before a launch date."
            defaultChecked
          />
          <NotificationSetting
            id="notify-velocity-digest"
            label="Weekly velocity digest"
            description="A Monday summary of last week’s velocity and cycle time."
            defaultChecked
          />
          <NotificationSetting
            id="notify-mentions"
            label="Mentions and comments"
            description="An email when someone mentions you or replies to you."
            defaultChecked={false}
          />
        </Card>
      </SettingsSection>

      <SettingsSection id="appearance-heading" title="Appearance" description="Pick a theme, or follow your system.">
        <Card className="p-6">
          <AppearanceControl />
        </Card>
      </SettingsSection>
    </div>
  );
}
