// @flow
import now from 'performance-now';
import { defaultFrameDuration } from './constants';

type Stub = {|
  add: {
    [[call]]: (cb: () => void) => number,
    remove: (id: number) => void,
    flush: (duration?: number) => void,
    reset: () => void,
    step: (steps?: number, duration?: number) => void
  },
  remove: (id: number) => void,
  flush: (duration?: number) => void,
  reset: () => void,
  step: (steps?: number, duration?: number) => void,
|};

type Frame = {|
  id: number,
  callback: Function
|};

export default function createStub (frameDuration: number = defaultFrameDuration, startTime: number = now()): Stub {
  const frames: Frame[] = [];
  let frameId: number = 0;
  let currentTime: number = startTime;

  const add = (cb: Function): number => {
    const id = ++frameId;

    const callback = (time: number) => {
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

  const flush = (duration?: number = frameDuration): void => {
    while (frames.length) {
      step(1, duration);
    }
  };

  const reset = (): void => {
    frames.length = 0;
    currentTime = startTime;
  };

  const step = (steps?: number = 1, duration?: number = frameDuration): void => {
    if (steps === 0) {
      return;
    }

    // This line can cause a precision error if both `currentTime`
    // and `duration` are numbers with decimal components.
    currentTime = currentTime + duration;

    const shallow = frames.slice(0);
    shallow.forEach(frame => {
      frame.callback(currentTime);
    });

    return step(steps - 1, duration);
  };

  add.remove = remove;
  add.reset = reset;
  add.flush = flush;
  add.step = step;

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

export function replaceRaf(
  root: ?any,
  { frameDuration = defaultFrameDuration, startTime = now() }: ReplaceRafOptions = {}
) {
  // automatic usage of 'window' or 'global' if no roots are provided
  if (root == null) {
    root = typeof window !== 'undefined' ? window : global
  }

  // all roots share the same stub
  const stub = createStub(frameDuration, startTime);
  root.requestAnimationFrame = stub.add;
  root.cancelAnimationFrame = stub.remove;
  return stub.add
}
