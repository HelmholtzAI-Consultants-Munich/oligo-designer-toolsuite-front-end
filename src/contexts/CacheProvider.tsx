import { useRef } from "react";
import { CacheContext } from "../hooks/useCache";

interface Cache {
    [key: string]: {
        [key: string]: unknown;
    };
}

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
    const cache = useRef<Cache>({});

    const cacheFunction = <TArgs extends unknown[], TResult>(
        func: (...args: TArgs) => TResult | Promise<TResult>
    ) => {
        return async (...args: TArgs): Promise<TResult> => {
            const funcHash = func.toString();
            const argsHash = JSON.stringify(args);
            if (cache.current[funcHash] && cache.current[funcHash][argsHash]) {
                return cache.current[funcHash][argsHash] as TResult;
            }

            const result = await func(...args);
            cache.current[funcHash] = {
                ...cache.current[funcHash],
                [argsHash]: result,
            };
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
