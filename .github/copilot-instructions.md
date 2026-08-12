# Copilot code review instructions

## Test timeouts are not a fix

Never approve a pull request whose only change increases a test timeout, retry count, or other wait threshold. A bumped `timeout`, `testTimeout`, `--timeout`, `retries`, `waitFor` deadline, or `slow()` multiplier hides a real problem instead of fixing it: a slow assertion, a race condition, an unmocked network call, an unbounded retry loop, or resource contention under CI load.

There is no exception. It does not matter whether the pull request explains the root cause, links to a failing run, cites a legitimately larger workload, or fixes everything else in the diff cleanly: if any part of the change increases a timeout, retry count, or wait threshold, do not approve it. Request changes and require the timeout or retry value to be reverted to its prior value, with the actual slowness or flakiness fixed in source or test code instead.

This rule applies even when the rest of the diff looks reasonable and the timeout change is buried in an otherwise unrelated pull request. Flag it as a blocking comment, not a suggestion.
