import { findSchemaDefinition, type RJSFSchema } from "@rjsf/utils";

/**
 * Collects the falsy defaults a schema declares beside a `$ref`, which Pydantic emits when a
 * field's default is a model instance (e.g. `Tm_parameters: TmParameters = TmParameters(dnac2=0)`).
 *
 * @remarks
 * Such a field carries two defaults: the instance's override and the referenced model's own.
 * `nestedDefaultsPrecedence: "ancestorWins"` should make the override win, but RJSF gates that
 * on `defaults && ...` (`computeDefaults` in @rjsf/utils), so an override of `0`, `false` or
 * `""` reads as "no override" and the model's own default wins instead - `dnac2` renders as 25
 * rather than 0. Seeding these as form data stops RJSF computing a default for them at all.
 *
 * Only plain properties are walked, not `oneOf`/`anyOf` branches: seeding a branch's fields
 * would bias which branch RJSF matches, and so could silently enable an optional filter.
 *
 * @param schema - the schema to walk
 * @param rootSchema - the full pipeline schema, used to resolve `$ref`s
 * @param visited - the `$ref`s already followed on this path, guarding against cycles
 * @returns Form data holding every falsy declared default, nested by field name
 */
export const falsyDeclaredDefaults = (
    schema: RJSFSchema,
    rootSchema: RJSFSchema,
    visited: ReadonlySet<string> = new Set()
): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};

    for (const [name, property] of Object.entries(schema.properties ?? {})) {
        if (typeof property === "boolean" || !property.$ref) {
            continue;
        }

        let referenced: RJSFSchema;
        try {
            referenced = findSchemaDefinition(property.$ref, rootSchema);
        } catch {
            continue; // an unresolvable $ref has no defaults to seed
        }

        const declared = property.default;
        const nested: Record<string, unknown> =
            visited.has(property.$ref) || declared !== undefined
                ? {}
                : falsyDeclaredDefaults(
                      referenced,
                      rootSchema,
                      new Set(visited).add(property.$ref)
                  );

        if (declared !== null && typeof declared === "object") {
            for (const [field, value] of Object.entries(declared)) {
                if (!value) {
                    nested[field] = value;
                }
            }
        }

        if (Object.keys(nested).length > 0) {
            defaults[name] = nested;
        }
    }

    return defaults;
};
