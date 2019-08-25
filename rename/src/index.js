module.exports = createTransformer;

function createTransformer(resolvers, transform) {
    const transformIn = Object.fromEntries(
        Object.entries(transform).map(kv => kv.reverse())
    );
    const transformOut = clone(transform);
    resolvers = createTransformerIn(resolvers, transformIn);
    resolvers = createTransformerOut(resolvers, transformOut);
    return resolvers;
}

function createTransformerIn(resolvers, transformIn) {
    return {
        list,
        find: wrapStandardInput(resolvers.find),
        create: wrapStandardInput(resolvers.create),
        upsert: wrapStandardInput(resolvers.upsert),
        update: wrapStandardInput(resolvers.update),
        delete: wrapStandardInput(resolvers.delete)
    };

    function list(source, args, context, info) {
        let clonedArgs;
        // Convert field names
        if (Array.isArray(args.filter)) {
            clonedArgs = clone(args);
            clonedArgs.filter.forEach(processNamedEntry);
        }
        if (Array.isArray(args.order)) {
            clonedArgs = clonedArgs || clone(args);
            clonedArgs.order.forEach(processNamedEntry);
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

function createTransformerOut(resolvers, transformOut) {
    return {
        list,
        find: wrapStandardOutput(resolvers.find),
        create: wrapStandardOutput(resolvers.create),
        upsert: wrapStandardOutput(resolvers.upsert),
        update: wrapStandardOutput(resolvers.update),
        delete: wrapStandardOutput(resolvers.delete)
    };

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
