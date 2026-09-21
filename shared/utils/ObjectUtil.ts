/**
 * Modified from https://code.gamelet.com/view/Base/1.11.17
 */

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export class ObjectUtil {

    /**
     * Create a new object and deep clone data from provided source.
     *
     * @param {any} data
     * @return {any}
     */
    public static deepCloneObject(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }
        if (Array.isArray(data)) {
            return data.map(item => ObjectUtil.deepCloneObject(item));
        }
        const obj: Record<string, unknown> = {};
        for (const key of Object.keys(data)) {
            if (!UNSAFE_OBJECT_KEYS.has(key)) {
                obj[key] = ObjectUtil.deepCloneObject(data[key]);
            }
        }
        return obj;
    }

    /**
     * Compare 2 objects to see if they contains same data.
     *
     * @param {any} data0
     * @param {any} data1
     * @return {boolean}
     */
    public static equals(data0: any, data1: any): boolean {
        if (data0 === data1) {
            return true;
        }
        if (!data0 || !data1 || typeof data0 !== 'object' || typeof data1 !== 'object') {
            return false;
        }
        if (Array.isArray(data0)) {
            if (!Array.isArray(data1) || data0.length !== data1.length) {
                return false;
            }
            for (let i = 0; i < data0.length; ++i) {
                if (!ObjectUtil.equals(data0[i], data1[i])) {
                    return false;
                }
            }
            return true;
        }
        if (Array.isArray(data1)) {
            return false;
        }

        const keys = Object.keys(data0);
        if (keys.length !== Object.keys(data1).length) {
            return false;
        }
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(data1, key) || !ObjectUtil.equals(data0[key], data1[key])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Similar to Object.assign, but will not overwrite child that is object-typed.
     * safeAssign() will recursively safeAssign object-typed children.
     *
     * @param {any} target The target object.
     * @param {any} source The source object(s).
     * @return {any} The target object.
     */
    public static safeAssign(target: any, source: any): any {
        if (!source || typeof source !== 'object') {
            return source;
        }

        if (Array.isArray(source)) {
            const result = Array.isArray(target) ? target : [];
            result.length = source.length;
            for (let i = 0; i < source.length; ++i) {
                result[i] = ObjectUtil.safeAssign(result[i], source[i]);
            }
            return result;
        }

        const result = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
        for (const key of Object.keys(source)) {
            if (!UNSAFE_OBJECT_KEYS.has(key)) {
                result[key] = ObjectUtil.safeAssign(result[key], source[key]);
            }
        }
        return result;
    }

    /**
     * Remove keys on data that contain same value as in reference.
     *
     * @param {any} target The target object that is being modified.
     * @param {any} reference The reference object.
     * @return {any} The target object.
     */
    public static removeKeysWithSameValue(target: any, reference: any): any {
        if (!target || typeof target !== 'object' || !reference || typeof reference !== 'object') {
            return target;
        }
        if (Array.isArray(target)) {
            if (Array.isArray(reference)) {
                for (let i = 0; i < target.length; ++i) {
                    ObjectUtil.removeKeysWithSameValue(target[i], reference[i]);
                }
            }
            return target;
        }
        if (Array.isArray(reference)) {
            return target;
        }
        for (const key of Object.keys(target)) {
            if (UNSAFE_OBJECT_KEYS.has(key)) {
                delete target[key];
                continue;
            }
            const value = target[key];
            const refValue = reference[key];
            if (value === refValue) {
                delete target[key];
            } else {
                ObjectUtil.removeKeysWithSameValue(value, refValue);
            }
        }
        return target;
    }

    public static forEach(obj: { [key: string]: any }, callback: (key: string, value: any, obj?: { [key: string]: any }) => void): void {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            throw new Error(Array.isArray(obj) ? 'ObjectUtil.forEach: obj is an array, use Array.forEach instead.' : 'ObjectUtil.forEach: not an object');
        }
        Object.keys(obj).forEach(key => {
            if (!UNSAFE_OBJECT_KEYS.has(key)) {
                callback(key, obj[key], obj);
            }
        });
    }

    public static map(obj: { [key: string]: any }, callback: (key: string, value: any, obj?: { [key: string]: any }) => any): { [key: string]: any } {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            throw new Error(Array.isArray(obj) ? 'ObjectUtil.map: obj is an array, use Array.map instead.' : 'ObjectUtil.map: not an object');
        }
        const ret: any = {};
        Object.keys(obj).forEach(key => {
            if (!UNSAFE_OBJECT_KEYS.has(key)) {
                ret[key] = callback(key, obj[key], obj);
            }
        });
        return ret;
    }

    public static isPromise(value: any): boolean {
        return value && Promise.resolve(value) === value;
    }

    public static isEmpty(obj: any): boolean {
        return !obj || Object.keys(obj).length === 0;
    }

    public static toSafeJson(source: any, maxDeep: number = 3): any {
        if (source) {
            if (typeof source === 'object') {
                if (Array.isArray(source)) {
                    if (maxDeep <= 0) {
                        return { _type: 'array', length: source.length };
                    }
                    return source.map(el => ObjectUtil.toSafeJson(el, maxDeep - 1));
                }
                if (maxDeep <= 0) {
                    return { _type: 'object' };
                }
                const newObj: any = {};
                Object.keys(source).forEach(key => {
                    if (!UNSAFE_OBJECT_KEYS.has(key)) {
                        newObj[key] = ObjectUtil.toSafeJson(source[key], maxDeep - 1);
                    }
                });
                return newObj;
            } else if (typeof source === 'function') {
                return { _type: 'function' };
            }
        }
        return source;
    }

    public static isSimpleObject(obj: any): boolean {
        return !!obj && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype;
    }
}