// @flow
import now from 'performance-now';
import createStub, { replaceRaf } from '../src';
import { defaultFrameDuration } from '../src/constants';

describe('createStub', () => {
  it('should allow for different stub namespaces', () => {
    const api1 = createStub();
    const api2 = createStub();
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    api1.add(callback1);
    api2.add(callback2);

    api1.flush();

    expect(callback1).toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });

  it('should allow you to pass in a custom frame duration', () => {
    const customDuration = 1000;
    const startTime = now();
    const callback = jest.fn();
    const api = createStub(customDuration, startTime);

    api.add(callback);
    api.flush();

    expect(callback).toHaveBeenCalledWith(startTime + customDuration);
  });

  it('should allow you to pass in a custom start time', () => {
    const customDuration = 1000;
    const startTime = now() + 1000;
    const callback = jest.fn();
    const api = createStub(customDuration, startTime);

    api.add(callback);
    api.flush();

    expect(callback).toHaveBeenCalledWith(startTime + customDuration);
  });
});

describe('instance', () => {
  const startTime: number = now();
  const frameDuration: number = 10;
  let api;

  beforeEach(() => {
    api = createStub(frameDuration, startTime);
  });

  afterEach(() => {
    api.reset();
  });

  describe('add', () => {
    it('should return a unique id for each callback', () => {
      const callback1 = () => {
      };
      const callback2 = () => {
      };

      const id1: number = api.add(callback1);
      const id2: number = api.add(callback2);

      expect(id1).not.toEqual(id2);
    });
  });

  describe('remove', () => {
    it('should remove the callback from the queue', () => {
      const callback = jest.fn();

      const id = api.add(callback);
      api.remove(id);
      api.flush();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not remove other callbacks from the queue', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const id1 = api.add(callback1);
      // callback2 will not be removed
      api.add(callback2);
      api.remove(id1);
      // callback 2 should still be in the queue
      api.flush();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should do nothing if it cannot find a matching id', () => {
      const id: number = 6;

      expect(() => api.remove(id)).not.toThrow();
      expect(api.remove(id)).toBe(undefined);
    });
  });

  describe('step', () => {
    it('should execute all callbacks in the current frame', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      api.add(callback1);
      api.add(callback2);
      api.step();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove callbacks in the current frame', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      api.add(callback1);
      api.add(callback2);
      api.step();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      // should not call the stubs again
      api.step();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not execute callbacks in the next frame', () => {
      const parent = jest.fn().mockImplementation(() => {
        api.add(child);
      });
      const child = jest.fn();

      api.add(parent);
      api.step();

      expect(parent).toHaveBeenCalled();
      expect(child).not.toHaveBeenCalled();
    });

    it('should execute nested calls in the next frame', () => {
      const child = jest.fn();
      const parent = jest.fn().mockImplementation(() => {
        api.add(child);
      });

      api.add(parent);
      api.step();

      expect(parent).toHaveBeenCalled();
      expect(child).not.toHaveBeenCalled();

      // will allow the nested frame to fire
      api.step();

      expect(parent).toHaveBeenCalledTimes(1);
      expect(child).toHaveBeenCalled();
    });

    describe('"this" context', () => {
      function returnA() {
        return this.a;
      }

      it('should respect implicit bindings', () => {
        const bar = {
          a: 5,
          returnA,
        };
        let result;
        const callback = jest.fn().mockImplementation(function () {
          result = bar.returnA();
        });

        api.add(callback);
        api.flush();

        expect(result).toBe(bar.a);
      });

      it('should respect explicit bindings', () => {
        const hasA = {
          a: 5,
        };
        let result: number;
        const callback = jest.fn().mockImplementation(function () {
          result = returnA.call(hasA);
        });

        api.add(callback);
        api.flush();

        expect(result).toBe(hasA.a);
      });

      it('should respect hard bindings', () => {
        const hasA = {
          a: 5,
        };
        let result: number;
        const callback = jest.fn().mockImplementation(function () {
          result = returnA.bind(hasA)();
        });

        api.add(callback);
        api.flush();

        expect(result).toBe(hasA.a);
      });
    });

    describe('duration', () => {
      it('should use the default time when no duration is provided', () => {
        const callback = jest.fn();

        api.add(callback);
        api.step();

        expect(callback).toHaveBeenCalledWith(startTime + frameDuration);
      });

      it('should pass the current time + duration to callbacks', () => {
        const callback = jest.fn();
        const duration = 10;

        api.add(callback);
        api.step(1, duration);

        expect(callback).toHaveBeenCalledWith(startTime + duration);
      });

      it('should also pass the duration to mutli-step calls', () => {
        const duration = 10;
        const child = jest.fn();
        const parent = jest.fn().mockImplementation(() => {
          api.add(child);
        });

        api.add(parent);
        api.step(2, duration);

        expect(parent).toHaveBeenCalledWith(startTime + duration);
        expect(child).toHaveBeenCalledWith(startTime + duration * 2);
      });

      it('should increase the time taken by the duration in each step', () => {
        const child = jest.fn();
        const parent = jest.fn().mockImplementation(() => {
          api.add(child);
        });
        const parentDuration = 10;
        const childDuration = 100000;

        api.add(parent);
        api.step(1, parentDuration);
        api.step(1, childDuration);

        expect(parent).toHaveBeenCalledWith(startTime + parentDuration);
        expect(child).toHaveBeenCalledWith(startTime + parentDuration + childDuration);
      });
    });
  });

  describe('flush', () => {
    it('should execute all callbacks in the current frame', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      api.add(callback1);
      api.add(callback2);
      api.flush();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should execute all nested callbacks', () => {
      const parent = jest.fn().mockImplementation(() => {
        api.add(child);
      });
      const child = jest.fn();

      api.add(parent);
      api.flush();

      expect(parent).toHaveBeenCalled();
      expect(child).toHaveBeenCalled();
    });

    it('should execute all nested callbacks with the stubs frame duration', () => {
      const parent = jest.fn().mockImplementation(() => {
        api.add(child);
      });
      const child = jest.fn();

      api.add(parent);
      api.flush();

      expect(parent).toHaveBeenCalledWith(startTime + frameDuration);
      // double adding to replicate multiple addition precision issues
      expect(child).toHaveBeenCalledWith(startTime + frameDuration + frameDuration);
    });

    it('should allow you to flush callbacks with a provided frame duration', () => {
      const parent = jest.fn().mockImplementation(() => {
        api.add(child);
      });
      const child = jest.fn();
      const customDuration = frameDuration * 10;

      api.add(parent);
      api.flush(customDuration);

      expect(parent).toHaveBeenCalledWith(startTime + customDuration);
      // double adding to replicate multiple addition precision issues
      expect(child).toHaveBeenCalledWith(startTime + customDuration + customDuration);
    });

  });

  describe('reset', () => {
    it('should remove all callbacks in the current frame without calling them', () => {
      const callback = jest.fn();

      api.add(callback);
      api.reset();

      // would usually call the function
      api.flush();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove all callbacks in the current future frames without calling them', () => {
      const parent = jest.fn().mockImplementation(() => {
        api.add(child);
      });
      const child = jest.fn();

      api.add(parent);
      api.reset();

      expect(parent).not.toHaveBeenCalled();
      expect(child).not.toHaveBeenCalled();
    });

    it('should reset the current time back to the start time', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      api.add(callback1);
      api.flush();
      api.reset();

      // if not reset then duration would be startTime + 2 * duration
      api.add(callback2);
      api.flush();

      expect(callback1).toHaveBeenCalledWith(startTime + frameDuration);
      expect(callback2).toHaveBeenCalledWith(startTime + frameDuration);
    });
  });
});

