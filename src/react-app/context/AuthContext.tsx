import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchCurrentUser,
  loginWithPassword,
  logoutUser,
  registerWithPassword,
  type AuthUser,
  type RegisterResult,
} from "@/react-app/lib/auth-client";

type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isPending: boolean;
  isFetching: boolean;
  fetchUser: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const initialFetchRan = useRef(false);

  const fetchUser = useCallback(async () => {
    setIsFetching(true);
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsFetching(true);
    try {
      const currentUser = await loginWithPassword(payload);
      setUser(currentUser);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsFetching(true);
    try {
      return await registerWithPassword(payload);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsFetching(true);
    try {
      await logoutUser();
      setUser(null);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (initialFetchRan.current) return;
    initialFetchRan.current = true;

    fetchUser().finally(() => {
      setIsPending(false);
    });
  }, [fetchUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isPending,
      isFetching,
      fetchUser,
      login,
      register,
      logout,
    }),
    [fetchUser, isFetching, isPending, login, logout, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
