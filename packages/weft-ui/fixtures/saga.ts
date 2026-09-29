/**
 * Saga-compensation demo fixture (plan §11, Appendix B "Timeline
 * (coordination + saga + finalizer)"). The final step deliberately fails so
 * `ctx.saga` compensates the two completed steps in reverse order before
 * re-throwing — giving the timeline a live specimen of compensating steps.
 * See `fixtures/workflows.ts` for the append-only contract this file
 * participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface TripBookingSagaInput {
  travelerId: string;
  destination: string;
  cardLast4: string;
}

const reserveFlight = activity({
  name: 'reserveFlight',
  execute: async (input: { travelerId: string; destination: string }) => {
    return { confirmationId: `flt_${input.travelerId}`, destination: input.destination };
  },
  compensate: async () => {
    // Release the seat hold. Best-effort, no external system in the demo.
  },
});

const reserveHotel = activity({
  name: 'reserveHotel',
  execute: async (input: { travelerId: string; destination: string }) => {
    return { confirmationId: `htl_${input.travelerId}`, destination: input.destination };
  },
  compensate: async () => {
    // Cancel the room hold. Best-effort, no external system in the demo.
  },
});

const chargeTripCard = activity({
  name: 'chargeTripCard',
  execute: async (input: { travelerId: string; cardLast4: string }) => {
    throw new Error(`card ending ${input.cardLast4} was declined for traveler ${input.travelerId}`);
  },
});

export const tripBookingSaga = workflow({ name: 'trip-booking-saga' })
  .activities({ reserveFlight, reserveHotel, chargeTripCard })
  .execute(async function* (ctx, input: TripBookingSagaInput) {
    return yield* ctx.saga([
      {
        definition: reserveFlight,
        input: { travelerId: input.travelerId, destination: input.destination },
      },
      {
        definition: reserveHotel,
        input: { travelerId: input.travelerId, destination: input.destination },
      },
      {
        definition: chargeTripCard,
        input: { travelerId: input.travelerId, cardLast4: input.cardLast4 },
      },
    ]);
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const sagaWorkflows = {
  'trip-booking-saga': tripBookingSaga,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface SagaEngine {
  start(name: 'trip-booking-saga', input: TripBookingSagaInput): Promise<WorkflowHandle>;
}

/**
 * Starts and settles the saga demo. The final step always fails, so this run
 * always ends `failed` (application category) after compensating the flight
 * and hotel reservations — awaited so that terminal state is durably
 * committed before the dev server starts serving.
 */
export async function seedSaga(engine: SagaEngine): Promise<void> {
  const handle = await engine.start('trip-booking-saga', {
    travelerId: 'trv_8801',
    destination: 'Lisbon',
    cardLast4: '4242',
  });
  await handle.result().catch(() => {
    // Expected — the saga's last step always fails so compensation runs.
  });
}
