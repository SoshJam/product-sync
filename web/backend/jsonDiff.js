const convertObjectToArray = (obj) => {
    if (typeof(obj) == "array") return obj;
    const array = [];
    for (const key in obj)
        array.push(obj[key]);
    return array;
};

/**
 * Returns the properties in the second object that are different from the first object.
 * 
 * @param first  the old object
 * @param second the new object
 */
export function jsonDiff(first, second) {
    const differences = {};

    for (const property in second) {
        // If the value is different, add it to the differences object
        if (first[property] != second[property]) {
            differences[property] = second[property];
        }
    }

    return differences;
}