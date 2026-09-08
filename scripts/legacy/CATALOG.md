# Legacy operational scripts

These files are historical investigation and repair artifacts. They are not supported development commands, are not called by `package.json`, and must not be run against any environment without first reviewing credentials, target project, dry-run behavior, and the current schema.

The filename is unchanged. Its previous path was always `scripts/<filename>`.

| Directory | Files | Historical purpose | Status | Prerequisites before reuse |
| --- | ---: | --- | --- | --- |
| `database-audit/` | 13 | One-off migration audits, materialization and validation passes from an earlier database cleanup | Archived reference | Review every query against current migrations; use a disposable/local database first |
| `function-inspection/` | 6 | Fetching, printing and tracing deployed function sources during incident investigation | Archived reference | Confirm project reference and credentials; never treat downloaded remote source as canonical |
| `whatsapp-identity/` | 42 | Investigation and repair of private/LID chats, duplicate identities and historical lead matching | Archived reference | Read current canonical-chat invariants and use dry-run; scripts may mutate production data |
| `campaigns/` | 1 | One-time repair of immediate campaign stages affected by reply-stop behavior | Archived reference | Verify the incident still applies and inspect current campaign RPC semantics |

Supported operational commands remain in the `scripts/` root and are exposed by `package.json` when intended for routine use. A new tool should only be added there when it is repeatable, documented, safe by default, and has an explicit owner/use case.
