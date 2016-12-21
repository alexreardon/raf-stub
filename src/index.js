// @flow
const now = require('performance-now');
const defaultDuration: number = 1000 / 60;

type Api = {
    add: (cb: Function) => number,
    remove: (id: number) => void,
    flush: (duration: ?number) => void,
    reset: () => void,
    step: (steps?: number, duration?: ?number) => void
};

export default function createStub (frameDuration: number = defaultDuration, startTime: number = now()): Api {
    const frames = [];
    let frameId = 0;
    let currentTime = startTime;

    const add = (cb: Function): number => {
        const id = ++frameId;

        const callback = (time) => {
            cb(time);
            // remove callback from frames after calling it
            remove(id);
        };

        frames.push({
            id,
            callback
        });

        return id;
    };

    const remove = (id: number): void => {
        const index = frames.findIndex(frame => frame.id === id);

        if (index === -1) {
            return;
        }

        // remove frame from array
        frames.splice(index, 1);
    };

    const flush = (duration? = frameDuration): void => {
        while (frames.length) {
            step(1, duration);
        }
    };

    const reset = (): void => {
        frames.length = 0;
        currentTime = startTime;
    };

    const step = (steps?: number = 1, duration?: ?number = frameDuration): void => {
        if (steps === 0) {
            return;
        }

        currentTime = currentTime + duration;

        const shallow = frames.slice(0);
        shallow.forEach(frame => {
            frame.callback(currentTime);
        });

        return step(steps - 1, duration);
    };

    const api: Api = {
        add,
        remove,
        reset,
        flush,
        step
    };

    return api;
};

// all calls to replaceRaf get the same stub;
type ReplaceRafOptions = {
    duration?: number,
    startTime?: number
};

// 0.3.x api
declare function replaceRaf(...rest: Array<Object>): void;

// new api
declare function replaceRaf(roots?: Object[], options?: ?ReplaceRafOptions): void;

export function replaceRaf(roots?: Object[] = [], {duration = defaultDuration, startTime = now()}: ReplaceRafOptions = {}) {
    // 0.3.x api support
    if (arguments.length && !Array.isArray(roots)) {
        console.warn('replaceRaf(roots) has been depreciated. Please now use replaceRaf([roots], options). See here for more details: https://github.com/alexreardon/raf-stub/releases');
        roots = Array.from(arguments);
    }

    // automatic usage of 'window' or 'global'
    if (!roots.length) {
        roots.push(typeof window !== 'undefined' ? window : global);
    }

    const stub = createStub(duration, startTime);

    roots.forEach(root => {
        root.requestAnimationFrame = stub.add;
        Object.assign(root.requestAnimationFrame, {
            step: stub.step,
            flush: stub.flush,
            reset: stub.reset
        });

        root.cancelAnimationFrame = stub.remove;
    });
};