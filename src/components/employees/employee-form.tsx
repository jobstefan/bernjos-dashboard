"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmployeeAction,
  updateEmployeeAction,
} from "@/app/actions/employee.actions";
import type { DepartmentOption } from "@/lib/types/organization";

export interface EmployeeFormValues {
  id?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  position: string;
  department: string;
  employmentStatus: string;
  dateHired: string;
  basicSalary: string;
  payFrequency: string;
  sssNumber: string;
  philhealthNumber: string;
  sssSalaryBasis: string;
  philhealthAmount: string;
  contactNumber: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
}

/** Human labels for fields, so the error banner can name exactly what failed. */
const FIELD_LABELS: Record<string, string> = {
  employeeCode: "Employee code",
  firstName: "First name",
  lastName: "Last name",
  middleName: "Middle name",
  email: "Email",
  position: "Position",
  department: "Department",
  employmentStatus: "Employment status",
  dateHired: "Date hired",
  basicSalary: "Basic salary",
  payFrequency: "Pay frequency",
  sssNumber: "SSS number",
  philhealthNumber: "PhilHealth number",
  sssSalaryBasis: "SSS contribution salary",
  philhealthAmount: "PhilHealth amount",
  contactNumber: "Contact number",
  address: "Address",
  bankName: "Bank name",
  bankAccountNumber: "Account number",
};

const EMPTY: EmployeeFormValues = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  position: "",
  department: "",
  employmentStatus: "active",
  dateHired: "",
  basicSalary: "",
  payFrequency: "semi_monthly",
  sssNumber: "",
  philhealthNumber: "",
  sssSalaryBasis: "",
  philhealthAmount: "",
  contactNumber: "",
  address: "",
  bankName: "",
  bankAccountNumber: "",
};

