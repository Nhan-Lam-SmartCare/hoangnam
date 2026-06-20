import { createContext, useCallback, useContext, useEffect, useState } from "react";
// Use a single Supabase client app-wide to avoid multiple GoTrue instances
import { supabase } from "../supabaseClient";
import type {
  User,
  Session,
  AuthChangeEvent,
  AuthenticatorAssuranceLevels,
} from "@supabase/supabase-js";
import { safeAudit } from "../lib/repository/auditLogsRepository";

export type UserRole = "owner" | "manager" | "staff";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  permissions?: Record<string, boolean>;
  custom_permissions?: Record<string, boolean>;
  permission_overrides?: Record<string, boolean>;
  name?: string;
  full_name?: string; // legacy fallback
  avatar_url?: string;
  created_at: string;
  branch_id?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  // MFA state
  mfaRequired: boolean;
  currentAAL: AuthenticatorAssuranceLevels | null;
  // Methods
  signIn: (
    email: string,
    password: string
  ) => Promise<{ mfaRequired: boolean }>;
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  completeMFAVerification: () => void;
  checkMFAStatus: () => Promise<{
    hasMFA: boolean;
    requiresVerification: boolean;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_FORCE_OWNER_EMAILS = ["hoangnam1583@gmail.com"];
const FORCE_OWNER_EMAILS = (
  import.meta.env.VITE_FORCE_OWNER_EMAILS || ""
)
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);
// Default OFF: forcing owner client-side desyncs the UI role from the DB role
// (server/RLS never honor this), which is misleading and a foot-gun. Opt in
// explicitly via VITE_FORCE_OWNER_ENABLED=true only for break-glass/dev.
const FORCE_OWNER_ENABLED =
  (import.meta.env.VITE_FORCE_OWNER_ENABLED || "false").toLowerCase() ===
  "true";

const normalizeEmail = (email?: string | null) =>
  String(email || "").trim().toLowerCase();

const isForcedOwnerEmail = (email?: string | null) => {
  if (!FORCE_OWNER_ENABLED) return false;
  const candidates = FORCE_OWNER_EMAILS.length
    ? FORCE_OWNER_EMAILS
    : DEFAULT_FORCE_OWNER_EMAILS;
  return candidates.includes(normalizeEmail(email));
};

// Permissions/role are authoritative ONLY from app_metadata (service-role-only)
// or the profiles row. user_metadata is self-editable and must never be trusted
// for authorization. We keep a user_metadata fallback solely for legacy accounts
// created before the app_metadata migration.
const getPermissionMetadata = (rawUser: any): Record<string, boolean> => {
  const appMeta = rawUser?.app_metadata || {};
  const userMeta = rawUser?.user_metadata || {};
  const candidates = [
    appMeta.permissions,
    appMeta.custom_permissions,
    appMeta.permission_overrides,
    // Legacy fallback only:
    userMeta.permissions,
    userMeta.custom_permissions,
    userMeta.permission_overrides,
  ];

  return candidates.reduce<Record<string, boolean>>((acc, value) => {
    if (!value || typeof value !== "object") return acc;
    Object.entries(value).forEach(([key, flag]) => {
      if (typeof flag === "boolean") {
        acc[key] = flag;
      }
    });
    return acc;
  }, {});
};

const getMetadataRole = (rawUser: any): UserRole | undefined => {
  const appRole = rawUser?.app_metadata?.role;
  if (appRole === "owner" || appRole === "manager" || appRole === "staff") {
    return appRole;
  }
  // Legacy fallback only (pre app_metadata migration):
  const legacyRole = rawUser?.user_metadata?.role;
  if (legacyRole === "owner" || legacyRole === "manager" || legacyRole === "staff") {
    return legacyRole;
  }
  return undefined;
};

async function fetchProfileFromSupabase(userId: string) {
  let { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    const alt = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    data = alt.data as any;
    error = alt.error as any;
    if (error && (error as any).code !== "PGRST116") throw error;
  }

  return { data, error };
}

