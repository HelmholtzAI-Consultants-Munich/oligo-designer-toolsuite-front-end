import { useRef } from "react";
import { CacheContext } from "../hooks/useCache";

type Cache = Map<string, Map<string, unknown>>;

export interface CacheContextType {
    cached: <TArgs extends unknown[], TResult>(
        func: (...args: TArgs) => TResult | Promise<TResult>
    ) => (...args: TArgs) => Promise<TResult>;
}

export default function CacheProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const cache = useRef<Cache>(new Map());

    const cacheFunction = <TArgs extends unknown[], TResult>(
        func: (...args: TArgs) => TResult | Promise<TResult>
    ) => {
        return async (...args: TArgs): Promise<TResult> => {
            const funcHash = func.toString();
            const argsHash = JSON.stringify(args);
            if (cache.current.get(funcHash)?.get(argsHash)) {
                return cache.current.get(funcHash)?.get(argsHash) as TResult;
            }

            const result = await func(...args);
            if (!cache.current.get(funcHash)) {
                cache.current.set(funcHash, new Map());
            }
            cache.current.get(funcHash)?.set(argsHash, result);
            return result;
        };
    };

    return (
        <CacheContext
            value={{
                cached: cacheFunction,
            }}
        >
            {children}
        </CacheContext>
    );
}
