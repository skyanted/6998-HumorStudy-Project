"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LocalDateTime({ value }: { value: string }) {
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const date = new Date(value);
  // ICU punctuation differs between Node and browsers, even with the same locale
  // and timezone. Use a literal ISO fallback for SSR AND the hydration render.
  const formatted = hydrated
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(date)
    : date.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  return <time dateTime={value}>{formatted}</time>;
}
