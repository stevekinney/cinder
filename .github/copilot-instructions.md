# Copilot code review instructions

## Test timeouts are not a fix

Never approve a pull request whose only change increases a test timeout, retry count, or other wait threshold. A bumped `timeout`, `testTimeout`, `--timeout`, `retries`, `waitFor` deadline, or `slow()` multiplier hides a real problem instead of fixing it: a slow assertion, a race condition, an unmocked network call, an unbounded retry loop, or resource contention under CI load.

Before approving any change that touches a timeout or retry value, confirm the pull request also:

- explains the root cause of the slowness or flakiness it addresses
- fixes that root cause in source or test code, not just the wait budget
- links to the failing run or issue that prompted the change

A description like "test was flaky, bumped the timeout" is not sufficient justification on its own. Request changes and ask for the root cause instead of approving on the description alone.

The only exception is a documented, reasoned change in actual workload, for example a test that now legitimately processes far more data than before, where the increase is proportionate and explained inline next to the changed value. Even then, require that reasoning in the pull request; a bare number change is still not enough.

This rule applies even when the rest of the diff looks reasonable and the timeout change is buried in an otherwise unrelated pull request. Flag it as a blocking comment, not a suggestion.
