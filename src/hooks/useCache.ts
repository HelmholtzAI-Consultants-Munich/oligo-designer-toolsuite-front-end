import { createContext, useContext } from "react";
import type { CacheContextType } from "../contexts/CacheProvider";

export const CacheContext = createContext<CacheContextType>({
    cached:
        <TArgs extends unknown[], TResult>(
            func: (...args: TArgs) => TResult | Promise<TResult>
        ) =>
        async (...args: TArgs): Promise<TResult> => {
            return (await func(...args)) as TResult;
        },
});

export const useCache = () => {
    return useContext(CacheContext);
};
