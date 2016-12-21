# raf-stub

[![Build Status](https://travis-ci.org/alexreardon/raf-stub.svg?branch=master)](https://travis-ci.org/alexreardon/raf-stub)
![npm](https://img.shields.io/npm/dm/raf-stub.svg)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-brightgreen.svg)](http://semver.org/spec/v2.0.0.html)
<!-- temp disable of coverage -->
<!-- [![Code coverage](https://codecov.io/github/alexreardon/raf-stub/coverage.svg)](https://codecov.io/gh/alexreardon/raf-stub) -->

Accurate and predictable testing of `requestAnimationFrame` and `cancelAnimationFrame`.

**What can `raf-stub` enable you to do?**
- Step through `requestionAnimationFrame` calls one frame at a time
- Continue to call `requestionAnimationFrame` until there are no frames left. This lets you fast forward to the end of animations.
- Clear out all animation frames without calling them
- Control animations that are orchestrated by third party libraries such as [react-motion](https://github.com/chenglou/react-motion)
- Control time values passed to your `requestAnimationFrame` callbacks

This is **not** designed to be a polyfill and is only intended for testing code.

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
    let stub;

    beforeEach(() => {
        stub = createStub();
        sinon.stub(global, 'requestAnimationFrame', stub.add);
        sinon.stub(console, 'log');
    });

    afterEach(() => {
        global.requestAnimationFrame.restore();
    });

    it('should allow us to execute requestAnimationFrame when we want', () => {
        render();

        stub.step();

        // console.log => animate allthethings!
        expect(console.log.called).to.be(true);
    });

    it('should allow us to cancel requestAnimationFrame when we want', () => {
        var id = render();

        stub.remove(id);
        stub.step();

        // *crickets*
        expect(console.log.called).to.be(false);
    });
});
```

### Replace existing `requestAnimationFrame`

```js
import {replaceRaf} from 'raf-stub';

// override requestAnimationFrame and cancelAnimationFrame with a stub
replaceRaf();

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
        expect(console.log.called).to.be(true);
    });

    it('should allow us to cancel requestAnimationFrame when we want', () => {
        var id = render();

        cancelAnimationFrame(id);
        requestAnimationFrame.step();

        // *crickets*
        expect(console.log.called).to.be(false);
    });
});
```

## Installation

```
npm i --save-dev raf-stub
```

## stub
Created by `createStub()`
An isolated mock that contains it's own state. Each `stub` is independent and have it's own state.

**Note** changing the time values (`startTime`, `frameDuration` and `duration`) does not actually impact how long your test takes to execute, nor does it attach itself to the system clock. It is simply a way for you to have control over the first argument (`currentTime`) to `requestAnimationFrame` callbacks.

### `createStub(?frameDuration = 1000 / 60, ?startTime = performance.now()) => Stub`

**Basic usage**

```js
const stub = createStub();
```

**Advanced usage**

```js
const frameDuration = 1000 / 60 * 2; // an extra slow frame
const startTime = performance.now() + 1000;
const stub = createStub(frameDuration, startTime);
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

### `.step(?steps=1, ?duration = frameDuration)`
Executes all callbacks in the current frame and optionally additional frames.

- `steps (Int)` => the amount of animation frames you would like to release. This is useful when you have nested calls.
- `duration (Number)` => the amount of time the frame takes to execute. The default `duration` value is provided by the `frameDuration` argument to `createStub(frameDuration)`. However, you can override it for a specific `.step()` call using the `duration` argument.

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
// this example will use the 'replaceRaf' syntax as it is a little clearer
const callback = () => {
    console.log('first callback')

    // second frame
    requestAnimationFrame(() => console.log('second callback'));
};

requestAnimationFrame(callback);

// release the first frame
requestAnimationFrame.step();

// console.log => 'first callback'

// release the second frame
requestAnimationFrame.step();

// console.log => 'second callback'
```

**Time manipulated example**

```js
const startTime = performance.now();
const frameDuration = 10;
const longFrameDuration = frameDuration * 2;
const stub = createStub(frameDuration, startTime);
const callback = currentTime => console.log(`call time: ${startTime - currentTime}`);

stub.add(callback);
stub.step(1, longFrameDuration);

