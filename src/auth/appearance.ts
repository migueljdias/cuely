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

/**
 * The form sits straight on the page in the split sign-in layout (app/_components/auth-shell.tsx):
 * no card, no Clerk header (the page has its own heading), rounded "glass" inputs, the email
 * form first and Google/GitHub below an "or" divider.
 */
export function clerkAppearance(isDark: boolean) {
  const glass = isDark ? "rgba(233, 237, 247, 0.04)" : "rgba(14, 18, 32, 0.03)";
  const line = isDark ? "#1e2538" : "#e6e9f0";
  const ring = isDark ? "rgba(47, 91, 255, 0.55)" : "rgba(31, 75, 216, 0.45)";
  const tint = isDark ? "rgba(47, 91, 255, 0.10)" : "rgba(31, 75, 216, 0.05)";
  return {
    variables: {
      ...(isDark ? dark : light),
      ...(isDark ? { colorBackground: "#0a0e1a" } : {}),
      fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: "15px",
      borderRadius: "14px",
    },
    options: {
      socialButtonsPlacement: "bottom" as const,
      socialButtonsVariant: "blockButton" as const,
    },
    elements: {
      rootBox: { width: "100%" },
      cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "none", background: "transparent", overflow: "visible" },
      card: { boxShadow: "none", border: "none", background: "transparent", padding: "0", gap: "22px" },
      header: { display: "none" },
      main: { gap: "22px" },
      formFieldLabel: { fontWeight: 500, color: isDark ? "#b3bbd0" : "#444b5e" },
      formFieldInput: {
        height: "50px",
        padding: "0 16px",
        borderRadius: "14px",
        background: glass,
        border: `1px solid ${line}`,
        boxShadow: "none",
        transition: "border-color 160ms, background-color 160ms, box-shadow 160ms",
        "&:focus": { borderColor: ring, background: tint, boxShadow: `0 0 0 4px ${tint}` },
      },
      formButtonPrimary: {
        height: "50px",
        borderRadius: "14px",
        fontSize: "15px",
        fontWeight: 500,
        textTransform: "none",
        boxShadow: "none",
        background: isDark ? "#2f5bff" : "#1f4bd8",
        "&:hover": { background: "#3563ff" },
      },
      dividerText: { color: isDark ? "#8a92a6" : "#6a7182" },
      dividerLine: { background: line },
      socialButtonsBlockButton: {
        height: "50px",
        borderRadius: "14px",
        border: `1px solid ${line}`,
        boxShadow: "none",
        background: "transparent",
        "&:hover": { background: glass },
      },
      socialButtonsBlockButtonText: { fontSize: "15px", fontWeight: 500 },
      footer: { background: "transparent", padding: "0", marginTop: "6px" },
      footerAction: { justifyContent: "center", width: "100%" },
      footerActionLink: { color: isDark ? "#86a0ff" : "#1a3fb8", fontWeight: 500 },
    },
  };
}

/**
 * Clerk's profile editor (picture, name, email addresses, password, connected accounts) on
 * /account/profile, drawn as one of the account page's panels.
 */
export function clerkProfileAppearance(isDark: boolean) {
  const line = isDark ? "#1e2538" : "#e6e9f0";
  return {
    variables: {
      ...(isDark ? dark : light),
      ...(isDark ? { colorBackground: "#0a0e1a" } : {}),
      fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: "14.5px",
      borderRadius: "10px",
    },
    elements: {
      rootBox: { width: "100%" },
      cardBox: {
        width: "100%",
        maxWidth: "100%",
        border: `1px solid ${line}`,
        borderRadius: "16px",
        boxShadow: "0 1px 2px rgba(15, 22, 48, 0.04)",
      },
      formButtonPrimary: { textTransform: "none", boxShadow: "none", background: isDark ? "#2f5bff" : "#1f4bd8" },
    },
  };
}
