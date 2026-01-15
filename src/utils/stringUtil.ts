export const stringUtil = {
    compareCaseAware(a: string, b: string): 0 | 1 | -1 {
        const la = a.toLowerCase();
        const lb = b.toLowerCase();

        if (la < lb) {
            return -1;
        }
        if (la > lb) {
            return 1;
        }

        if (a === la && b !== lb) {
            return -1;
        }
        if (a !== la && b === lb) {
            return 1;
        }

        return 0;
    }
} as const;
