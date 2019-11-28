module.exports = createLookupTransformer;

function createLookupTransformer(resolvers, fields, exclude) {
    if (!Array.isArray(exclude)) {
        exclude = [];
    }
    const transformIn = Object.fromEntries(
        Object.entries(fields)
            .filter(kv => kv[1] && kv[1].in)
            .map(kv => kv[1] && kv[1].in)
    );
    const transformOut = Object.fromEntries(
        Object.entries(fields)
            .filter(kv => kv[1] && kv[1].out)
            .map(kv => kv[1] && kv[1].out)
    );
    resolvers = createTransformerIn(resolvers, transformIn, exclude);
    resolvers = createTransformerOut(resolvers, transformOut, exclude);
    return resolvers;
}

function createTransformerIn(resolvers, transformIn, exclude) {
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
        let clonedArgs;
        // Convert field names
        if (Array.isArray(args && args.input && args.input.filter)) {
            clonedArgs = clone(args);
            clonedArgs.input.filter.forEach(processNamedEntry);
        }
        if (Array.isArray(args && args.input && args.input.order)) {
            clonedArgs = clonedArgs || clone(args);
            clonedArgs.input.order.forEach(processNamedEntry);
        }
        return resolvers.list(source, clonedArgs || args, context, info);

        function processNamedEntry(entry) {
            if (Object.hasOwnProperty.call(transformIn, entry.field)) {
                entry.field = String(transformIn[entry.field]);
            }
        }
    }

    function wrapStandardInput(resolver) {
        return async (source, args, context, info) => resolver(
            source,
            await convertInput(source, args, context, info),
            context,
            info
        );
    }

    async function convertInput(source, args, context, info) {
        if (!args || !args.input) {
            return args;
        }
        return args && {
            ...args,
            input: await convert({ value: args.input, transform: transformIn, source, context, info })
        };
    }
}

function createTransformerOut(resolvers, transformOut, exclude) {
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
            edges: await Promise.all(
                result.edges.map(
                    async edge => ({
                        ...edge,
                        node: await convert({
                            value: edge.node,
                            transform: transformOut,
                            source,
                            context,
                            info
                        })
                    })
                )
            )
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
            return convert({ value: result, transform: transformOut, source, context, info });
        };
    }
}

async function convert({ value, transform, source, context, info }) {
    if (!value || typeof value !==`object`) {
        return value;
    }
    value = clone(value);
    await Promise.all(Object.keys(transform).map(async key => {
        if (Object.hasOwnProperty.call(value, key)) {
            value[key] = await transform[key](
                source,
                { input: { value: value[key] } },
                context,
                info
            );
        }
    }));
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
