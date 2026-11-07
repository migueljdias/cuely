/**
 * Clerk's sign-in and sign-up cards in Cuely's tokens (see app/globals.css).
 *
 * The colour variables are literal hex, not CSS var() values: Clerk derives its button and
 * input shades from these, and with var() values its primary button rendered with no visible
 * fill or label, so the Continue button looked missing. The two palettes mirror the light
 * and dark tokens in globals.css; the client wrapper in app/auth/_clerk.tsx picks one from
 * the visitor's colour scheme. Keep them in step with globals.css.
 */
const light = {
  colorPrimary: "#1f4bd8",
  colorPrimaryForeground: "#ffffff",
  colorForeground: "#0e1220",
  colorMutedForeground: "#444b5e",
  colorBackground: "#ffffff",
  colorInput: "#f5f7fc",
  colorInputForeground: "#0e1220",
  colorNeutral: "#0e1220",
};

const dark = {
  colorPrimary: "#2f5bff",
  colorPrimaryForeground: "#ffffff",
  colorForeground: "#e9edf7",
  colorMutedForeground: "#b3bbd0",
  colorBackground: "#111a33",
  colorInput: "#0b1226",
  colorInputForeground: "#e9edf7",
  colorNeutral: "#e9edf7",
};

export function clerkAppearance(isDark: boolean) {
  return {
    variables: {
      ...(isDark ? dark : light),
      fontFamily: '"Funnel Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      borderRadius: "8px",
    },
    elements: {
      rootBox: { width: "100%" },
      cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "1px solid var(--line)" },
      headerTitle: { fontFamily: "var(--display)" },
    },
  };
}
