<script lang="ts" module>
  export const title = 'Message roles';
  export const description = 'User, assistant, and system role variants with a timestamp.';
</script>

<script lang="ts">
  import { Message } from 'cinder/message';
</script>

<div class="example-preview-column">
  <Message role="user" name="Ada Lovelace" time="9:41 AM">
    Can you explain how transformers work?
  </Message>
  <Message role="assistant" time="9:41 AM">
    Transformers use self-attention to relate every token in a sequence to every other token,
    letting the model weigh context regardless of distance.
  </Message>
  <Message role="system">
    You are a helpful assistant that explains technical concepts clearly and concisely.
  </Message>
</div>
