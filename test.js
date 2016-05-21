import * as api from './index';
import sinon from 'sinon';
import {expect} from 'chai';

describe('api', () => {
    beforeEach(() => {
       // sinon.stub(global, 'requestAnimationFrame', api.add)
    });

    afterEach(() => {
        api.flush();
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
            const parent = sinon.spy(function () {
                api.add(child);
            });
            const child = sinon.stub();

            api.add(parent);
            api.step();

            expect(parent.called).to.be.true;
            expect(child.called).to.be.false;

            // will allow the nested frame to fire
            api.step();

            expect(parent.calledOnce).to.be.true;
            expect(child.called).to.be.true;
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

    describe('polyfill', () => {
        it('should polyfill "requestAnimationFrame" onto the root', () => {
            const root = {};

            api.polyfill(root);

            expect(root.requestAnimationFrame).to.equal(api.add);
        });

        it('should polyfill "cancelAnimationFrame" onto the root', () => {
            const root = {};

            api.polyfill(root);

            expect(root.cancelAnimationFrame).to.equal(api.remove);
        });
    });
});