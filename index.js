export default function createStub() {
    const frames = [];
    let frameId = 0;

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

    function flush() {
        while (frames.length) {
            step();
        }
    }

    function reset() {
        frames.length = 0;
    }

    function step(steps = 1) {
        if (steps === 0) {
            return;
        }

        const shallow = frames.slice(0);
        shallow.forEach(frame => {
            frame.callback();
        });

        return step(steps - 1);
    }

    return {
        add, remove, reset, flush, step
    };
}

// all calls to enhance get the same stub;
export function enhance(...roots) {
    if (!roots.length) {
        roots.push(typeof window !== 'undefined' ? window : global);
    }

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