/**
 * Modified from https://code.gamelet.com/view/Base/1.11.17
 */
export class ObjectUtil {

    /**
     * Create a new object and deep clone data from provided source.
     * 
     * @param {any} data
     * @return {any}
     */
    public static deepCloneObject(data: any): any {
        if (!data) {
            return data;
        }
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                return data.map(item => ObjectUtil.deepCloneObject(item));
            } else {
                const obj: Record<string, unknown> = {};
                for (let key in data) {
                    obj[key] = ObjectUtil.deepCloneObject(data[key]);
                }
                return obj;
            }
        }
        return data;
    }

    /**
     * Compare 2 objects to see if they contains same data.
     * 
     * @param {any} data0
     * @param {any} data1
     * @return {boolean}
     */
    public static equals(data0: any, data1: any): boolean {
        if (data0 && data1 && typeof data0 === 'object' && typeof data1 === 'object') {
            if (Array.isArray(data0)) {
                if (Array.isArray(data1)) {
                    // array comparing
                    let len = data0.length;
                    if (data1.length !== len) {
                        return false;
                    }
                    for (let i = 0; i < len; ++i) {
                        if (!ObjectUtil.equals(data0[i], data1[i])) {
                            return false;
                        }
                    }
                    return true;
                }
                return false;
            } else if (Array.isArray(data1)) {
                return false;
            }

            // object comparing
            let keys0 = Object.keys(data0);
            let keys1 = Object.keys(data1);
            let len = keys0.length;
            if (len !== keys1.length) {
                return false;
            }
            keys0.sort();
            keys1.sort();
            for (let i = 0; i < len; ++i) {
                let key = keys0[i];
                if (key !== keys1[i]) {
                    return false;
                }
                if (!ObjectUtil.equals(data0[key], data1[key])) {
                    return false;
                }
            }
            return true;
        }
        return data0 === data1;
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
        if (source && typeof source === 'object') {
            if (target && typeof target === 'object') {
                if (Array.isArray(source)) {
                    if (Array.isArray(target)) {
                        // copy array items
                        for (let i = 0; i < source.length; ++i) {
                            target[i] = ObjectUtil.safeAssign(target[i], source[i]);
                        }
                        return target;
                    } else {
                        return ObjectUtil.safeAssign([], source);
                    }
                } else if (Array.isArray(target)) {
                    return ObjectUtil.safeAssign({}, source);
                } else {
                    // copy object items
                    for (let key in source) {
                        target[key] = ObjectUtil.safeAssign(target[key], source[key]);
                    }
                    return target;
                }

            } else if (Array.isArray(source)) {
                return ObjectUtil.safeAssign([], source);
            } else {
                return ObjectUtil.safeAssign({}, source);
            }
        } else {
            return source;
        }
    }

    /**
     * Remove keys on data that contain same value as in reference.
     * 
     * @param {any} data The target object that is being modified.
     * @param {any} reference The reference object.
     * @return {any} The target object.
     */
    public static removeKeysWithSameValue(target: any, reference: any): any {
        if (target && typeof target === 'object' && reference && typeof reference === 'object') {
            if (Array.isArray(target)) {
                if (Array.isArray(reference)) {
                    for (let i = 0; i < target.length; ++i) {
                        ObjectUtil.removeKeysWithSameValue(target[i], reference[i]);
                    }
                }
            } else if (Array.isArray(reference)) {
                // do nothing with object vs array
            } else {
                for (let key in target) {
                    let value = target[key];
                    let refValue = reference[key];
                    if (value === refValue) {
                        delete target[key];
                    } else {
                        ObjectUtil.removeKeysWithSameValue(value, refValue);
                    }
                }
            }
        }
        return target;
    }

    public static forEach(obj: { [key: string]: any }, callback: (key: string, value: any, obj?: { [key: string]: any }) => void): void {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                throw new Error('ObjectUtil.forEach: obj is an array, use Array.forEach instead.');
            }

            Object.keys(obj).forEach(key => {
                callback(key, obj[key], obj);
            });


        } else {
            throw new Error('ObjectUtil.forEach: not an object');
        }
    }

    public static map(obj: { [key: string]: any }, callback: (key: string, value: any, obj?: { [key: string]: any }) => any): { [key: string]: any } {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                throw new Error('ObjectUtil.map: obj is an array, use Array.map instead.');
            }

            let ret: any = {};
            Object.keys(obj).map(key => {
                ret[key] = callback(key, obj[key], obj);
            });
            return ret;
        } else {
            throw new Error('ObjectUtil.map: not an object');
        }
    }

    public static isPromise(value: any): boolean {
        return value && Promise.resolve(value) === value;
    }

    public static isEmpty(obj: any): boolean {
        if (obj) {
            for (let key in obj) {
                return false;
            }
        }
        return true;
    }

    public static toSafeJson(source: any, maxDeep: number = 3): any {
        if (source) {
            if (typeof source === 'object') {
                if (Array.isArray(source)) {
                    if (maxDeep <= 0) {
                        return { _type: 'array', length: source.length };
                    }
                    return source.map(el => ObjectUtil.toSafeJson(el, maxDeep - 1));
                } else {
                    if (maxDeep <= 0) {
                        return { _type: 'object' };
                    }
                    let newObj: any = {};
                    Object.keys(source).forEach(key => {
                        newObj[key] = ObjectUtil.toSafeJson(source[key], maxDeep - 1);
                    });
                    return newObj;
                }
            } else if (typeof source === 'function') {
                return { _type: 'function' };
            }
        }
        return source;
    }

    public static isSimpleObject(obj: any): boolean {
        if (obj && typeof obj === 'object') {
            return Object.getPrototypeOf(obj) === Object.prototype;
        }
        return false;
    }
}
