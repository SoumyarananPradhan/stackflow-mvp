import { createContext } from "react";

export interface AuthUser {
  id: number;
  email: string;
  organization: {
    id: number;
    name: string;
  };
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
