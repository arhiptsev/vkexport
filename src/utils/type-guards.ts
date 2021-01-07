export function isFunction(key: any): key is Function {
    return typeof key === 'function';
}