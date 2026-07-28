import { supabase } from "../supabaseClient";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export const useAuthMfa = () => {
  const listFactors = async (): Promise<MFAFactor[]> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data?.totp || [];
  };

  const enroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator App",
    });
    if (error) throw error;
    return data;
  };

  const challengeAndVerify = async (factorId: string, code: string) => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) throw error;
  };

  const unenroll = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  };

  const challenge = async (factorId: string) => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) throw error;
    return data;
  };

  const verify = async (factorId: string, challengeId: string, code: string) => {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });
    if (error) throw error;
    return data;
  };

  return { listFactors, enroll, challengeAndVerify, unenroll, challenge, verify };
};
