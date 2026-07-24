// server/reasonPortal.js
export function reasonPortal(context, spoken) {
  const clean = spoken.toLowerCase().trim();
  const portal = context?.portal || "root";

  // default fallback
  let aiLine = "I'm listening… what would you like to explore next?";

  if (portal === "root") {
    if (/enter|explore|open/.test(clean)) {
      aiLine = "Stepping through the energy gate — hold on tight.";
    } else if (/hello|hi/.test(clean)) {
      aiLine = "Hey there! You can say 'enter' to begin the experience.";
    }
  }

  if (portal === "the-vibe-energy") {
    if (/pause|stop/.test(clean)) {
      aiLine = "Pausing neural flow — observe the stillness.";
    } else if (/resume|play|continue/.test(clean)) {
      aiLine = "Resuming synaptic motion — feel the pulse return.";
    } else if (/exit|back/.test(clean)) {
      aiLine = "Leaving the energy field… returning to the outer world.";
    } else {
      aiLine = "You're in the Vibe Energy field. Try saying 'pause' or 'resume'.";
    }
  }

  if (portal === "meet-joz") {
    if (/discover/.test(clean)) {
      aiLine = "Let’s discover what Joz has been designing…";
    } else if (/skills/.test(clean)) {
      aiLine = "Opening the skill grid for you.";
    } else if (/back|exit/.test(clean)) {
      aiLine = "Heading back to the outer realm.";
    } else {
      aiLine = "You're speaking with Joz — ask about 'skills' or 'discover'.";
    }
  }

  return aiLine;
}
