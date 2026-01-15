import { all, create } from 'mathjs';

export const math = create(all, {});

math.import({
    equal(a: string, b: string) {
        return a === b;
    },
    unequal(a: string, b: string) {
        return a !== b;
    },
    includes(a: any, b: string) {
        let c: string[];
        if (Array.isArray(a)) {
            c = a;
        } else if (a && typeof a === 'object' && typeof a.toArray === 'function') {
            c = a.toArray();
        }
        return c?.includes(b) ?? (a + '').includes(b);
    },
    match(a: string, b: string) {
        const c = b && b.match(/^\/(.*)\/([a-z]*)$/);
        if (c) {
            return a.match(new RegExp(c[1], c[2]));
        }
        return a.includes(b);
    }
}, {
    override: true
});
