import { assetUrl } from "../../utils/paths";

export function launchMaxxAr({ arUsdzUrl, arGlbUrl }) {
  const ua = navigator.userAgent || "";
  const isiOS =
    (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isOculus = /OculusBrowser/.test(ua);
  const canAndroidAR = isAndroid && !isFirefox && !isOculus;

  if (isiOS) {
    if (!arUsdzUrl) {
      if (arGlbUrl) window.location.href = arGlbUrl;
      return;
    }
    const link = document.createElement("a");
    link.rel = "ar";
    link.href = arUsdzUrl;
    link.style.display = "none";

    const img = document.createElement("img");
    img.src = assetUrl("/usdz.png");
    link.appendChild(img);

    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    return;
  }

  if (canAndroidAR) {
    if (!arGlbUrl) return;
    const link = document.createElement("a");
    link.href =
      `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(arGlbUrl)}#Intent;` +
      `scheme=https;package=com.google.android.googlequicksearchbox;` +
      `action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(arGlbUrl)};end;`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    return;
  }

  console.log("❌ AR not supported on this device/browser.");
}
