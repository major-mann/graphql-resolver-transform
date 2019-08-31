module.exports = createAddTransformer;

function createAddTransformer(resolvers, addIn, addOut, exclude) {
    exclude = exclude || [];
    if (addIn) {
        resolvers = createTransformerIn(resolvers, addIn, exclude);
    }
    if (addOut) {
        resolvers = createTransformerOut(resolvers, addOut, exclude);
    }
    return resolvers;
}

function createTransformerIn(resolvers, addIn, exclude) {
    const entries = Object.entries(resolvers)
        .filter(entry => !exclude.includes(entry[0]))
        .map(wrapEntry);

    return {
        ...resolvers,
        ...Object.fromEntries(entries)
    };

    function wrapEntry(entry) {
        if (entry[0] === `list`) {
            return [`list`, resolvers.list];
        } else {
            const wrapped = wrapStandardInput(resolvers[entry[0]]);
            return [entry[0], wrapped];
        }
    }

    function wrapStandardInput(resolver) {
        return function wrapped(source, args, context, info) {
            let clonedArgs = args;
            if (clonedArgs && clonedArgs.input) {
                clonedArgs = {
                    ...args,
                    input: convert(args.input, addIn)
                };
            }
            return resolver(
                source,
                clonedArgs,
                context,
                info
            );
        }
    }
}

function createTransformerOut(resolvers, addOut, exclude) {
    const entries = Object.entries(resolvers)
        .filter(entry => !exclude.includes(entry[0]))
        .map(wrapEntry);

    return {
        ...resolvers,
        ...Object.fromEntries(entries)
    };

    function wrapEntry(entry) {
        if (entry[0] === `list`) {
            return [`list`, list];
        } else {
            const wrapped = wrapStandardOutput(resolvers[entry[0]]);
            return [entry[0], wrapped];
        }
    }

    async function list(source, args, context, info) {
        const result = await resolvers.list(
            source,
            args,
            context,
            info
        );
        return {
            ...result,
            edges: result.edges.map(edge => ({
                ...edge,
                node: convert(edge.node, addOut)
            }))
        };
    }

    function wrapStandardOutput(resolver) {
        return async (source, args, context, info) => {
            const result = await resolver(
                source,
                args,
                context,
                info
            );
            return convert(result, addOut);
        };
    }
}

function convert(value, add) {
    if (!value || typeof value !==`object`) {
        return value;
    }
    value = clone(value);
    if (value) {
        Object.keys(add).forEach(name => {
            if (typeof add[name] === `function`) {
                value[name] = add[name](value[name], value);
            } else {
                value[name] = add[name];
            }
        });
    }
    return value;
}

function clone(value) {
    if (Array.isArray(value)) {
        return value.map(clone);
    } else if (value && typeof value === `object`) {
        const res = {};
        Object.keys(value).forEach(key => {
            res[key] = clone(value[key]);
        });
        return res;
    } else {
        return value;
    }
}
