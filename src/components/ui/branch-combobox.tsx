"use client"

import { SearchableCombobox } from "@/components/ui/searchable-combobox"

export interface BranchOption {
  id: string
  name: string
}

interface Props {
  branches: BranchOption[]
  value: string
  onValueChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function BranchCombobox({
  branches,
  value,
  onValueChange,
  placeholder = "Search branch…",
  disabled,
  className,
}: Props) {
  const options = branches.map((b) => ({
    value: b.id,
    label: b.name,
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
