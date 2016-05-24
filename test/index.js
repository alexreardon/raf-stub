import factory, {enhance} from '../src/index';
import sinon from 'sinon';
import {expect} from 'chai';

describe('createStub', () => {
    it('should allow for different stub namespaces', () => {
        const api1 = factory();
        const api2 = factory();
        const callback1 = sinon.stub();
        const callback2 = sinon.stub();

        api1.add(callback1);
        api2.add(callback2);

        api1.flush();

        expect(callback1.called).to.be.true;
        expect(callback2.called).to.be.false;
    });
});

describe('instance', () => {
    let api;

    beforeEach(() => {
        api = factory();
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
            const parent = sinon.spy(function () {
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
            const parent = sinon.spy(function () {
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
            const parent = sinon.spy(function () {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.flush();

            expect(parent.called).to.be.true;
            expect(child.called).to.be.true;
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
            const parent = sinon.spy(function () {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.reset();

            expect(parent.called).to.be.false;
            expect(child.called).to.be.false;
        });
    });
});

describe('enhance', () => {
    it('should replace root.requestAnimationFrame with "add"', () => {
        const root = {};
        const callback = sinon.stub();

        enhance(root);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.true;
    });
    it('should replace root.cancelAnimationFrame with "remove"', () => {
        const root = {};
        const callback = sinon.stub();

        enhance(root);
        const id = root.requestAnimationFrame(callback);
        root.cancelAnimationFrame(id);
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.false;
    });

    it('should add "step" to the root.requestAnimationFrame', () => {
        const root = {};
        const callback = sinon.stub();

        enhance(root);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.step();

        expect(callback.called).to.be.true;
    });
    it('should add "flush" to the root.requestAnimationFrame', () => {
        const root = {};
        const callback = sinon.stub();

        enhance(root);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.true;
    });
    it('should add "reset" to the root.requestAnimationFrame', () => {
        const root = {};
        const callback = sinon.stub();

        enhance(root);
        root.requestAnimationFrame(callback);
        root.requestAnimationFrame.reset();
        root.requestAnimationFrame.flush();

        expect(callback.called).to.be.false;
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

            enhance();

            expect(global.window.requestAnimationFrame).to.be.a.function;

            // cleanup
            delete global.window;
        });

        it('should use the global if a window cannot be found', () => {
            expect(global.requestAnimationFrame).to.not.be.a.function;

            enhance();

            expect(global.requestAnimationFrame).to.be.a.function;
        });
    });
});