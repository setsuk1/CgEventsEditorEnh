import { math } from './math';

export const modifier = {
    isExpressionTrue(input: string, defaultValue = true): boolean {
        try {
            input = input.replace(/'/g, '"').replace(/match\((.*),\s*(\/.*\/[\s\w]*)\)/g, 'match($1,"$2")');
            return this.isValueTrue(math.evaluate(input));
        } catch {
            return defaultValue;
        }
    },
    isValueTrue(input: any): boolean {
        return !(!input || input === 'false' || input === '0');
    }
} as const;
