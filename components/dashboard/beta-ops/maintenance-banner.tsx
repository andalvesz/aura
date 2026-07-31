/**
 * Maintenance banner — clear message; admins may bypass via server flag.
 */

"use client";

type Props = {
  message: string | null;
  active: boolean;
};

export function MaintenanceBanner({ message, active }: Props) {
  if (!active || !message) return null;
  return (
    <div
      className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-[12px] text-amber-100"
      data-testid="maintenance-banner"
      role="status"
    >
      {message}
    </div>
  );
}
