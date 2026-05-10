export function getSearchBoxMotionState(open: boolean) {
  return {
    containerClass: open ? "w-72 opacity-100" : "w-0 opacity-100",
    innerClass: open
      ? "pointer-events-auto translate-x-0 opacity-100"
      : "pointer-events-none translate-x-2 opacity-0",
    panelClass: open
      ? "pointer-events-auto opacity-100 translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1",
  };
}