// console.log => call time: 20
```


### `.flush(?duration = frameDuration)`
Executes all `requestAnimationFrame` callbacks, including nested calls. It will keep executing frames until there are no frames left. An easy way to to think of this function is "`step()` until there are no more steps left"

- `duration (Number)` => the duration for each frame in the flush - each frame gets the same value. If you want different frames to get different values then use `.step()`. The default `duration` value is provided by the `frameDuration` argument to `createStub(frameDuration)`. However, you can override it for a specific `.flush()` call using the `duration` argument.

**Warning** if your code just calls `requestAnimationFrame` in an infinite loop then this will never end. Consider using `.step()` for this use case

**Simple example**

```js
// this example will use the 'replaceRaf' syntax as it is a little clearer

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

**Time manipulated example**

```js
const startTime = performance.now();
const stub = createStub(100, startTime);
const callback = currentTime => console.log(`call time: ${currentTime - startTime}`);

stub.add(callback);
stub.flush(200);

// console.log => 'call time: 200'
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

## replaceRaf

### `replaceRaf(?[roots], ?{frameDuration = 1000/ 60, startTime = performance.now()})`

This function is used to set a `requestAnimationFrame` and `cancelAnimationFrame` on a root (eg `window`).

- `roots (?Array)` => an optional array of roots to be stubbed (eg [`window`, `global`]). If no root is provided then the function will automatically figure out whether to use `window` or `global`
- `options (?Object)` => optional additional values

`options`
- `startTime (Int)` => see `createStub()`
- `frameDuration (Number)` => see `createStub()`


#### Basic usage
```js
import {replaceRaf} from 'raf-stub';

const root = {}; // could be window, global etc.
replaceRaf([root]);

// can let multiple roots share the one stub
// useful for when you testing environment uses `global`
// but some libraries may use `window`

replaceRaf([window, global]);

// if called with no arguments it will use 'window' in the browser and 'global' in node
replaceRaf();

// you can override the frameDuration and startTime for the stub
replaceRaf([window], {frameDuration: 200, startTime: performance.now() + 1000 })
```

After calling `replaceRaf` a root it's `requestAnimationFrame` and `cancelAnimationFrame` functions have been set and given new capabilities.

```js
// assuming running in node so 'global' is the global rather than 'window'
import {replaceRaf} from 'raf-stub';

replaceRaf(global);

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

See **stub** for api documentation on `step()`, `flush()` and `reset()`.

### Disclaimers!

- Each call to `replaceRaf` will add a new stub to the `root`. If you want to have the same stub on multiple `roots` then pass them in at the same time (eg `replaceRaf(window, global)`).
- If you do a one time setup of `replaceRaf()` in a test setup file you will remember to clear the stub after each test.
```js
requestAnimationFrame.reset();
```

## ES5 / ES6

#### ES6 syntax:

```js
import stub, {replaceRaf} from 'raf-stub';
```

#### ES5 syntax (compatible with node.js `require`);

```js
var stub = require('raf-stub').default;
var replaceRaf = require('raf-stub').replaceRaf;
```

