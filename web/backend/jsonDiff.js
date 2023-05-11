/**
 * Returns the properties in the second object that are different from the first object.
 * 
 * @param first  the old object
 * @param second the new object
 */
export function jsonDiff(first, second) {
    const differences = {};

    for (const property in second)
        if (first[property] && first[property] !== second[property])
            differences[property] = second[property];

    return differences;
}