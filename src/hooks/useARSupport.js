import { useMemo } from "react";

export function useARSupport() {
  return useMemo(() => {
    const ua = navigator.userAgent || "";
    const isiOS =
      (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isFirefox = /firefox/i.test(ua);
    const isOculus = /OculusBrowser/.test(ua);

    if (isiOS) {
      return { device: "ios", isMobile: true, ar: true };
    }
    if (isAndroid && !isFirefox && !isOculus) {
      return { device: "android", isMobile: true, ar: true };
    }
    if (isAndroid) {
      return { device: "android", isMobile: true, ar: false };
    }
    return { device: "desktop", isMobile: false, ar: false };
  }, []);
}
