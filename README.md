# API Failure Lab

API Failure Lab is a local developer tool for sending REST API requests and inspecting normal, delayed, and simulated failure responses.

## Features

- Send `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests.
- Run a normal request against the target API.
- Simulate `404 Not Found`, `429 Too Many Requests`, and `500 Internal Server Error` responses.
- Add an artificial delay to an upstream response.
- Send JSON request bodies with supported methods.
- Inspect response status, body, and headers.
- Review request history stored in the browser.
- Track latency averages, fastest and slowest requests, and recent trends.

## Screenshots

Screenshots are not currently included in the repository. To add one, capture the running application, place the image under `docs/screenshots/`, and replace this note with a Markdown image reference. Do not use generated or mock screenshots in place of the application UI.

## Architecture

```text
React UI
  → /api/simulate
  → Vite server middleware
  → validation/security
  → simulation engine
  → upstream API
```

API Failure Lab is currently a local developer tool. The Vite middleware provides `/api/simulate` during development and preview; the static production build alone does not provide this backend API.

## Security

The local proxy applies the following controls:

- Only HTTP and HTTPS target URLs are accepted.
- SSRF-oriented target validation blocks credentials, localhost, internal hostnames, and private, local, reserved, or otherwise non-public IP ranges.
- Hostnames are resolved and their DNS results are checked before upstream requests.
- Every redirect destination is revalidated, with redirect loop and redirect count limits.
- Inbound `/api/simulate` request bodies are limited to 256 KiB.
- Upstream response bodies are limited to 1 MiB.
- Upstream requests time out after 12 seconds.

DNS validation and the subsequent network connection are separate operations, so a validation-to-connection race remains possible and full resistance to DNS rebinding is not guaranteed. Do not expose the local Vite server publicly without a trusted network or application boundary.

## Installation

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Quality commands

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npm run check
```

`npm run check` runs type checking, linting, tests, and the production build in sequence.

## Testing

The current suite contains 100 tests across four files: 99 passing and one marked todo as of v0.4. Run `npm run test` for the authoritative current count.

Coverage is organized around:

- Simulation engine behavior, upstream requests, resource limits, and redirects.
- `/api/simulate` request validation and API contract behavior.
- URL, DNS, IP-range, and SSRF-oriented security validation.
- Latency metric calculations.

## Project structure

```text
src/       React UI, components, browser state, and client utilities
server/    Vite middleware, request validation, and simulation engine
tests/     Vitest suites for server, security, API, and metrics behavior
```

## Current scope and limitations

- Custom authentication and request headers are not supported yet.
- Request bodies are JSON only.
- Multipart uploads are not supported.
- Request history is stored in browser `localStorage` and is limited to the local browser profile.
- The tool is local-first and does not include a standalone production backend.

## Roadmap

- Headers & Authentication
- Custom Failure Responses
- Batch Reliability Testing

## License

Licensed under the [MIT License](LICENSE).
