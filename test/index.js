import createStub, {replaceRaf} from '../src';
import sinon from 'sinon';
import {expect} from 'chai';
import now from 'performance-now';

const defaultDuration = 1000 / 60;

describe('createStub', () => {
    it('should allow for different stub namespaces', () => {
        const api1 = createStub();
        const api2 = createStub();
        const callback1 = sinon.stub();
        const callback2 = sinon.stub();

        api1.add(callback1);
        api2.add(callback2);

        api1.flush();

        expect(callback1.called).to.be.true;
        expect(callback2.called).to.be.false;
    });

    it('should allow you to pass in a custom frame duration', () => {
        const customDuration = 1000;
        const startTime = now();
        const callback = sinon.stub();
        const api = createStub(customDuration, startTime);

        api.add(callback);
        api.flush();

        expect(callback.calledWith(startTime + customDuration)).to.be.true;
    });

    it('should allow you to pass in a custom start time', () => {
        const customDuration = 1000;
        const startTime = now() + 1000;
        const callback = sinon.stub();
        const api = createStub(customDuration, startTime);

        api.add(callback);
        api.flush();

        expect(callback.calledWith(startTime + customDuration)).to.be.true;
    });
});

describe('instance', () => {
    const startTime = now();
    const frameDuration = 10;
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

            const id1 = api.add(callback1);
            const id2 = api.add(callback2);

            expect(id1).to.not.equal(id2);
        });
    });

    describe('remove', () => {
        it('should remove the callback from the queue', () => {
            const callback = sinon.stub();

            const id = api.add(callback);
            api.remove(id);
            api.flush();

            expect(callback.called).to.be.false;
        });

        it('should not remove other callbacks from the queue', () => {
            const callback1 = sinon.stub();
            const callback2 = sinon.stub();

            const id1 = api.add(callback1);
            // callback2 will not be removed
            api.add(callback2);
            api.remove(id1);
            // callback 2 should still be in the queue
            api.flush();

            expect(callback1.called).to.be.false;
            expect(callback2.called).to.be.true;
        });

        it('should do nothing if it cannot find a matching id', () => {
            const id = 'some fake id';

            expect(() => api.remove(id)).to.not.throw();
            expect(api.remove(id)).to.be.undefined;
        });
    });

    describe('step', () => {
        it('should execute all callbacks in the current frame', () => {
            const callback1 = sinon.stub();
            const callback2 = sinon.stub();

            api.add(callback1);
            api.add(callback2);
            api.step();

            expect(callback1.called).to.be.true;
            expect(callback2.called).to.be.true;
        });

        it('should remove callbacks in the current frame', () => {
            const callback1 = sinon.stub();
            const callback2 = sinon.stub();

            api.add(callback1);
            api.add(callback2);
            api.step();

            expect(callback1.calledOnce).to.be.true;
            expect(callback2.calledOnce).to.be.true;

            // should not call the stubs again
            api.step();

            expect(callback1.calledOnce).to.be.true;
            expect(callback2.calledOnce).to.be.true;
        });

        it('should not execute callbacks in the next frame', () => {
            const parent = sinon.spy(() => {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.step();

            expect(parent.called).to.be.true;
            expect(child.called).to.be.false;
        });

        it('should execute nested calls in the next frame', () => {
            const child = sinon.stub();
            const parent = sinon.spy(() => {
                api.add(child);
            });

            api.add(parent);
            api.step();

            expect(parent.called).to.be.true;
            expect(child.called).to.be.false;

            // will allow the nested frame to fire
            api.step();

            expect(parent.calledOnce).to.be.true;
            expect(child.called).to.be.true;
        });

        describe('"this" context', () => {
            function foo() {
                return this.a;
            }

            it('should respect implicit bindings', () => {
                const bar = {
                    a: 5,
                    foo
                };
                const callback = sinon.spy(function () {
                    return bar.foo();
                });

                api.add(callback);
                api.flush();

                expect(callback.firstCall.returnValue).to.equal(bar.a);
            });

            it('should respect explicit bindings', () => {
                const bar = {
                    a: 5
                };
                const callback = sinon.spy(function () {
                    return foo.call(bar);
                });

                api.add(callback);
                api.flush();

                expect(callback.firstCall.returnValue).to.equal(bar.a);
            });

            it('should respect hard bindings', () => {
                const bar = {
                    a: 5
                };
                const callback = sinon.spy(function () {
                    return foo.bind(bar)();
                });

                api.add(callback);
                api.flush();

                expect(callback.firstCall.returnValue).to.equal(bar.a);
            });
        });

        describe('duration', () => {
            it('should use the default time when no duration is provided', () => {
                const callback = sinon.stub();

                api.add(callback);
                api.step();

                expect(callback.calledWith(startTime + frameDuration)).to.be.true;
            });

            it('should pass the current time + duration to callbacks', () => {
                const callback = sinon.stub();
                const duration = 10;

                api.add(callback);
                api.step(1, duration);

                expect(callback.calledWith(startTime + duration)).to.be.true;
            });

            it('should also pass the duration to mutli-step calls', () => {
                const duration = 10;
                const child = sinon.stub();
                const parent = sinon.spy(() => {
                    api.add(child);
                });

                api.add(parent);
                api.step(2, duration);

                expect(parent.calledWith(startTime + duration)).to.be.true;
                expect(child.calledWith(startTime + duration * 2)).to.be.true;
            });

            it('should increase the time taken by the duration in each step', () => {
                const child = sinon.stub();
                const parent = sinon.spy(() => {
                    api.add(child);
                });
                const parentDuration = 10;
                const childDuration = 100000;

                api.add(parent);
                api.step(1, parentDuration);
                api.step(1, childDuration);

                expect(parent.calledWith(startTime + parentDuration)).to.be.true;
                expect(child.calledWith(startTime + parentDuration + childDuration)).to.be.true;
            });
        });
    });

    describe('flush', () => {
        it('should execute all callbacks in the current frame', () => {
            const callback1 = sinon.stub();
            const callback2 = sinon.stub();

            api.add(callback1);
            api.add(callback2);
            api.flush();

            expect(callback1.called).to.be.true;
            expect(callback2.called).to.be.true;
        });

        it('should execute all nested callbacks', () => {
            const parent = sinon.spy(() => {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.flush();

            expect(parent.called).to.be.true;
            expect(child.called).to.be.true;
        });

        it('should execute all nested callbacks with the stubs frame duration', () => {
            const parent = sinon.spy(() => {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.flush();

            expect(parent.calledWith(startTime + frameDuration)).to.be.true;
            expect(child.calledWith(startTime + 2 * frameDuration)).to.be.true;
        });

        it('should allow you to flush callbacks with a provided frame duration', () => {
            const parent = sinon.spy(() => {
                api.add(child);
            });
            const child = sinon.stub();
            const customDuration = frameDuration * 10;

            api.add(parent);
            api.flush(customDuration);

            expect(parent.calledWith(startTime + customDuration)).to.be.true;
            expect(child.calledWith(startTime + 2 * customDuration)).to.be.true;
        });

    });

    describe('reset', () => {
        it('should remove all callbacks in the current frame without calling them', () => {
            const callback = sinon.stub();

            api.add(callback);
            api.reset();

            // would usually call the function
            api.flush();

            expect(callback.called).to.be.false;
        });

        it('should remove all callbacks in the current future frames without calling them', () => {
            const parent = sinon.spy(() => {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.reset();

            expect(parent.called).to.be.false;
            expect(child.called).to.be.false;
        });

        it('should reset the current time back to the start time', () => {
            const callback1 = sinon.stub();
            const callback2 = sinon.stub();

            api.add(callback1);
            api.flush();
            api.reset();

            // if not reset then duration would be startTime + 2 * duration
            api.add(callback2);
            api.flush();

            expect(callback1.calledWith(startTime + frameDuration)).to.be.true;
            expect(callback2.calledWith(startTime + frameDuration)).to.be.true;
        });
    });
});

describe('replaceRaf', () => {
    it('should replace root.requestAnimationFrame with "add"', () => {
        const root = {};
        const callback = sinon.stub();

        replaceRaf([root]);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.true;
    });

    it('should replace root.cancelAnimationFrame with "remove"', () => {
        const root = {};
        const callback = sinon.stub();

        replaceRaf([root]);
        const id = root.requestAnimationFrame(callback);
        root.cancelAnimationFrame(id);
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.false;
    });

    it('should add "step" to the root.requestAnimationFrame', () => {
        const root = {};
        const callback = sinon.stub();

        replaceRaf([root]);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.step();

        expect(callback.called).to.be.true;
    });

    it('should add "flush" to the root.requestAnimationFrame', () => {
        const root = {};
        const callback = sinon.stub();

        replaceRaf([root]);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.true;
    });

    it('should add "reset" to the root.requestAnimationFrame', () => {
        const root = {};
        const callback = sinon.stub();

        replaceRaf([root]);
        replaceRaf([root]);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.reset();
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.false;
    });

    it('should share stubs between roots', () => {
        const root1 = {};
        const root2 = {};

        replaceRaf([root1, root2]);

        expect(root1.requestAnimationFrame).to.equal(root2.requestAnimationFrame);
    });

    it('should not share stubs between different calls', () => {
        const root1 = {};
        const root2 = {};

        replaceRaf([root1]);
        replaceRaf([root2]);

        expect(root1.requestAnimationFrame).to.not.equal(root2.requestAnimationFrame);
    });

    describe('no root provided', () => {
        const original = global.requestAnimationFrame;

        beforeEach(() => {
            delete global.requestAnimationFrame;
        });

        afterEach(() => {
            global.requestAnimationFrame = original;
        });

        it('should use the window if it exists', () => {
            global.window = {};

            replaceRaf();

            expect(global.window.requestAnimationFrame).to.be.a.function;

            // cleanup
            delete global.window;
        });

        it('should use the global if a window cannot be found', () => {
            expect(global.requestAnimationFrame).to.not.be.a.function;

            replaceRaf();

            expect(global.requestAnimationFrame).to.be.a.function;
        });
    });

    describe('time', () => {
        const startTime = now();

        it('should use the default duration if none is provided', () => {
            const root = {};
            const callback = sinon.stub();

            replaceRaf([root], {startTime});

            root.requestAnimationFrame(callback);
            root.requestAnimationFrame.flush();

            expect(callback.calledWith(startTime + defaultDuration)).to.be.true;
        });

        it('should use the custom duration if none is provided', () => {
            const root = {};
            const callback = sinon.stub();
            const customDuration = defaultDuration * 1000;

            replaceRaf([root], {
                startTime,
                duration: customDuration
            });

            root.requestAnimationFrame(callback);
            root.requestAnimationFrame.flush();

            expect(callback.calledWith(startTime + customDuration)).to.be.true;
        });

        it('should use the custom start time if none is provided', () => {
            const root = {};
            const callback = sinon.stub();
            const customStartTime = startTime + 1000;

            replaceRaf([root], {
                startTime: customStartTime
            });

            root.requestAnimationFrame(callback);
            root.requestAnimationFrame.flush();

            expect(callback.calledWith(customStartTime + defaultDuration)).to.be.true;
        });
    });

    describe('0.3.x support', () => {
        beforeEach(() => {
            sinon.stub(console, 'warn');
        });

        afterEach(() => {
            console.warn.restore();
        });

        it('should support a single root as an argument', () => {
            const root = {};

            replaceRaf(root);

            expect(root.requestAnimationFrame).to.be.a.function;
        });

        it('should support passing in multiple roots separated by commas', () => {
            const root1 = {};
            const root2 = {};

            replaceRaf(root1, root2);

            expect(root1.requestAnimationFrame).to.equal(root2.requestAnimationFrame);
        });
        it('should log a deprecation message', () => {
            const root = {};

            replaceRaf(root);

            expect(console.warn.called).to.be.true;
        });
    });

});