# Firestore rules checks

Requires Node.js and Java 21+. Uses the isolated `demo-sunset-feedback` emulator project, never production data.

From this directory:

```sh
npm ci
npx firebase-tools emulators:exec --only firestore --project demo-sunset-feedback 'node check-rules.mjs'
```

Covers the one-hour-before-sunset voting window, owner access, required fields, value ranges, duplicates and denial of listing, updates, deletion and unrelated collections.
