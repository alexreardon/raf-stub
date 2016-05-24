# raf-stub

[![Build Status](https://travis-ci.org/alexreardon/raf-stub.svg?branch=master)](https://travis-ci.org/alexreardon/raf-stub) [![codecov](https://codecov.io/gh/alexreardon/raf-stub/branch/master/graph/badge.svg)](https://codecov.io/gh/alexreardon/raf-stub)

Accurate and predictable testing of `requestAnimationFrame` and `cancelAnimationFrame`.

This is **not** designed to be a polyfill and is only intended for testing code.

**Warning:** this still a work a work in progress. Currently this library has been built using es6 modules but it does not have a good reuse story using es5/node. I am currently investigating a better solution.

## Basic usage

```js
// assuming node running environment so 'global' is the global object

import createStub from 'raf-stub';

const render = () => {
    return requestAnimationFrame(() => {
        console.log('animate allthethings!');
    });
}

describe('stub', () => {
    const stub = createStub();

    beforeEach(() => {
        sinon.stub(global, 'requestAnimationFrame', stub.add);
    });

    afterEach(() => {
        stub.reset();
        global.requestAnimationFrame.restore();
    });

    it('should allow us to execute requestAnimationFrame when we want', () => {
        render();

        stub.step();

        // console.log => animate allthethings!
    });

    it('should allow us to cancel requestAnimationFrame when we want', () => {
        var id = render();

        stub.remove(id);
        stub.step();

        // *crickets*
    });
});
```

### Stub existing `requestAnimationFrame`
(similar to the 'basic usage' example but replaces `requestAnimationFrame` and `cancelAnimationFrame` with a stub)
```js
import {enhance} from 'raf-stub';

// override requestAnimationFrame and cancelAnimationFrame with a stub
enhance();

const render = () => {
    return requestAnimationFrame(() => {
        console.log('animate allthethings!');
    });
}

describe('stub', () => {
    it('should allow us to execute requestAnimationFrame when we want', () => {
        render();

        requestAnimationFrame.step();

        // console.log => animate allthethings!
    });

    it('should allow us to cancel requestAnimationFrame when we want', () => {
        var id = render();

        cancelAnimationFrame(id);
        requestAnimationFrame.step();

        // *crickets*
    });
});
```

## Installation

```
npm i --save-dev raf-stub
```


## Stub

An isolated mock that contains it's own state. Each `stub` is independent and have it's own state.

### `createStub() => Stub`
```js
import createStub from 'raf-stub';

const stub = createStub();
```

### `.add(callback) => Int`

Same api as `requestAnimationFrame`. It schedules the callback to be called in the next frame.
It returns an `id` that can be used to cancel the frame in the future.
Callbacks will *not* automatically get called after a period of time. You need to explicitly release it using `step()` or `flush()`

```js
const stub = createStub();
const callback = () => {};

stub.add(callback);
```

### `.remove(id)`

Same api as `cancelAnimationFrame`. It takes the id of a `add()` call and cancels it.

```js
const stub = createStub();
const callback = () => {};

stub.add(callback);

// remove callback from the current frame
stub.remove(callback);
```

### `.step(?steps=1)`

Executes all callbacks in the current frame. You can optionally provide the amount of frames you would like to release. This becomes useful when you have nested calls

**Simple example**
```js
const callback1 = () => console.log('first callback');
const callback2 = () => console.log('second callback');
const stub = createStub();

stub.add(callback1);
stub.add(callback2);
stub.step();

// console.log => 'first callback'
// console.log => 'second callback'

```

**Nested example**

Some times calls to `requestAnimationFrame` themselves call `requestAnimationFrame`. `step()` will let you step through them one at a time.

```js
// this example will use the 'enhance' syntax as it is a little clearer

const callback = () => {
    console.log('first callback')

    // second frame
    requestAnimationFrame(() => console.log('second callback'));
};

requestAnimationFrame(callback);
// release the first frame
api.step();

// console.log => 'first callback'

// release the second frame
requestAnimationFrame.step();

// console.log => 'second callback'
```

### `.flush()`
Executes all `requestAnimationFrame` callbacks, including nested calls. It will keep executing frames until there are no frames left. An easy way to to think of this function is "`step()` until there are no more steps left"

**Warning** if your code just calls `requestAnimationFrame` in an infinite loop then this will never end. Consider using `.step()` for this use case

```js
// this example will use the 'enhance' syntax as it is a little clearer

const callback = () => {
    console.log('first callback')

    // second frame
    requestAnimationFrame(() => console.log('second callback'));
};

requestAnimationFrame(callback);
api.flush();

// console.log => 'first callback'
// console.log => 'second callback'
```

### `.reset()`

Clears all the frames without executing any callbacks, unlike `flush()` which executes all the callbacks. Reverts the stub to it's initial state. This is similar to `remove(id)` but it does not require an `id`; `reset` will also clear **all** callbacks in the frame whereas `remove(id)` only removes a single one.

```js

const callback = () => console.log('first callback');

requestAnimationFrame(callback);
api.reset();

// callback has been removed so this will do nothing
api.step();

// *crickets*
```

## Enhance

### `enhance(?roots)`

This function is used to *set* an enhanced `requestAnimationFrame` and `cancelAnimationFrame` on a root. You can manually pass in a `root`, or `roots`. If you do not pass in a root it will automatically figure out whether to use `window` or `global`.

**Warning** each call to `enhance` will add a new stub to the `root`. If you want to have the same stub on multiple `roots` then pass them in at the same time (eg `enhance(window, global)`).

```js
import {enhance} from 'raf-stub';

const root = {}; // could be window, global etc.
enhance(root);

// can let multiple roots share the one stub
// useful for when you testing environment uses `global`
// but some libraries may use `window`

enhance(window, global);

// if called with no arguments it will use 'window' in the browser and 'global' in node
enhance();
```

After *enhancing* a root it's `requestAnimationFrame` and `cancelAnimationFrame` functions have been set and given new capabilities.

```js
// assuming running in node so 'global' is the global rather than 'window'
import {enhance} from 'raf-stub';

enhance(global);

const callback = () => alert('hi');

// existing browser api mapped to stub.add
const id = requestAnimationFrame(callback);

// existing browser api mapped to stub.remove
cancelAnimationFrame(id);

// step - see stub.step
requestAnimationFrame.step();

// flush - see stub.flush
requestAnimationFrame.flush();

// reset - see stub.reset
requestAnimationFrame.reset();

```

See **Stub** for api documentation on `step()`, `flush()` and `reset()`.

## Recipes

### Library dependency

Let's say you use a library that uses request animation frame

```js
// library.js
const ponyfill = callback => setTimeout(callback, 1000/ 60);
const raf = requestAnimationFrame || ponyfill;

export default function () {
    raf(() => {
        console.log('render allthethings!');
    });
}
```

The trouble with this is that the library uses a local variable `raf`. This reference is declarated when the modules are importing. This means that `raf` will always points to the reference it has when the module is imported for the first time.

The following **will not work**

```js
// test.js
import createStub from 'raf-stub';
import render from 'library';

describe('app', () => {
    const stub = createStub();

    beforeEach(() => {
        sinon.stub(global, 'requestAnimationFrame', stub.add);
    });

    it('should allow us to execute requestAnimationFrame when we want', () => {
        render();

        stub.step();

        // *crickets* - not executed! :(
    });
});
```

This won't work when:

1. `requestAnimationFrame` **does exist**
```js
raf === requestAnimationFrame
```

This is because doing `sinon.stub(global, 'requestAnimationFrame', stub.add)` will change the reference that `requestAnimationFrame` points to. What that means is that the library when it calls `raf` will call the original `requestAnimationFrame` and not your stub

2. `requestAnimationFrame` **does not exist**
```js
raf === ponyfill
```

If the ponyfill is being used then we cannot override the reference to `raf` as it is not exposed. Stubbing `requestAnimationFrame` will not help because the library uses a reference to the ponyfill.

#### How can we get this working?
`enhance` to the rescue!

before any of your tests code is executed, including module imports, then take the opportunity to set up your stub!

```js
// test-setup.js

import createStub from 'raf-stub';

// option 1: setup a stub yourself
const stub = createStub();
requestAnimationFrame = stub.add;
requestAnimationFrame = stub.remove;

// add additional helpers to requestAnimationFrame:
 Object.assign(root.requestAnimationFrame, {
    step: stub.step,
    flush: stub.flush,
    reset: stub.reset
});

// option 2: use enhance! (this does option1 for you)
import {enhance} from 'raf-stub';
enhance();
```

Then everything will work as expected!
```js
// test.js
import render from 'library';

describe('app', () => {
    const stub = createStub();

    afterEach(() => {
        requestAnimationFrame.reset();
    });

    it('should allow us to execute requestAnimationFrame when we want', () => {
        render();

        requestAnimationFrame.step();

        // console.log => 'render allthethings!'
    });
});
```

## Tests for `raf-stub`
To run the tests for this library simply execute:

```
npm install
npm test
```

## Rationale for library

Let's say you wanted to test some code that uses `requestAnimationFrame`. How would you do it? Here is an example that uses `sinon` and `setTimeout`. You do not need to use `sinon` but it lets you write sequential code rather than needing to use nested timeouts.

```js
describe('app', () => {
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
        sinon.stub(window, 'requestAnimationFrame', setTimeout);
        sinon.stub(window, 'cancelAnimationFrame', clearTimeout);
    });

    afterEach(() => {
        clock.restore();
        window.requestAnimationFrame.restore();
        window.cancelAnimationFrame.restore();
    });

    it('should allow us to execute requestAnimationFrame when we want', () => {
        const callback = () => console.log('success');

        requestAnimationFrame(callback);

        // fast forward set timeout
        sinon.tick();

        // console.log => 'success'
    });
});
```

We are all good right? Well sort of. For this basic example `setTimeout` was sufficient. Let's have a look at a few more cases where `setTimeout` is not ideal.

*The following examples will assume the same setup as the above example unless otherwise specified*

### Case 1: mixture of `setTimeout` and `requestAnimationFrame`

```js
it('should allow us to execute requestAnimationFrame when we want', () => {
    const callback = () => {
        setTimeout(() => {
            console.log('success');
        });
    }

    requestAnimationFrame(callback);

    // fast forward requestAnimationFrame
    sinon.tick();

    // fast forward setTimeout
    sinon.tick();

    // console.log => 'success'
});
```

Because both `setTimeout` and `requestAnimationFrame` use `setTimeout` the way we **step** through an animation frame is the same way we **step** through a timeout. This can become hard to reason about in larger functions where there may be a large combination of `setTimeout` and `requestAnimationFrame` code. Having a shared mechanism is prone to misunderstandings. This is solved by `stub.step()` and `stub.flush()`

### Case 2: nested requestAnimationFrames
```js
it('should allow us to execute requestAnimationFrame when we want', () => {
    const callback = () => {
        requestAnimationFrame(() => {
            console.log('success');
        });
    }

    requestAnimationFrame(callback);

    // fast forward requestAnimationFrame
    sinon.tick();

    // fast forward requestAnimationFrame
    sinon.tick();

    // console.log => 'success'
});
```

This was not too hard. But something to notice is that the nest code is identicial to the previous example. We are relying on comments to understand what is going on.

Let's go a bit deeper:

```js
it('should allow us to execute requestAnimationFrame when we want', () => {
    const render = (iterations = 0) => {
        if(iterations > 100 * Math.random()) {
            return console.log('done');
        }
        return requestAnimationFrame(() => {
            render(iterations + 1);
        });
    };

    render();


    // step through the animation frames
    sinon.tick(100000);

    // console.log => 'success'
});
```

The problem we have here is that we do not know exactly how many times `render` will call `requestAnimationFrame`. To get around this we just tick the `clock` forward some really large amount. This feels like a hack. Also, you might use a number that is big enough in some circumstances but not others. This can lead to flakey tests. This is solved by `stub.flush()`

### Case 3: `setTimeout` leakage

```js
it('test 1', () => {
    const callback = () => {
        console.log('test 1: first frame');
        requestAnimationFrame(() => {
            console.log('test 1: second frame');
        });
    };

    requestAnimationFrame(callback);

    // console.log => 'test 1: first frame'

    // note the second frame was not cleared
});

it('test 2', () => {
    const callback = () => console.log('test 2: first frame');

    requestAnimationFrame(callback);

    // console.log => 'test 1: second frame'
    // console.log => 'test 2: first frame'
});
```

What happened here? We did not clear out all of the`requestAnimationFrame`'s in the original test and they leaked into our second test. We need to `reset` the `setTimeout` queue before running `test 2`.

```js
describe('app', () => {
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
        sinon.stub(window, 'requestAnimationFrame', setTimeout);
        sinon.stub(window, 'cancelAnimationFrame', clearTimeout);
    });

    afterEach(() => {
        // need to reset the clock (this actually flushes the clock)
        clock.tick(1000000);

        // console.log => 'test 1: second frame'

        clock.restore();
        window.requestAnimationFrame.restore();
        window.cancelAnimationFrame.restore();
    });

    it('test 1', () => {
        const callback = () => {
            console.log('test 1: first frame');
            requestAnimationFrame(() => {
                console.log('test 1: second frame');
            });
        };

        requestAnimationFrame(callback);

        // console.log => 'test 1: first frame'

        // note the second frame was not cleared
    });

    it('test 2', () => {
        const callback = () => console.log('test 2: first frame');

        requestAnimationFrame(callback);

        // console.log => 'test 1: second frame'
    });
});
```

We got around this issue by flushing the clock. We did this by calling `clock.tick(some big number)`. This suffers from the problem that existed a previous example: you cannot be sure that you have actually emptied the queue. You might have noticed a strange `console.log` in the `afterEach` function. This is because when you emptied the `setTimeout` queue with `clock.tick` all of the callbacks executed. In some cases it might lead to unintended consequences. `stub.reset()` allows us to empty a queue **without** needing to execute any of the callbacks.


