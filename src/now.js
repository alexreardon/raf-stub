// @flow
export default (): number => {
  if (performance) {
    return performance.now();
  }
  return Date.now();
};
