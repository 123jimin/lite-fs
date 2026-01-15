# lite-fs

A simple fs-like API wrapper of IndexedDB for light application usage.

## Installation

```bash
pnpm i @jiminp/lite-fs
```

## Usage

```ts
import { LiteFS } from "@jiminp/lite-fs";

// Write a text file
const fs = new LiteFS('my-app-fs');
await fs.writeFile("/hello.txt", "Hello, world!");

// Read as string
const text = await fs.readFile("/hello.txt", 'utf-8');
console.log(text); // "Hello, world!"
```