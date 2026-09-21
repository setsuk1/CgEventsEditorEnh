export const eventBlockTypes = ['trigger', 'check', 'action'] as const;

export type EventBlockType = typeof eventBlockTypes[number];

export function isEventBlockType(value: unknown): value is EventBlockType {
    return typeof value === 'string' && eventBlockTypes.some((blockType) => blockType === value);
}

export const ebtConv = {
    COMPLEX: {
        trigger: 'triggers',
        check: 'checks',
        action: 'actions'
    },
    UPPER: {
        trigger: 'TRIGGER',
        check: 'CHECK',
        action: 'ACTION'
    },
    COMPLEX_UPPER: {
        trigger: 'TRIGGERS',
        check: 'CHECKS',
        action: 'ACTIONS'
    },
    CAPITALIZE: {
        trigger: 'Trigger',
        check: 'Check',
        action: 'Action'
    },
    COMPLEX_CAPITALIZE: {
        trigger: 'Triggers',
        check: 'Checks',
        action: 'Actions'
    }
} as const;

export type LogicBlockKey = (typeof ebtConv.COMPLEX)[EventBlockType];