// eslint-disable-next-line complexity
async function loadUserProfileInternal(params: {
  userId: string;
  userEmail?: string;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
}) {
  const { userId, userEmail, setProfile, setLoading } = params;
  try {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const { data, error } = await fetchProfileFromSupabase(userId);

    if (error) throw error;

    const resolvedEmail = normalizeEmail(
      userEmail || authUser?.email || (data as any)?.email
    );
    const metadataPermissions = getPermissionMetadata(authUser);

    if (!data) {
      console.warn("No profile found for user, creating default profile");
      const defaultProfile: UserProfile = {
        id: userId,
        email: userEmail || authUser?.email || "unknown",
        role: isForcedOwnerEmail(resolvedEmail) ? "owner" : "staff",
        permissions: metadataPermissions,
        custom_permissions: metadataPermissions,
        permission_overrides: metadataPermissions,
        created_at: new Date().toISOString(),
      };
      setProfile(defaultProfile);
      return;
    }

    const profilePermissions =
      ((data as any)?.custom_permissions as Record<string, boolean> | undefined) ||
      ((data as any)?.permission_overrides as Record<string, boolean> | undefined) ||
      ((data as any)?.permissions as Record<string, boolean> | undefined) ||
      {};
    // The DB profile row is the source of truth. app_metadata (service-role-only)
    // fills gaps for legacy accounts whose profile lacks a permissions column.
    const mergedPermissions = {
      ...metadataPermissions,
      ...profilePermissions,
    };
    const resolvedRole =
      (data as any).role || getMetadataRole(authUser) || "staff";
    const normalizedProfile = {
      ...(data as any),
      role: isForcedOwnerEmail(resolvedEmail)
        ? ("owner" as const)
        : resolvedRole,
      permissions: mergedPermissions,
      custom_permissions: mergedPermissions,
      permission_overrides: mergedPermissions,
    };
    setProfile(normalizedProfile as UserProfile);
  } catch (error: any) {
    console.error("Error loading user profile:", error);
    const resolvedEmail = normalizeEmail(userEmail);
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const metadataPermissions = getPermissionMetadata(authUser);
    const defaultProfile: UserProfile = {
      id: userId,
      email: userEmail || authUser?.email || "unknown",
      role: isForcedOwnerEmail(resolvedEmail)
        ? "owner"
        : (getMetadataRole(authUser) || "staff"),
      permissions: metadataPermissions,
      custom_permissions: metadataPermissions,
      permission_overrides: metadataPermissions,
      name: authUser?.user_metadata?.name || authUser?.email?.split("@")?.[0],
      created_at: new Date().toISOString(),
      branch_id: "CN1",
    };
    setProfile(defaultProfile);

    if (error?.code !== "PGRST205" && error?.code !== "PGRST116") {
      console.warn("Suppressed profile loading error to prevent toast loop");
    }
  } finally {
    setLoading(false);
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [currentAAL, setCurrentAAL] =
    useState<AuthenticatorAssuranceLevels | null>(null);

  const loadUserProfile = useCallback(
    async (userId: string, userEmail?: string) => {
      await loadUserProfileInternal({
        userId,
        userEmail,
        setProfile,
        setLoading,
      });
    },
    []
  );

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Set timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          console.warn('Profile loading timeout - forcing loading to false');
          setLoading(false);
        }, 10000); // 10 second timeout

        loadUserProfile(session.user.id, session.user.email).finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const handleAuthEvent = async (
      event: AuthChangeEvent,
      nextSession: Session | null
    ) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        loadUserProfile(nextSession.user.id, nextSession.user.email);
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthEvent);

    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadUserProfile]);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ mfaRequired: boolean }> => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setError(null);

    // Check if MFA is required
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData) {
      setCurrentAAL(aalData.currentLevel);

      // If user has MFA enrolled and hasn't verified yet (AAL1 but needs AAL2)
      if (aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1") {
        setMfaRequired(true);
        // Audit login attempt (best-effort)
        const _userId = data?.user?.id || null;
        safeAudit(_userId, { action: "auth.login_mfa_pending" });
        return { mfaRequired: true };
      }
    }

    // No MFA required, complete login
    const _userId = data?.user?.id || null;
    safeAudit(_userId, { action: "auth.login" });
    return { mfaRequired: false };
  };

  // Called after successful MFA verification
  const completeMFAVerification = () => {
    setMfaRequired(false);
    setCurrentAAL("aal2");
    // Audit successful MFA login
    if (user?.id) {
      safeAudit(user.id, { action: "auth.login_mfa_success" });
    }
  };

  // Check MFA status for current user
  const checkMFAStatus = async (): Promise<{
    hasMFA: boolean;
    requiresVerification: boolean;
  }> => {
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      const verifiedFactors =
        factorsData?.totp?.filter((f) => f.status === "verified") || [];
      const hasMFA = verifiedFactors.length > 0;
      const requiresVerification =
        aalData?.nextLevel === "aal2" && aalData?.currentLevel === "aal1";

      return { hasMFA, requiresVerification };
    } catch (err) {
      console.error("Error checking MFA status:", err);
      return { hasMFA: false, requiresVerification: false };
    }
  };

  const signOut = async () => {
    const _currentUserId = user?.id || null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setError(null);
    // Audit logout (best-effort)
    safeAudit(_currentUserId, { action: "auth.logout" });
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    error,
    // MFA
    mfaRequired,
    currentAAL,
    // Methods
    signIn,
    signOut,
    hasRole,
    completeMFAVerification,
    checkMFAStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