export function EmployeeForm({
  mode,
  initial,
  departments = [],
}: {
  mode: "create" | "edit";
  initial?: Partial<EmployeeFormValues>;
  /** Curated departments (with their positions) to populate the dropdowns. */
  departments?: DepartmentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const [selects, setSelects] = React.useState({
    employmentStatus: initial?.employmentStatus ?? EMPTY.employmentStatus,
    payFrequency: initial?.payFrequency ?? EMPTY.payFrequency,
    department: initial?.department ?? EMPTY.department,
    position: initial?.position ?? EMPTY.position,
  });

  const v = { ...EMPTY, ...initial };

  // Department options, keyed by name (the value stored on the employee). Include
  // the current value even if it's a legacy free-text name not in the table, so
  // editing never silently blanks it.
  const departmentOptions = React.useMemo<[string, string][]>(() => {
    const names = departments.map((d) => d.name);
    if (selects.department && !names.includes(selects.department)) {
      names.push(selects.department);
    }
    return names.map((n) => [n, n]);
  }, [departments, selects.department]);

  // Positions belonging to the selected department, plus the current value as a
  // fallback so legacy values survive editing.
  const positionOptions = React.useMemo<[string, string][]>(() => {
    const dept = departments.find((d) => d.name === selects.department);
    const names = dept ? dept.positions.map((p) => p.name) : [];
    if (selects.position && !names.includes(selects.position)) {
      names.push(selects.position);
    }
    return names.map((n) => [n, n]);
  }, [departments, selects.department, selects.position]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => {
      const val = String(form.get(k) ?? "").trim();
      return val === "" ? undefined : val;
    };
    const input = {
      id: initial?.id,
      employeeCode: get("employeeCode"),
      firstName: get("firstName"),
      lastName: get("lastName"),
      middleName: get("middleName"),
      email: get("email"),
      position: selects.position || undefined,
      department: selects.department || undefined,
      employmentStatus: selects.employmentStatus,
      dateHired: get("dateHired"),
      basicSalary: get("basicSalary"),
      payFrequency: selects.payFrequency,
      sssNumber: get("sssNumber"),
      philhealthNumber: get("philhealthNumber"),
      sssSalaryBasis: get("sssSalaryBasis"),
      philhealthAmount: get("philhealthAmount"),
      contactNumber: get("contactNumber"),
      address: get("address"),
      bankName: get("bankName"),
      bankAccountNumber: get("bankAccountNumber"),
    };

    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createEmployeeAction(input)
          : await updateEmployeeAction(input);
      if (res.success) {
        if (mode === "create" && "username" in res.data) {
          toast.success("Employee created.", {
            description: `Login: username "${res.data.username}", temporary password "1234". Share these with the employee.`,
            duration: 10000,
          });
        } else {
          toast.success("Employee updated.");
        }
        // Land on the detail page so the admin can see the login credentials.
        router.push(`/employees/${res.data.id}`);
        router.refresh();
      } else {
        const fieldErrors = res.fieldErrors ?? {};
        setErrors(fieldErrors);
        setFormError(res.error);
        // Name the first failing field in the toast so the source is obvious even
        // before scrolling to the highlighted input.
        const firstField = Object.keys(fieldErrors)[0];
        toast.error(
          firstField
            ? `${res.error} (${FIELD_LABELS[firstField] ?? firstField})`
            : res.error,
        );
        // Bring the error banner into view.
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {formError ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <span>{formError}</span>
            {Object.keys(errors).length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4">
                {Object.entries(errors).map(([field, messages]) => (
                  <li key={field}>
                    <span className="font-medium">
                      {FIELD_LABELS[field] ?? field}:
                    </span>{" "}
                    {messages?.[0]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <Section title="Personal Information">
        <TextField name="firstName" label="First name" defaultValue={v.firstName} error={errors.firstName} />
        <TextField name="middleName" label="Middle name" defaultValue={v.middleName} error={errors.middleName} />
        <TextField name="lastName" label="Last name" defaultValue={v.lastName} error={errors.lastName} />
        <TextField
          name="email"
          label="Email"
          type="email"
          defaultValue={v.email}
          error={errors.email}
        />
        <TextField name="contactNumber" label="Contact number" defaultValue={v.contactNumber} error={errors.contactNumber} />
        <TextField name="address" label="Address" defaultValue={v.address} error={errors.address} />
      </Section>

      <Section title="Employment Details">
        <TextField name="employeeCode" label="Employee code" defaultValue={v.employeeCode} error={errors.employeeCode} />
        <SelectField
          label="Department"
          value={selects.department}
          onChange={(val) =>
            // Changing department clears any position that isn't under it.
            setSelects((s) => {
              const dept = departments.find((d) => d.name === val);
              const stillValid =
                dept?.positions.some((p) => p.name === s.position) ?? false;
              return { ...s, department: val, position: stillValid ? s.position : "" };
            })
          }
          options={departmentOptions}
          placeholder="Select a department"
          error={errors.department}
        />
        <SelectField
          label="Position"
          value={selects.position}
          onChange={(val) => setSelects((s) => ({ ...s, position: val }))}
          options={positionOptions}
          placeholder={
            selects.department
              ? "Select a position"
              : "Select a department first"
          }
          error={errors.position}
        />
        <SelectField
          label="Employment status"
          value={selects.employmentStatus}
          onChange={(val) => setSelects((s) => ({ ...s, employmentStatus: val }))}
          options={[
            ["active", "Active"],
            ["inactive", "Inactive"],
            ["resigned", "Resigned"],
            ["terminated", "Terminated"],
          ]}
        />
        <TextField name="dateHired" label="Date hired" type="date" defaultValue={v.dateHired} error={errors.dateHired} />
      </Section>

      <Section title="Compensation">
        <TextField name="basicSalary" label="Basic salary (daily rate)" type="number" defaultValue={v.basicSalary} error={errors.basicSalary} />
        <SelectField
          label="Pay frequency"
          value={selects.payFrequency}
          onChange={(val) => setSelects((s) => ({ ...s, payFrequency: val }))}
          options={[
            ["semi_monthly", "Semi-monthly"],
            ["monthly", "Monthly"],
          ]}
        />
      </Section>

      <Section title="Government Contributions">
        <TextField name="sssNumber" label="SSS number" defaultValue={v.sssNumber} error={errors.sssNumber} />
        <TextField
          name="sssSalaryBasis"
          label="SSS contribution salary (declared)"
          type="number"
          defaultValue={v.sssSalaryBasis}
          error={errors.sssSalaryBasis}
        />
        <TextField name="philhealthNumber" label="PhilHealth number" defaultValue={v.philhealthNumber} error={errors.philhealthNumber} />
        <TextField
          name="philhealthAmount"
          label="PhilHealth amount (per period)"
          type="number"
          defaultValue={v.philhealthAmount}
          error={errors.philhealthAmount}
        />
      </Section>

      <Section title="Bank Details">
        <TextField name="bankName" label="Bank name" defaultValue={v.bankName} error={errors.bankName} />
        <TextField name="bankAccountNumber" label="Account number" defaultValue={v.bankAccountNumber} error={errors.bankAccountNumber} />
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create employee"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  error,
  hint,
  disabled,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  error?: string[];
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} disabled={disabled} />
      {error?.length ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  placeholder?: string;
  error?: string[];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(val) => onChange(val as string)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {(val) =>
              options.find(([v]) => v === val)?.[1] ?? placeholder ?? ""
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(([val, labelText]) => (
            <SelectItem key={val} value={val}>
              {labelText}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error?.length ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : null}
    </div>
  );
}
