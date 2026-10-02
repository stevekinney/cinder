<script lang="ts" module>
  export const title = 'With tool approval';
  export const description =
    'Action-required tool results render as approval prompts the user must accept or reject before the tool can continue.';
</script>

<script lang="ts">
  import { Chat, appendMessages, appendUserMessage, createConversation } from '@lostgradient/chat';
  import type { ApprovalResolution } from '@lostgradient/cinder';

  let conversation = $state(
    appendMessages(
      appendUserMessage(
        createConversation({ id: 'tool-approval-chat' }),
        'Deploy the latest build to production.',
      ),
      {
        role: 'tool-call',
        content: '',
        toolCall: {
          id: 'call-deploy-prod',
          name: 'deploy_to_production',
          arguments: { environment: 'production', version: '2.4.1' },
        },
      },
      {
        role: 'tool-result',
        content: '',
        toolResult: {
          callId: 'call-deploy-prod',
          outcome: 'action_required',
          content: null,
          action: {
            type: 'approval',
            message:
              'Deploying version 2.4.1 to production will replace the live environment. This action cannot be undone automatically. Do you want to proceed?',
            risk: 'high',
            operation: {
              kind: 'command',
              command: 'deploy_to_production',
              argsPreview: { environment: 'production', version: '2.4.1', replicas: 3 },
            },
            policyVersion: 'deployment-policy-1',
            idempotencyKey: 'call-deploy-prod',
          },
        },
      },
    ),
  );

  function handleApprovalResolve(toolCallId: string, resolution: ApprovalResolution) {
    let content: string;
    switch (resolution.decision) {
      case 'approve':
        content = `Approved. Deploying version 2.4.1 to production now. Tool call ID: ${toolCallId}`;
        break;
      case 'approve_with_edits':
        throw new Error('This example does not offer edited approval');
      case 'deny':
        content = `Deployment cancelled. The production environment was not modified. Tool call ID: ${toolCallId}`;
        break;
      case 'cancel':
        content = `Approval dismissed. The production environment was not modified. Tool call ID: ${toolCallId}`;
        break;
    }
    conversation = appendMessages(conversation, { role: 'assistant', content });
  }
</script>

<div style="height: 34rem;">
  <Chat
    id="playground-tool-approval-chat"
    {conversation}
    capabilities={{ attachments: false }}
    onApprovalResolve={handleApprovalResolve}
  />
</div>
