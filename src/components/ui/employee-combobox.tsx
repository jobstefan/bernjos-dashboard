"use client"

import { formatEmployeeName } from "@/lib/utils/format-name"
import { SearchableCombobox } from "@/components/ui/searchable-combobox"

export interface EmployeeOption {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  middleName?: string | null
}

interface Props {
  employees: EmployeeOption[]
  value: string
  onValueChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function EmployeeCombobox({
  employees,
  value,
  onValueChange,
  placeholder = "Search employee…",
  disabled,
  className,
}: Props) {
  const options = employees.map((e) => ({
    value: e.id,
    label: formatEmployeeName(e.firstName, e.lastName, e.middleName),
    sublabel: e.employeeCode,
  }))

  return (
    <SearchableCombobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}
