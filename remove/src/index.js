module.exports = createRemoveTransformer;

function createRemoveTransformer(resolvers, removeIn, removeOut, exclude) {
    exclude = normalizeArray(exclude);
    removeIn = normalizeArray(removeIn);
    removeOut = normalizeArray(removeOut);

    if (!removeIn.length && !removeOut.length) {
        // Nothing to do
        return resolvers;
    }

    resolvers = createTransformerIn(resolvers, removeIn, exclude);
    resolvers = createTransformerOut(resolvers, removeOut, exclude);
    return resolvers;

    function normalizeArray(arr) {
        if (Array.isArray(arr)) {
            return arr;
        } else if (arr) {
            return [arr];
        } else {
            return [];
        }
    }
}

function createTransformerIn(resolvers, removeIn, exclude) {
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
            const wrapped = wrapStandardInput(resolvers[entry[0]]);
            return [entry[0], wrapped];
        }
    }

    function list(source, args, context, info) {
        if (Array.isArray(args && args.input && args.input.filter)) {
            args.input.filter.forEach(filter => processNamedEntry(`filter`, filter));
        }
        if (Array.isArray(args && args.input && args.input.order)) {
            args.input.order.forEach(order => processNamedEntry(`order`, order));
        }
        return resolvers.list(source, args, context, info);

        function processNamedEntry(type, entry) {
            if (removeIn.includes(entry.field)) {
                throw new Error(`Cannot ${type} on removed field "${entry.field}"`);
            }
        }
    }

    function wrapStandardInput(resolver) {
        return function wrapped(source, args, context, info) {
            let clonedArgs = args;
            if (clonedArgs && clonedArgs.input) {
                clonedArgs = {
                    ...args,
                    input: convert(args.input, removeIn)
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

function createTransformerOut(resolvers, removeOut, exclude) {
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
                node: convert(edge.node, removeOut)
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
            return convert(result, removeOut);
        };
    }
}

function convert(value, remove) {
    if (!value || typeof value !==`object`) {
        return value;
    }
    value = clone(value);
    if (value) {
        remove.forEach(name => {
            delete value[name];
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
