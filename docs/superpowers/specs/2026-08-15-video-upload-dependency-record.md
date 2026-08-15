# Video Upload Dependency Record

The resumable video-asset upload path uses the official tus implementation instead of a custom upload protocol.

| Package | Pinned version | License | Purpose |
| --- | ---: | --- | --- |
| `@tus/server` | `2.4.1` | MIT | Server-side tus protocol handling |
| `@tus/file-store` | `2.1.1` | MIT | Filesystem-backed resumable upload storage |
| `tus-js-client` | `4.3.1` | MIT | Browser upload resume, retry, and progress reporting |

Package metadata was verified from each installed package's `package.json`. Source repositories are `tus/tus-node-server` and `tus/tus-js-client`.
