"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { SelectInput, type Option } from "@/components/select-input";

const themeOptions: Option[] = [
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "system", label: "System", icon: <Monitor /> },
];

/** Nothing to subscribe to: the value only differs between server and browser. */
const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The server doesn't know the reader's theme, so show the box empty until
  // the browser has told us which one it is.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <SelectInput
      options={themeOptions}
      value={ready ? theme : undefined}
      onValueChange={setTheme}
      placeholder="Theme"
      size="sm"
      className={className}
      aria-label="Theme"
    />
  );
}
