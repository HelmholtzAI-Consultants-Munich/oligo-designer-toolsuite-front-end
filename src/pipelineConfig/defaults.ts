import { findSchemaDefinition, type RJSFSchema } from "@rjsf/utils";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Finds the Pydantic model that a property's form section is built from.
 *
 * @remarks
 * For a plain `$ref` property this is simply the referenced model. For a union, such as an
 * optional filter that can be enabled or disabled, it is the option that RJSF will render.
 *
 * For a discriminated union, RJSF picks the option whose discriminator matches the declared
 * default. When there is no declared default, RJSF falls back to the first option, and this
 * function does the same. The discriminator value of the chosen option is returned as well.
 * Including it in the seeded form data makes sure RJSF keeps rendering that same option.
 *
 * A union without a discriminator (e.g. `SomeModel | None`) is only followed when its declared
 * default is an object, because an object can only belong to the model and not to `None`.
 *
 * @param property - the property's JSON Schema
 * @param declared - the default that applies to the property
 * @param rootSchema - the full pipeline schema, used to resolve `$ref`s
 * @returns The `$ref` of the model and its discriminator value, or undefined if the property
 * does not hold a model
 */
const modelOption = (
    property: RJSFSchema,
    declared: unknown,
    rootSchema: RJSFSchema
): { ref: string; discriminator: Record<string, unknown> } | undefined => {
    if (property.$ref) {
        return { ref: property.$ref, discriminator: {} };
    }

    const refs = (property.oneOf ?? property.anyOf ?? []).flatMap((option) =>
        typeof option !== "boolean" && option.$ref ? [option.$ref] : []
    );
    const propertyName = (
        property.discriminator as { propertyName?: string } | undefined
    )?.propertyName;

    if (!propertyName) {
        return isRecord(declared) && refs.length > 0
            ? { ref: refs[0], discriminator: {} }
            : undefined;
    }

    const wanted = isRecord(declared) ? declared[propertyName] : undefined;
    for (const ref of refs) {
        let tag: unknown;
        try {
            const field = findSchemaDefinition(ref, rootSchema).properties?.[
                propertyName
            ];
            tag = typeof field === "boolean" ? undefined : field?.const;
        } catch {
            continue; // RJSF cannot render an option whose $ref does not resolve, so skip it
        }
        if (wanted === undefined ? ref === refs[0] : tag === wanted) {
            return { ref, discriminator: { [propertyName]: tag } };
        }
    }
    return undefined;
};

/**
 * Builds initial form data that preserves falsy defaults which RJSF would otherwise drop.
 *
 * @remarks
 * When a Pydantic field's default is a model instance, for example
 * `Tm_parameters: TmParameters = TmParameters(dnac2=0)` or
 * `BlastnSearchParameters(soft_masking=False)`, the JSON schema contains two defaults for the
 * same value: the override from the instance, and the default of the referenced model itself.
 *
 * The option `nestedDefaultsPrecedence: "ancestorWins"` is supposed to make the override win.
 * However, RJSF only applies it when the override is truthy (`computeDefaults` in @rjsf/utils
 * checks `defaults && ...`). An override of `0`, `false` or `""` is therefore treated as if
 * there were no override, and the model's own default is used instead. As a result, `dnac2`
 * shows 25 instead of 0, and `-soft_masking` shows an empty value instead of false. Passing
 * these values in as form data prevents RJSF from computing a default for them.
 *
 * This function follows overrides at any depth, because a default can contain a model which in
 * turn contains the override. It also follows the option of a union that RJSF renders, because
 * optional filters are modelled as unions.
 *
 * RJSF only applies a field's declared default as long as that field has no form data. Once a
 * field is seeded, its other declared defaults would be lost. To avoid this, a seeded field
 * receives its complete declared default and not just the falsy values. It also receives the
 * discriminator value of the option it was seeded for. Without it, the partial form data could
 * make RJSF choose a different option, for example silently enabling an optional filter.
 *
 * @param schema - the schema to walk
 * @param rootSchema - the full pipeline schema, used to resolve `$ref`s
 * @param inherited - the default that an ancestor declares for `schema`; it takes precedence
 * over the defaults `schema` declares itself
 * @param visited - the `$ref`s already followed on this path, used to stop on cyclic schemas
 * @returns Form data for every field that has a falsy declared default, nested by field name
 */
export const falsyDeclaredDefaults = (
    schema: RJSFSchema,
    rootSchema: RJSFSchema,
    inherited?: Record<string, unknown>,
    visited: ReadonlySet<string> = new Set()
): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};

    for (const [name, property] of Object.entries(schema.properties ?? {})) {
        if (typeof property === "boolean") {
            continue;
        }

        const fromAncestor = inherited !== undefined && name in inherited;
        const declared = fromAncestor ? inherited[name] : property.default;

        // RJSF applies a field's own falsy default correctly. It only drops a falsy default
        // that comes from an ancestor, so only those need to be seeded.
        if (fromAncestor && !declared) {
            defaults[name] = declared;
            continue;
        }

        const option = modelOption(property, declared, rootSchema);
        if (!option || visited.has(option.ref)) {
            continue;
        }

        let referenced: RJSFSchema;
        try {
            referenced = findSchemaDefinition(option.ref, rootSchema);
        } catch {
            continue; // a $ref that does not resolve has no defaults to seed
        }

        const nested = falsyDeclaredDefaults(
            referenced,
            rootSchema,
            isRecord(declared) ? declared : undefined,
            new Set(visited).add(option.ref)
        );

        if (Object.keys(nested).length > 0) {
            defaults[name] = {
                ...option.discriminator,
                ...(isRecord(declared) ? declared : {}),
                ...nested,
            };
        }
    }

    return defaults;
};
