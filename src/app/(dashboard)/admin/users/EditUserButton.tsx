"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { updateUser } from "@/server/actions/users";

type InitialUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "SUPERVISOR" | "EMPLOYEE";
  employmentType: "HOURLY" | "SALARIED" | null;
};

export function EditUserButton({ user }: { user: InitialUser }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      email: user.email,
      name: user.name,
      role: user.role,
      employmentType: user.employmentType ?? "",
    }),
    [user],
  );

  const [form, setForm] = useState(initial);

  function onOpenChange(v: boolean) {
    if (v) setForm(initial);
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateUser(user.id, {
          email: form.email,
          name: form.name,
          role: form.role,
          employmentType: form.employmentType || null,
        });
        toast.success("User updated");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand"
        title="Edit user"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={onOpenChange} title="Edit user">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as InitialUser["role"],
                  }))
                }
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="EMPLOYEE">Employee</option>
              </Select>
            </div>
            <div>
              <Label>Employment</Label>
              <Select
                value={form.employmentType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, employmentType: e.target.value }))
                }
              >
                <option value="">—</option>
                <option value="HOURLY">Hourly</option>
                <option value="SALARIED">Salaried</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
