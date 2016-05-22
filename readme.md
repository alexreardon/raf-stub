# Mock Stub
> Better test stubbing for `requestAnimationFrame`

## API

### Instance

#### `createStub()`
```js
import createStub from 'raf-stub';

const stub = create();
```

#### `stub.add(callback)`

Similar functionality to `requestAnimationFrame()`. It schedule the callback to be called in the next frame. Callbacks will *not* automatically get called after a period of time. You need to explicity release it using `step()` or `flush()`

#### `stub.remove`

### Enhance

This function is used to *set* an enhanced `requestAnimationFrame` and `cancelAnimationFrame` on a root.

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

// existing browser api
const id = requestAnimationFrame(callback);

// existing browser api
cancelAnimationFrame(id);

// step - new!
requestAnimationFrame.step();

// flush - new!
requestAnimationFrame.flush();

// reset - new!
requestAnimationFrame.reset();

```

See [instance](#instance) for api documentation on `step()`, `flush()` and `reset()`.

## Recipes

Simple

Nested

Dependency

## Background


