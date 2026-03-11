import { createContext, useContext } from "react";
import type { AuthContextType } from "../types";

export const AuthContext = createContext<AuthContextType>(
    {} as AuthContextType
);


export const useAuth = () => useContext(AuthContext);
