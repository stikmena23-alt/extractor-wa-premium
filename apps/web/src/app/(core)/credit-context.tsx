"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  plan: string | null;
  credits: number | null;
  name?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  generated_email?: string | null;
};

type CreditStatus = "loading" | "ready" | "error" | "unauthenticated";

interface SignInPayload {
  email: string;
  password: string;
}

interface CreditContextValue {
  session: Session | null;
  profile: Profile | null;
  credits: number | null;
  status: CreditStatus;
  lastError: string | null;
  spending: boolean;
  refreshing: boolean;
  spend: (amount?: number) => Promise<boolean>;
  refresh: () => Promise<void>;
  signIn: (payload: SignInPayload) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const CreditContext = createContext<CreditContextValue | undefined>(undefined);

function useProfileQuery(session: Session | null) {
  const supabase = getSupabaseBrowserClient();
  return useQuery<Profile | null, Error>({
    queryKey: ["profile", session?.user.id],
    queryFn: async () => {
      if (!session) {
        return null;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, plan, credits, name, personal_email, phone, generated_email",
        )
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }
      return data as Profile | null;
    },
    enabled: !!session,
    staleTime: 20_000,
    retry: 1,
  });
}

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "ready">("loading");
  const [lastError, setLastError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }
      if (error) {
        setAuthError(error.message);
        setAuthStatus("ready");
        return;
      }
      setSession(data.session ?? null);
      setAuthError(null);
      setAuthStatus("ready");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setAuthError(null);
        setAuthStatus("ready");
        if (!nextSession) {
          queryClient.removeQueries({ queryKey: ["profile"] });
        }
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, queryClient]);

  const profileQuery = useProfileQuery(session);

  const spendMutation = useMutation({
    mutationFn: async (amount: number = 1) => {
      if (!session) {
        throw new Error("Debes iniciar sesión para consumir créditos");
      }
      const payload: { amount?: number } = {};
      if (amount && amount !== 1) {
        payload.amount = amount;
      }
      const { error } = await supabase.rpc("spend_credit", payload);
      if (error) {
        throw new Error(error.message || "No se pudo descontar crédito");
      }
      return amount;
    },
    onMutate: async (amount = 1) => {
      setLastError(null);
      if (!session) {
        return undefined;
      }
      await queryClient.cancelQueries({ queryKey: ["profile", session.user.id] });
      const previous = queryClient.getQueryData<Profile | null>([
        "profile",
        session.user.id,
      ]);
      if (previous && previous.credits != null) {
        queryClient.setQueryData([
          "profile",
          session.user.id,
        ], {
          ...previous,
          credits: Math.max(0, Number(previous.credits) - amount),
        });
      }
      return { previous } as const;
    },
    onError: (error, _amount, context) => {
      const message = error instanceof Error ? error.message : String(error);
      setLastError(message);
      if (!session) {
        return;
      }
      if (context?.previous) {
        queryClient.setQueryData([
          "profile",
          session.user.id,
        ], context.previous);
      }
    },
    onSettled: () => {
      if (!session) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
    },
  });

  const refresh = useCallback(async () => {
    if (!session) {
      return;
    }
    setLastError(null);
    await queryClient.invalidateQueries({ queryKey: ["profile", session.user.id] });
  }, [queryClient, session]);

  const spend = useCallback(
    async (amount = 1) => {
      try {
        await spendMutation.mutateAsync(amount);
        return true;
      } catch (error) {
        console.error("Error gastando créditos", error);
        return false;
      }
    },
    [spendMutation],
  );

  const signIn = useCallback(
    async ({ email, password }: SignInPayload) => {
      setLastError(null);
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const message = error.message || "No se pudo iniciar sesión";
        setLastError(message);
        setAuthError(message);
        return false;
      }
      setSession(data.session ?? null);
      if (data.session?.user?.id) {
        queryClient.invalidateQueries({ queryKey: ["profile", data.session.user.id] });
      }
      return true;
    },
    [supabase, queryClient],
  );

  const signOut = useCallback(async () => {
    setLastError(null);
    setAuthError(null);
    await supabase.auth.signOut();
    setSession(null);
    queryClient.removeQueries({ queryKey: ["profile"] });
  }, [supabase, queryClient]);

  const credits = profileQuery.data?.credits ?? null;

  const status: CreditStatus = useMemo(() => {
    if (authStatus === "loading") {
      return "loading";
    }
    if (!session) {
      return authError ? "error" : "unauthenticated";
    }
    if (profileQuery.status === "pending") {
      return "loading";
    }
    if (profileQuery.status === "error") {
      return "error";
    }
    return "ready";
  }, [authStatus, session, authError, profileQuery.status]);

  const contextValue: CreditContextValue = useMemo(
    () => ({
      session,
      profile: profileQuery.data ?? null,
      credits,
      status,
      lastError: lastError || authError || (profileQuery.error?.message ?? null),
      spending: spendMutation.isPending,
      refreshing: profileQuery.isRefetching,
      spend,
      refresh,
      signIn,
      signOut,
    }),
    [
      session,
      profileQuery.data,
      credits,
      status,
      lastError,
      authError,
      profileQuery.error,
      spendMutation.isPending,
      profileQuery.isRefetching,
      spend,
      refresh,
      signIn,
      signOut,
    ],
  );

  return (
    <CreditContext.Provider value={contextValue}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCredits debe usarse dentro de CreditProvider");
  }
  return context;
}
