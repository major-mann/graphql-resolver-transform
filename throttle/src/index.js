module.exports = createThrottleTransformer;

const throttle = require(`lodash.throttle`);

function createThrottleTransformer(resolvers, wait, exclude) {
    exclude = exclude || [];

    if (wait > 0) {
        wait = Object.fromEntries(Object.keys(resolvers).map(key => [key, wait]));
    }
    if (!wait || typeof wait !== `object`) {
        throw new Error(`wait must either be a numeric value in ms to throttle to, ` +
            `or an object with names and wait times for each resolver`);
    }

    if (Object.keys(wait).length === 0) {
        return resolvers;
    }

    const entries = Object.entries(resolvers)
        .filter(entry => !exclude.includes(entry[0]))
        .map(wrapEntry);

    return {
        ...resolvers,
        ...Object.fromEntries(entries)
    };

    function wrapEntry([name, resolver]) {
        const throttled = memoizedThrottle(resolver, wait[name]);
        return [name, throttled];
    }
}

function memoizedThrottle(handler, wait) {
    const cache = {};
    return memoized;

    function memoized(source, args, context, info) {
        const key = cacheKey(args.input);
        if (!cache.hasOwnProperty(key)) {
            cache[key] = throttle(handler, wait);
        }
        return cache[key](source, args, context, info);
    }

    function cacheKey(...args) {
        args = args.map(normalize);
        return JSON.stringify(args);
    }

    function normalize(value) {
        if (Array.isArray(value)) {
            return value.map(normalize);
        } else if (value && typeof value === `object`) {
            return Object.fromEntries(
                Object
                    .entries(value)
                    .sort((a, b) => lexical(a[0], b[0]))
                    .map(entry => [entry[0], normalize(entry[1])])
            );
        } else {
            return value;
        }
    }

    function lexical(a, b) {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        } else {
            return 0;
        }
    }
}
