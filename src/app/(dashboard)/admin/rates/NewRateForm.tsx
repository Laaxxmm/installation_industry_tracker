"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { upsertRateCard } from "@/server/actions/rates";

export interface EmployeeOption {
  id: string;
  name: string;
  employmentType: "HOURLY" | "SALARIED" | null;
}

export function NewRateForm({ employees }: { employees: EmployeeOption[] }) {
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState<string>(employees[0]?.id ?? "");
  const [type, setType] = useState<"HOURLY" | "SALARIED">(
    employees[0]?.employmentType ?? "HOURLY",
  );
  const [amount, setAmount] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );

  const selected = useMemo(() => employees.find((e) => e.id === userId), [employees, userId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    startTransition(async () => {
      try {
        await upsertRateCard({
          userId,
          type,
          hourlyRate: type === "HOURLY" ? amount : null,
          monthlySalary: type === "SALARIED" ? amount : null,
          effectiveFrom: new Date(`${effectiveFrom}T00:00:00Z`).toISOString(),
        });
        toast.success("Rate card saved");
        setAmount("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save rate");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="userId">Employee</Label>
        <Select
          id="userId"
          value={userId}
          onChange={(e) => {
            const id = e.target.value;
            setUserId(id);
            const emp = employees.find((x) => x.id === id);
            if (emp?.employmentType) setType(emp.employmentType);
          }}
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} {e.employmentType ? `(${e.employmentType})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="type">Type</Label>
        <Select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as "HOURLY" | "SALARIED")}
        >
          <option value="HOURLY">Hourly</option>
          <option value="SALARIED">Salaried</option>
        </Select>
        {selected?.employmentType && selected.employmentType !== type && (
          <p className="text-xs text-amber-600 mt-1">
            Employee profile is {selected.employmentType}; consider updating it to match.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="amount">{type === "HOURLY" ? "Hourly rate (₹)" : "Monthly salary (₹)"}</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="effectiveFrom">Effective from</Label>
        <Input
          id="effectiveFrom"
          type="date"
          required
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !userId}>
        {pending ? "Saving…" : "Save rate card"}
      </Button>
    </form>
  );
}
