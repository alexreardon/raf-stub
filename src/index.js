// @flow
const now = require('performance-now');
const defaultDuration: number = 1000 / 60;

type Stub = {|
    add: (cb: Function) => number,
    remove: (id: number) => void,
    flush: (duration: ?number) => void,
    reset: () => void,
    step: (steps?: number, duration?: ?number) => void
|};

export default function createStub (frameDuration: number = defaultDuration, startTime: number = now()): Stub {
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
            callback,
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

    const flush = (duration?: ?number = frameDuration): void => {
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

    const api: Stub = {
        add,
        remove,
        reset,
        flush,
        step,
    };

    return api;
}

type ReplaceRafOptions = {
    frameDuration?: number,
    startTime?: number
};

export function replaceRaf(roots?: Object[] = [], { frameDuration = defaultDuration, startTime = now() }: ReplaceRafOptions = {}) {
    // automatic usage of 'window' or 'global' if no roots are provided
    if (!roots.length) {
        roots.push(typeof window !== 'undefined' ? window : global);
    }

    // all roots share the same stub
    const stub = createStub(frameDuration, startTime);

    roots.forEach(root => {
        root.requestAnimationFrame = stub.add;
        Object.assign(root.requestAnimationFrame, {
            step: stub.step,
            flush: stub.flush,
            reset: stub.reset,
        });

        root.cancelAnimationFrame = stub.remove;
    });
}