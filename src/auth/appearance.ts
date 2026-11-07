/**
 * Clerk's sign-in and sign-up cards in Cuely's tokens (see app/globals.css). The colours are
 * CSS variables, so the cards follow the site's light and dark themes.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--accent)",
    colorForeground: "var(--text)",
    colorMutedForeground: "var(--text-2)",
    colorBackground: "var(--surface)",
    colorInput: "var(--bg)",
    colorInputForeground: "var(--text)",
    colorNeutral: "var(--text)",
    fontFamily: "var(--sans)",
    borderRadius: "8px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "1px solid var(--line)" },
    headerTitle: { fontFamily: "var(--display)" },
  },
};
