"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/sab";

type Props = {
  defaultValues?: Partial<FormState>;
  onSubmit: (raw: unknown) => Promise<unknown>;
};

type FormState = {
  name: string;
  gstin: string;
  pan: string;
  stateCode: string;
  category:
    | "PIPES"
    | "FITTINGS"
    | "PUMPS"
    | "VALVES"
    | "SPRINKLERS"
    | "TOOLS"
    | "CONSUMABLES"
    | "SERVICES"
    | "OTHER";
  msme: boolean;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: "NET_15" | "NET_30" | "NET_45" | "NET_60" | "ADVANCE";
  creditLimit: string;
  notes: string;
};

const INITIAL: FormState = {
  name: "",
  gstin: "",
  pan: "",
  stateCode: "29",
  category: "OTHER",
  msme: false,
  contactName: "",
  phone: "",
  email: "",
  address: "",
  paymentTerms: "NET_30",
  creditLimit: "0",
  notes: "",
};

export function VendorForm({ defaultValues, onSubmit }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ ...INITIAL, ...defaultValues });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function field<K extends keyof FormState>(key: K) {
    return {
      value: state[key] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setState((s) => ({ ...s, [key]: e.target.value })),
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(state);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save vendor");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-3xl rounded border p-6"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
    >
      {error && (
        <div className="mb-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label>Vendor name</Label>
          <Input required placeholder="Hindustan Pipes & Fittings" {...field("name")} />
        </div>
        <div>
          <Label>State code</Label>
          <Input
            required
            pattern="\d{2}"
            maxLength={2}
            placeholder="29"
            {...field("stateCode")}
          />
        </div>
        <div>
          <Label>GSTIN</Label>
          <Input placeholder="29AAAAA0000A1Z5" {...field("gstin")} />
        </div>
        <div>
          <Label>PAN</Label>
          <Input placeholder="AAAAA0000A" {...field("pan")} />
        </div>
        <div>
          <Label>Category</Label>
          <Select {...field("category")}>
            <option value="PIPES">Pipes</option>
            <option value="FITTINGS">Fittings</option>
            <option value="PUMPS">Pumps</option>
            <option value="VALVES">Valves</option>
            <option value="SPRINKLERS">Sprinklers</option>
            <option value="TOOLS">Tools</option>
            <option value="CONSUMABLES">Consumables</option>
            <option value="SERVICES">Services</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>
        <div>
          <Label>Contact name</Label>
          <Input {...field("contactName")} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input {...field("phone")} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" {...field("email")} />
        </div>
        <div>
          <Label>Payment terms</Label>
          <Select {...field("paymentTerms")}>
            <option value="NET_15">Net 15</option>
            <option value="NET_30">Net 30</option>
            <option value="NET_45">Net 45</option>
            <option value="NET_60">Net 60</option>
            <option value="ADVANCE">Advance</option>
          </Select>
        </div>
        <div>
          <Label>Credit limit (₹)</Label>
          <Input inputMode="decimal" {...field("creditLimit")} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            id="msme"
            type="checkbox"
            checked={state.msme}
            onChange={(e) => setState((s) => ({ ...s, msme: e.target.checked }))}
          />
          <Label htmlFor="msme">MSME registered</Label>
        </div>
        <div className="sm:col-span-3">
          <Label>Address</Label>
          <Textarea rows={2} {...field("address")} />
        </div>
        <div className="sm:col-span-3">
          <Label>Notes</Label>
          <Textarea rows={3} {...field("notes")} />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add vendor"}
        </Button>
      </div>
    </form>
  );
}
