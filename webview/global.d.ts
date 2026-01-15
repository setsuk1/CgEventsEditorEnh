declare global {
    function acquireVsCodeApi(): {
        postMessage(message: any): void;
        getState<T>(): T;
        setState<T>(newState: T): T;
    };
}

export { };

