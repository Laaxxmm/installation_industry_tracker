"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createUser } from "@/server/actions/users";

export function NewUserForm() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "EMPLOYEE" as "ADMIN" | "MANAGER" | "SUPERVISOR" | "EMPLOYEE",
    employmentType: "HOURLY" as "HOURLY" | "SALARIED" | "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createUser({
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
          employmentType:
            form.role === "EMPLOYEE" && form.employmentType ? form.employmentType : null,
        });
        toast.success("User created");
        setForm({ email: "", name: "", password: "", role: "EMPLOYEE", employmentType: "HOURLY" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create user");
      }
    });
  }

  const needsType = form.role === "EMPLOYEE";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="password">Temp password</Label>
        <Input
          id="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select
          id="role"
          value={form.role}
          onChange={(e) =>
            setForm((f) => ({ ...f, role: e.target.value as typeof f.role }))
          }
        >
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="EMPLOYEE">Employee</option>
        </Select>
      </div>
      {needsType && (
        <div>
          <Label htmlFor="employmentType">Employment type</Label>
          <Select
            id="employmentType"
            value={form.employmentType}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                employmentType: e.target.value as typeof f.employmentType,
              }))
            }
          >
            <option value="HOURLY">Hourly</option>
            <option value="SALARIED">Salaried</option>
          </Select>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}
