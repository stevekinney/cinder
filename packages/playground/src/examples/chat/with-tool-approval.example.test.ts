/// <reference lib="dom" />
import { afterEach, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: WithToolApprovalExample } = await import('./with-tool-approval.example.svelte');

afterEach(cleanup);

for (const [decision, response] of [
  ['Approve', 'Approved. Deploying version 2.4.1 to production now.'],
  ['Deny', 'Deployment cancelled. The production environment was not modified.'],
  ['Dismiss', 'Approval dismissed. The production environment was not modified.'],
] as const) {
  test(`resolves the tool approval once when ${decision} is selected`, async () => {
    render(WithToolApprovalExample);

    await fireEvent.click(screen.getByRole('button', { name: decision }));

    await waitFor(() => {
      const messages = screen.getAllByText((content) => content.includes(response));
      expect(messages).toHaveLength(1);
      expect(messages[0]?.textContent).toContain('Tool call ID: call-deploy-prod');
    });
  });
}
