/**
 * Converts a string to Pascal Case (Title Case with spaces).
 * Capitalizes the first letter of each word and lowercases the rest.
 * Example: "java developer" -> "Java Developer"
 * @param {string} str - The input string
 * @returns {string} - The formatted string
 */
export const toPascalCase = (str) => {
    if (!str) return "";
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};
