import { useEffect, useState } from "react";
import { authenticateAdminToken, clearAdminAccessToken, hasAdminAccessToken, verifyStoredAdminAccess } from "../api";

export type PortalRole = "admin" | "customer";
export type AuthorizationFeedback = { tone: "success" | "error"; message: string };

function initialRole(): PortalRole {
  return window.localStorage.getItem("athene.portalRole.v1") === "admin" && hasAdminAccessToken() ? "admin" : "customer";
}

export function usePortalAuthorization(onFeedback: (feedback: AuthorizationFeedback) => void) {
  const [role, setRole] = useState<PortalRole>(initialRole);

  const activateCustomer = (message?: string) => {
    clearAdminAccessToken();
    setRole("customer");
    window.localStorage.setItem("athene.portalRole.v1", "customer");
    if (message) onFeedback({ tone: "success", message });
  };

  useEffect(() => {
    if (role !== "admin") return;
    verifyStoredAdminAccess().then((valid) => {
      if (!valid) activateCustomer();
    }).catch(() => activateCustomer());
  }, []);

  const changeRole = async (nextRole: PortalRole) => {
    if (nextRole === "customer") {
      activateCustomer("Customer-Modus aktiviert. Schreibzugriffe sind serverseitig gesperrt.");
      return;
    }
    const token = window.prompt("Admin-Zugangsschlüssel eingeben");
    if (!token) return;
    try {
      if (!await authenticateAdminToken(token)) {
        onFeedback({ tone: "error", message: "Admin-Anmeldung fehlgeschlagen. Der Zugangsschlüssel ist ungültig." });
        return;
      }
      setRole("admin");
      window.localStorage.setItem("athene.portalRole.v1", "admin");
      onFeedback({ tone: "success", message: "Admin-Rolle wurde vom Server bestätigt." });
    } catch (error) {
      onFeedback({ tone: "error", message: `Admin-Anmeldung nicht möglich: ${error instanceof Error ? error.message : "Unbekannter Fehler"}` });
    }
  };

  return { role, isAdmin: role === "admin", changeRole };
}
