import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CONTACT_CTA = {
  text: "Email Joz directly.",
  type: "email",
  href: "mailto:joz@meetjoz.com",
  label: "Open Mail App",
};

export function useContactCta({ setSuggestionText }) {
  const [showContactButtons, setShowContactButtons] = useState(false);
  const [contactCtaType, setContactCtaType] = useState("");
  const [contactCtaHref, setContactCtaHref] = useState("");
  const [contactCtaLabel, setContactCtaLabel] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const contactButtonsHideTimeoutRef = useRef(null);

  const clearContactCtaHide = useCallback(() => {
    if (contactButtonsHideTimeoutRef.current) {
      window.clearTimeout(contactButtonsHideTimeoutRef.current);
      contactButtonsHideTimeoutRef.current = null;
    }
  }, []);

  const hideContactCta = useCallback(
    (delayMs = 300) => {
      clearContactCtaHide();
      setFadeOut(true);
      contactButtonsHideTimeoutRef.current = window.setTimeout(() => {
        setShowContactButtons(false);
        setContactCtaType("");
        setContactCtaHref("");
        setContactCtaLabel("");
        setSuggestionText("");
        setFadeOut(false);
        contactButtonsHideTimeoutRef.current = null;
      }, delayMs);
    },
    [clearContactCtaHide, setSuggestionText]
  );

  const showContactCta = useCallback(
    ({
      text = DEFAULT_CONTACT_CTA.text,
      type = DEFAULT_CONTACT_CTA.type,
      href = DEFAULT_CONTACT_CTA.href,
      label = DEFAULT_CONTACT_CTA.label,
    } = {}) => {
      clearContactCtaHide();
      setSuggestionText(text);
      setContactCtaType(type);
      setContactCtaHref(href);
      setContactCtaLabel(label);
      setShowContactButtons(true);
      setFadeOut(false);
    },
    [clearContactCtaHide, setSuggestionText]
  );

  useEffect(
    () => () => {
      if (contactButtonsHideTimeoutRef.current) {
        window.clearTimeout(contactButtonsHideTimeoutRef.current);
        contactButtonsHideTimeoutRef.current = null;
      }
    },
    []
  );

  return {
    showContactButtons,
    contactCtaType,
    contactCtaHref,
    contactCtaLabel,
    fadeOut,
    showContactCta,
    hideContactCta,
  };
}
