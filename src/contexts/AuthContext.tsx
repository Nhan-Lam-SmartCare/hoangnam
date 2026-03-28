import { createContext, useContext, useEffect, useState } from "react";
// Use a single Supabase client app-wide to avoid multiple GoTrue instances
import { supabase } from "../supabaseClient";
import type {
  User,
  Session,
  AuthChangeEvent,
  AuthenticatorAssuranceLevels,
} from "@supabase/supabase-js";
// import { safeAudit } from "../lib/repository/auditLogsRepository";
import { showToast } from "../utils/toast";

export type UserRole = "owner" | "manager" | "staff";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
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

        loadUserProfile(session.user.id).finally(() => {
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
        loadUserProfile(nextSession.user.id);
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
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      // Ưu tiên bảng profiles trước, sau đó fallback sang user_profiles nếu không có hoặc bảng không tồn tại
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error && (error as any).code !== "PGRST116") {
        // Lỗi khác PGRST116 (table not found) => ném lỗi để hiển thị
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

      if (error) throw error;
      if (!data) {
        // Nếu không có profile, tạo một profile mặc định để tránh stuck
        console.warn('No profile found for user, creating default profile');
        const defaultProfile: UserProfile = {
          id: userId,
          email: user?.email || 'unknown',
          role: 'staff', // default role
          created_at: new Date().toISOString(),
        };
        setProfile(defaultProfile);
      } else {
        setProfile(data as any);
      }
    } catch (error: any) {
      console.error("Error loading user profile:", error);
      // Suppress toast for missing table/row, just use default profile
      const defaultProfile: UserProfile = {
        id: userId,
        email: user?.email || 'unknown',
        role: (user?.user_metadata?.role as UserRole) || 'staff',
        name: user?.user_metadata?.name || user?.email?.split("@")[0],
        created_at: new Date().toISOString(),
        branch_id: "CN1"
      };
      setProfile(defaultProfile);

      // Only set error if it's NOT a missing table/data issue
      if (error?.code !== 'PGRST205' && error?.code !== 'PGRST116') {
        // setError("Không thể tải hồ sơ người dùng"); // Commented out to be safe against spam
        console.warn("Suppressed profile loading error to prevent toast loop");
      }
    } finally {
      setLoading(false);
    }
  };

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
        const userId = data?.user?.id || null;
        // safeAudit(userId, { action: "auth.login_mfa_pending" });
        return { mfaRequired: true };
      }
    }

    // No MFA required, complete login
    const userId = data?.user?.id || null;
    // safeAudit(userId, { action: "auth.login" });
    return { mfaRequired: false };
  };

  // Called after successful MFA verification
  const completeMFAVerification = () => {
    setMfaRequired(false);
    setCurrentAAL("aal2");
    // Audit successful MFA login
    if (user?.id) {
      // safeAudit(user.id, { action: "auth.login_mfa_success" });
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
    const currentUserId = user?.id || null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setError(null);
    // Audit logout (best-effort)
    // safeAudit(currentUserId, { action: "auth.logout" });
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