## Semantic Versioning
This project used [Semantic versioning 2.0.0](http://semver.org/) to ensure a consistent versioning strategy.

`X.Y.Z` (major, minor, patch)

- `X`: breaking changes
- `Y`: new features (non breaking)
- `Z`: patches

A safe `raf-stub` `package.json` dependency would therefore be anything that allows changes to the *minor* or *patch* version

#### Examples
These examples will allow changes to *minor* and *patch* versions but not *major*

##### [Carrot ranges](https://docs.npmjs.com/misc/semver#caret-ranges-123-025-004) (npm default)

`^$major.$minor.$patch` (eg `^1.0.0`)


##### [X ranges](https://docs.npmjs.com/misc/semver#x-ranges-12x-1x-12-)

`$major.x` (eg `1.x`)


## Recipes

## `frameDuration` and `startTime`

The first argument to a `requestAnimationFrame` callback is a [DOMHighResTimeStamp](https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp)

```js
requestAnimationFrame(currentTime => {
    console.log('the current time is', currentTime);
});
```

Under normal circumstances you would not want to modify the default values. Being able to manipulate the `startTime` and `endTime` will let you test code that does some logic based on the `currentTime` argument.

**Note** changing the time values does not actually impact how long your test takes to execute, nor does it attach itself to the system clock. It is simply a way for you to have control over the first argument (`currentTime`) to `requestAnimationFrame` callbacks.

```js
const idealFrameDuration = 1000 / 2;
const slowFrameDuration = idealFrameDuration * 2;
const startTime = performance.now();
const stub = createStub(slowFrameDuration, startTime);

stub.add(currentTime => {
    if(startTime + currentTime > idealFrameDuration) {
        console.log('a slow frame occured');
    } else {
    console.log('a standard frame occured');
    }
});

stub.step();

// console.log => 'a slow frame occured'
```

**Controlling the `frameDuration` and `startTime`:**

```js
const callback = currentTime => console.log(`time taken: ${currentTime - startTime}`);

// this will set the frameDuration and startTime for all stub calls. They can be overwritted with specific function calls
const stub = createStub(100, performance.now());

stub.add(callback);
// this will use the values specific when creating the stub
stub.step();
// console.log => 'time taken: 100'

stub.add(callback);
// this will overwrite the duration of the frame to '200' for this call
stub.step(1, 200);
// console.log => 'time taken: 200'

stub.add(callback);
stub.flush();
// console.log => 'time taken: 100'

stub.add(callback);
stub.flush(200);
// console.log => 'time taken: 200'
```

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

The trouble with this is that the library uses a local variable `raf`. This reference is declared when the modules are importing. This means that `raf` will always points to the reference it has when the module is imported for the first time.

The following **will not work**

```js
// test.js
import createStub from 'raf-stub';
import render from 'library';

describe('app', () => {
    const stub = createStub();

    beforeEach(() => {
        sinon.stub(global, 'requestAnimationFrame', stub.add);
        sinon.stub(console, 'log');
    });

    it('should allow us to execute requestAnimationFrame when we want', () => {
        render();

        stub.step();

        // *crickets* - not executed! :(
        expect(console.log.called).to.be(true); // failure
    });
});
```

This won't work when:

- `requestAnimationFrame` **does exist**
```js
raf === requestAnimationFrame
```

This is because doing `sinon.stub(global, 'requestAnimationFrame', stub.add)` will change the reference that `requestAnimationFrame` points to. What that means is that the library when it calls `raf` will call the original `requestAnimationFrame` and not your stub

- `requestAnimationFrame` **does not exist**
```js
raf === ponyfill
```

If the ponyfill is being used then we cannot override the reference to `raf` as it is not exposed. Stubbing `requestAnimationFrame` will not help because the library uses a reference to the ponyfill.

#### How can we get this working?
`replaceRaf` to the rescue!

before any of your tests code is executed, including module imports, then take the opportunity to set up your stub!

```js
// test-setup.js
// your test setup will be running before babel so I will write valid node code.
var createStub = require('raf-stub').default;

// option 1: setup a stub yourself
var stub = createStub();
requestAnimationFrame = stub.add;
requestAnimationFrame = stub.remove;

// add additional helpers to requestAnimationFrame:
 Object.assign(requestAnimationFrame, {
    step: stub.step,
    flush: stub.flush,
    reset: stub.reset
});

// option 2: use replaceRaf! (this does option1 for you)
require('raf-stub').replaceRaf();
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
        expect(console.log.called).to.be(true);
    });
});
```

### Full `mocha` end-to-end setup
For when you need to make a stub which can be used by a library (or module that ponyfills `requestAnimationFrame` at compile time)

**package.json**
```json
{
    "scripts": {
        "test": "mocha render.test.js --presets es2015 --require test-setup.js"
    }
}
```

1. `mocha test.js` our test file
2. `--presets es2015` this will let us use es6 + es6 modules in our test files
3. `--require test-setup.js` this is our file where we will setup our stub

**test-setup.js**
```js
// using node require as the babel tranform is not applied to this file
require('raf-stub').replaceRaf();
```

**render.js**
```js
const ponyfill = callback => setTimeout(callback, 1000 / 60);
const raf = requestAnimationFrame || ponyfill;

export default function() {
    raf(() => console.log('done'));
}
```

**render.test.js**
```js
import render from './render';

describe('render', () => {
    it('should log to the console', () => {
        render();

        requestAnimationFrame.step();

        // console.log => 'done';
        expect(console.log.called).to.be(true);
    });
});
```

**command line**
```
npm test
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
        clock.tick();

        // console.log => 'success'
        expect(console.log.called).to.be(true);
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
    clock.tick();

    // fast forward setTimeout
    clock.tick();

    // console.log => 'success'
    expect(console.log.called).to.be(true);
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
    clock.tick();

    // fast forward requestAnimationFrame
    clock.tick();

    // console.log => 'success'
    expect(console.log.called).to.be(true);
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
    clock.tick(100000);

    // console.log => 'success'
    expect(console.log.called).to.be(true);
});
```

The problem we have here is that we do not know exactly how many times `render` will call `requestAnimationFrame`. To get around this we just tick the `clock` forward some really large amount. This feels like a hack. Also, you might use a number that is big enough in some circumstances but not others. This can lead to flakey tests. This is solved by `stub.flush()`

### Case 3: `setTimeout` leakage

```js
it('should log to the console', () => {
    const callback = () => {
        console.log('test 1: first frame');
        // requests another frame
        requestAnimationFrame(() => {
            console.log('test 1: second frame');
        });
    };

    requestAnimationFrame(callback);
    clock.tick();

    // console.log => 'test 1: first frame'
    expect(console.log.calledOnce).to.be(true);
    // note the second frame was not cleared
});

it('should also log to the console', () => {
    const callback = () => console.log('test 2: first frame');

    requestAnimationFrame(callback);
    clock.tick();

    // console.log => 'test 1: second frame' -> leaked from first test
    // console.log => 'test 2: first frame'
    expect(console.log.calledOnce).to.be(true); // failure
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
        expect(console.log.called).to.be(true);

        // note the second frame was not cleared
    });

    it('test 2', () => {
        const callback = () => console.log('test 2: first frame');

        requestAnimationFrame(callback);

        // console.log => 'test 1: second frame'
        expect(console.log.calledOnce).to.be(true); // now passing
    });
});
```

We got around this issue by flushing the clock. We did this by calling `clock.tick(some big number)`. This suffers from the problem that existed a previous example: you cannot be sure that you have actually emptied the queue. You might have noticed a strange `console.log` in the `afterEach` function. This is because when you emptied the `setTimeout` queue with `clock.tick` all of the callbacks executed. In some cases it might lead to unintended consequences. `stub.reset()` allows us to empty a queue **without** needing to execute any of the callbacks.

### Case 4: controlling the first argument to `requestAnimationFrame` callbacks

Lets say you have setup that looks like this:

```js
const idealFrameDuration = 1000 / 60;

const startAnimation = startTime => {
    let previousTime = startTime;

    const loop = currentTime => {
        if(!currentTime) {
            throw new Error('could not get the current time');
        }

        const diff = currentTime - previousTime;
        if(diff > idealFrameDuration) {
            console.log('a slow frame occurred');
        } else {
            console.log('a normal frame occurred');
        }

        previousTime = currentTime;
        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);


};

startAnimation(performance.now());
```

How could we test the behaviour of the `loop` function? Let's try with `setTimeout`

```js
describe('startAnimation', () => {
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

    it('should pass the updated time to loop', () => {
        const startTime = performance.now();
        startAnimation(startTime);

        clock.tick();

        // Error => 'could not get the current time'
    });
});
```

What happened here? By default `setTimeout` does not pass any argument as the first parameter to callbacks. Getting this to work is hard because we would need to both use `setTimeout` as a replacement for `requestAnimationFrame` as well as changing it's behaviour to pass a controlled value as the first argument.

How can `raf-stub` help us?

```js
import {replaceRaf} from 'raf-stub';
const startTime = performance.now();
const idealFrameDuration = 1000 / 60;

replaceRaf([], {startTime});

describe('startAnimation', () => {

    afterEach(() => {
        requestAnimationFrame.reset();
    });

    it('should pass the updated time to loop', () => {

        const slowFrameDuration = idealFrameDuration * 2;
        startAnimation(startTime);

        requestAnimationFrame.step(1, idealFrameDuration);
        // console.log => 'a normal frame occurred'
        expect(console.log.calledOnce).to.be(true);


        requestAnimationFrame.step(1, slowFrameDuration);
        // console.log => 'a slow frame occurred'
        expect(console.log.calledTwice).to.be(true);
    });
});
```



