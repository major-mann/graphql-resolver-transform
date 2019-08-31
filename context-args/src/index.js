module.exports = createContextArgsTransformer;

function createContextArgsTransformer(resolvers, args, exclude) {
    exclude = normalizeArray(exclude);
    args = normalizeArray(args);

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
        if (context.args) {
            args = clone(args);
            args.input = args.input || {};
            args.input.filter = args.input.filter || [];
            Object.keys(context.args).forEach(arg => {
                args.input.filter.push({
                    field: arg,
                    op: `EQ`,
                    value: context.args[arg]
                });
            });
        }
        return resolvers.list(source, args, context, info);
    }

    function wrapStandardInput(resolver) {
        return function wrapped(source, args, context, info) {
            if (context.args) {
                args = clone(args);
                args.input = {
                    ...context.args,
                    ...args.input
                };
            }
            return resolver(
                source,
                args,
                context,
                info
            );
        };
    }

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
