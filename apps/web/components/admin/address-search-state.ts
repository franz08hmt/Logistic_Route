export function shouldRequestAddressSuggestions({
  query,
  selectedAddress,
}: {
  query: string;
  selectedAddress: string | null;
}): boolean {
  const normalizedQuery = query.trim();
  return (
    normalizedQuery.length >= 3
    && normalizedQuery !== selectedAddress?.trim()
  );
}
