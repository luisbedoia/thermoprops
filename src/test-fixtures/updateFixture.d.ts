/** Whether the test run was asked to write its data again. */
export const updating: boolean;

/** Writes `data` as one line of JSON to the file at `url`. */
export function writeJson(url: URL, data: unknown): void;
