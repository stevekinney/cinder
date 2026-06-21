<script lang="ts" module>
  export const title = 'With reasoning and steps';
  export const description =
    'Assistant messages can surface a collapsible reasoning block (extended thinking) and an ordered step list before the final answer. Both are UI-only overlays derived from message metadata — the underlying transcript is unchanged.';
</script>

<script lang="ts">
  import {
    Chat,
    appendMessages,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/cinder/chat';

  const reasoningContent =
    'The user is asking me to walk them through solving a quadratic equation step by step. I should break this down into a structured sequence of steps: first identify the coefficients, then apply the quadratic formula, then simplify the result. I should also surface my reasoning process so the user can see my thinking before I present the final answer.';

  const conversation = appendMessages(
    appendUserMessage(
      createConversation({ id: 'reasoning-steps-chat' }),
      'Can you solve 2x² - 4x - 6 = 0 and walk me through the steps?',
    ),
    {
      role: 'assistant',
      content:
        'The solutions are **x = 3** and **x = -1**.\n\nYou can verify these by substituting back: 2(9) − 4(3) − 6 = 18 − 12 − 6 = 0 ✓ and 2(1) − 4(−1) − 6 = 2 + 4 − 6 = 0 ✓',
      metadata: {
        'cinder:reasoning': reasoningContent,
        'cinder:steps': [
          {
            title: 'Identify coefficients',
            content: 'a = 2, b = −4, c = −6',
            status: 'done',
          },
          {
            title: 'Apply the quadratic formula',
            content: 'x = (4 ± √(16 + 48)) / 4 = (4 ± √64) / 4 = (4 ± 8) / 4',
            status: 'done',
          },
          {
            title: 'Calculate both solutions',
            content: 'x₁ = (4 + 8) / 4 = 3  ·  x₂ = (4 − 8) / 4 = −1',
            status: 'done',
          },
        ],
      },
    },
  );
</script>

<div style="height: 34rem;">
  <Chat id="playground-reasoning-steps-chat" {conversation} capabilities={{ attachments: false }} />
</div>
