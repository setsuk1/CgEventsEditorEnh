// Regular expression for event name validation:
// - Must be 1-60 characters long.
// - Cannot contain: . , / \ * < > { } or whitespace.
export const EVENT_NAME_REGEX = /^[^\.\,\/\\*\s\<\>\{\}]{1,60}$/;

// Folder names may be empty but cannot contain angle or curly brackets.
export const EVENT_FOLDER_REGEX = /^[^<>{}]*$/;
