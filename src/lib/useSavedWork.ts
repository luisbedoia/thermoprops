import { useEffect, useState } from "react";
import {
  explorerSummary,
  isOwnWork,
  savedExplorer,
  savedWorksheet,
  worksheetSummary,
} from "./sessions";

export type SavedWork = {
  /** "R134a · 4 states": the worksheet kept in this browser, if one's own. */
  worksheet: string | null;
  /** The State Explorer's last workspace: its address and "Water · 3 states". */
  explorer: { search: string; summary: string } | null;
};

/**
 * This browser's last work in each mode, to continue it. Read once the page
 * is up: a built page (the same for everyone) comes first, so the first
 * render matches it.
 */
export function useSavedWork(): SavedWork {
  const [saved, setSaved] = useState<SavedWork>({
    worksheet: null,
    explorer: null,
  });
  useEffect(() => {
    const source = savedWorksheet();
    const search = savedExplorer();
    const summary = search ? explorerSummary(search) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is read after hydration, so the first render matches the built page.
    setSaved({
      worksheet: source && isOwnWork(source) ? worksheetSummary(source) : null,
      explorer: search && summary ? { search, summary } : null,
    });
  }, []);
  return saved;
}
