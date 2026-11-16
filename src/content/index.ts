/** Seat 12A content script (x.com). Everything lives in app.ts; this entry never throws into the page. */
import { startApp } from "./app";

const w = window as unknown as { __seat12a?: boolean };
if (window.top === window && !w.__seat12a) {
  w.__seat12a = true;
  void startApp().catch(() => {});
}
