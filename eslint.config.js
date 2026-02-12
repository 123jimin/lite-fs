// @ts-check

import config from "@jiminp/eslint-config";

export default [
    ...config,
    {
        rules: {
            'new-cap': ['error', {capIsNewExceptionPattern: String.raw`^FSError\.`}],
        },
    },
];
