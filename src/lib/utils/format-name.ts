export function formatEmployeeName(
  firstName: string,
  lastName: string,
  middleName?: string | null,
): string {
  return middleName
    ? `${lastName}, ${firstName} ${middleName}`
    : `${lastName}, ${firstName}`;
}
