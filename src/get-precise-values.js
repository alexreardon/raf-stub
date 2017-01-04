// @flow
export const getPrecision = (value: number): number => {
    const string = value.toString();

    if (string.indexOf('.') === -1) {
        return 0;
    }

    return string.split('.')[1].length;
};

export const getMaxPrecision = (...values: number[]) => (
    Math.max(
        ...values.map(value => getPrecision(value)),
    )
);

/*  # Algorithm strategy
    --------------------
    Make all numbers integers for the operation and then
    convert back to their original scale.

    ## Example

    value1 = 10.203
    value2 = 1.1

    step 1: get max precision
    result = 3 (10.203)

    step 2: shift all by the max precision (value * Math.pow(10, 3))
    value1 = 10203
    value2 = 110000

    step 3: add all the values together
    result = 120203

    step 4: go back to original (value / Math.pow(result, 3))
*/
export const add = (...values: number[]) => {
    const maxPrecision = getMaxPrecision(...values);
    const modifier = Math.pow(10, maxPrecision);
    const sum: number = values
        .map(value => value * modifier)
        .reduce((previous, current) => previous + current, 0);
    return sum / modifier;

};