const now = require('performance-now');
const defaultDuration = 1000 / 60;

export default function createStub(frameDuration = defaultDuration) {
    const frames = [];
    let frameId = 0;
    const startTime = now();
    let currentTime = startTime;

    function add(cb) {
        const id = ++frameId;

        const callback = function () {
            cb();
            // remove callback from frames after calling it
            remove(id);
        };

        frames.push({
            id,
            callback
        });

        return id;
    }

    function remove(id) {
        const index = frames.findIndex(frame => frame.id === id);

        if (index === -1) {
            return;
        }

        // remove frame from array
        frames.splice(index, 1);
    }

    function flush(duration = frameDuration) {
        while (frames.length) {
            step(1, duration);
        }
    }

    function reset() {
        frames.length = 0;
        currentTime = startTime;
    }

    function step(steps = 1, duration = frameDuration) {
        if (steps === 0) {
            return;
        }

        currentTime = currentTime + duration;

        const shallow = frames.slice(0);
        shallow.forEach(frame => {
            frame.callback(currentTime);
        });

        return step(steps - 1);
    }

    return {
        add, remove, reset, flush, step
    };
}

// all calls to replaceRaf get the same stub;
export function replaceRaf(...roots) {
    if (!roots.length) {
        roots.push(typeof window !== 'undefined' ? window : global);
    }

    // TODO
    const stub = createStub();

    roots.forEach(root => {
        root.requestAnimationFrame = stub.add;
        Object.assign(root.requestAnimationFrame, {
            step: stub.step,
            flush: stub.flush,
            reset: stub.reset
        });

        root.cancelAnimationFrame = stub.remove;
    });
}