describe('replaceRaf', () => {
  it('should replace root.requestAnimationFrame with "add"', () => {
    const root = {};
    const callback = jest.fn();

    replaceRaf([root]);
    root.requestAnimationFrame(callback);
    root.requestAnimationFrame.flush();

    expect(callback).toHaveBeenCalled();
  });

  it('should replace root.cancelAnimationFrame with "remove"', () => {
    const root = {};
    const callback = jest.fn();

    replaceRaf([root]);
    const id = root.requestAnimationFrame(callback);
    root.cancelAnimationFrame(id);
    root.requestAnimationFrame.flush();

    expect(callback).not.toHaveBeenCalled();
  });

  it('should add "step" to the root.requestAnimationFrame', () => {
    const root = {};
    const callback = jest.fn();

    replaceRaf([root]);
    root.requestAnimationFrame(callback);
    root.requestAnimationFrame.step();

    expect(callback).toHaveBeenCalled();
  });

  it('should add "flush" to the root.requestAnimationFrame', () => {
    const root = {};
    const callback = jest.fn();

    replaceRaf([root]);
    root.requestAnimationFrame(callback);
    root.requestAnimationFrame.flush();

    expect(callback).toHaveBeenCalled();
  });

  it('should add "reset" to the root.requestAnimationFrame', () => {
    const root = {};
    const callback = jest.fn();

    replaceRaf([root]);
    replaceRaf([root]);
    root.requestAnimationFrame(callback);
    root.requestAnimationFrame.reset();
    root.requestAnimationFrame.flush();

    expect(callback).not.toHaveBeenCalled();
  });

  it('should share stubs between roots', () => {
    const root1 = {};
    const root2 = {};

    replaceRaf([root1, root2]);

    expect(root1.requestAnimationFrame).toBe(root2.requestAnimationFrame);
  });

  it('should not share stubs between different calls', () => {
    const root1 = {};
    const root2 = {};

    replaceRaf([root1]);
    replaceRaf([root2]);

    expect(root1.requestAnimationFrame).not.toBe(root2.requestAnimationFrame);
  });

  describe('no root provided', () => {
    beforeEach(() => {
      // using the 'delete' keyword does not seem to clear these
      global.requestAnimationFrame = undefined;
      window.requestAnimationFrame = undefined;
    });

    it('should use the window if it exists', () => {
      expect(window.requestAnimationFrame).not.toBeDefined();

      replaceRaf();

      expect(window.requestAnimationFrame).toBeDefined();
    });

    it('should use the global if a window cannot be found', () => {
      expect(global.requestAnimationFrame).not.toBeDefined();

      replaceRaf();

      expect(global.requestAnimationFrame).toBeDefined();
    });
  });

  describe('time', () => {
    const startTime = now();

    it('should use the default duration if none is provided', () => {
      const root = {};
      const callback = jest.fn();

      replaceRaf([root], { startTime });

      root.requestAnimationFrame(callback);
      root.requestAnimationFrame.flush();

      expect(callback).toHaveBeenCalledWith(startTime + defaultFrameDuration);
    });

    it('should use the custom duration if none is provided', () => {
      const root = {};
      const callback = jest.fn();
      const customDuration = defaultFrameDuration * 1000;

      replaceRaf([root], {
        startTime,
        frameDuration: customDuration,
      });

      root.requestAnimationFrame(callback);
      root.requestAnimationFrame.flush();

      expect(callback).toHaveBeenCalledWith(startTime + customDuration);
    });

    it('should use the custom start time if none is provided', () => {
      const root = {};
      const callback = jest.fn();
      const customStartTime = startTime + 1000;

      replaceRaf([root], {
        startTime: customStartTime,
      });

      root.requestAnimationFrame(callback);
      root.requestAnimationFrame.flush();

      expect(callback).toHaveBeenCalledWith(customStartTime + defaultFrameDuration);
    });
  });
});
