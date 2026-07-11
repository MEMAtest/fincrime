export type OwnedConversionEvent =
  | "lead_submitted"
  | "signup_completed"
  | "demo_requested"
  | "download_completed"
  | "checkout_started"
  | "purchase_completed";

export function trackOwnedEvent(
  eventName: OwnedConversionEvent,
  properties: Record<string, string | number | boolean> = {},
): boolean {
  if (typeof window === "undefined") return false;
  const analyticsWindow = window as typeof window & {
    ownedPortfolioTrack?: (
      name: OwnedConversionEvent,
      values?: Record<string, string | number | boolean>,
    ) => boolean;
    ownedPortfolioQueue?: Array<
      [OwnedConversionEvent, Record<string, string | number | boolean>]
    >;
  };
  if (analyticsWindow.ownedPortfolioTrack) {
    return analyticsWindow.ownedPortfolioTrack(eventName, properties);
  }
  (analyticsWindow.ownedPortfolioQueue ||= []).push([eventName, properties]);
  return true;
}
