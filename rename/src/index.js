module.exports = createRenameTransformer;

function createRenameTransformer(resolvers, transform, exclude) {
    if (!Array.isArray(exclude)) {
        exclude = [];
    }
    const transformIn = Object.fromEntries(
        Object.entries(transform).map(kv => kv.reverse())
    );
    const transformOut = clone(transform);
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
        return (source, args, context, info) => resolver(
            source,
            convertInput(args),
            context,
            info
        );
    }

    function convertInput(args) {
        if (!args || !args.input) {
            return args;
        }
        return args && {
            ...args,
            input: convert(args.input, transformIn)
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
            edges: result.edges.map(edge => ({
                ...edge,
                node: convert(edge.node, transformOut)
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
            return convert(result, transformOut);
        };
    }
}

function convert(value, transform) {
    if (!value || typeof value !==`object`) {
        return value;
    }
    value = clone(value);
    Object.keys(transform).forEach(key => {
        if (Object.hasOwnProperty.call(value, key)) {
            value[transform[key]] = value[key];
            delete value[key];
        }
    });
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
