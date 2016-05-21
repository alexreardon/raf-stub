const frames = [];
let frameId = 0;

export function add(cb) {
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

export function remove(id) {
    const index = frames.findIndex(frame => frame.id === id);

    if (index === -1) {
        return;
    }

    // remove frame from array
    frames.splice(index, 1);
}

export function flush() {
    while (frames.length) {
        step();
    }
}

export function step(steps = 1) {
    if (steps === 0) {
        return;
    }

    const shallow = frames.slice(0);
    shallow.forEach(frame => {
        frame.callback();
    });

    return step(steps - 1);
}

export function polyfill(root = typeof window !== 'undefined' ? window : global) {
    root.requestAnimationFrame = add;
    root.cancelAnimationFrame = remove;
}