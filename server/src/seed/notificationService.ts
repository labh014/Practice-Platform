import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * Notification Service - a routing and channel-strategy problem.
 *
 * Different design instinct: an incoming event fans out through several
 * delivery channels, each with its own template and its own transport. The
 * classic mistake is one send() method with an if-ladder over channel kind,
 * templating strings inline.
 */
export function buildNotificationServiceProblem(): Problem {
  return new Problem({
    id: 'notification-service',
    title: 'Notification Service',
    summary:
      'Design the classes behind a service that turns an event into notifications sent ' +
      "across several channels, respecting each user's preferences.",
    description: [
      'An application raises events (order-shipped, password-reset, price-drop). For each',
      "event, the notification service decides which of the user's channels apply (email,",
      'SMS, push), renders a channel-appropriate message from a template, and hands it to',
      'the right transport for delivery.',
      '',
      'Design the classes, interfaces and relationships behind this. Method bodies can be',
      'empty; what is being assessed is how event routing, templating and channel',
      'transports are kept separate, and how a new channel plugs in.',
      '',
      'The product owner expects new channels (in-app inbox, Slack, WhatsApp) to appear',
      'without touching how events are raised or how existing channels render their',
      'messages.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Represent an event with a type and a typed payload, raised by application code ' +
          'without knowing which channels it will reach.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Support at least three channels (email, SMS, push), each with its own ' +
          'transport and its own message shape.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Render the message for a channel from a template that varies by channel and by ' +
          'event type, without inlining strings into the transport.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          "Consult each user's channel preferences before dispatching, so a user who has " +
          'disabled SMS never receives one regardless of event.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Allow a new channel to be introduced without modifying the classes that ' +
          'already exist for event dispatch, templating or existing channels.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'A single service class picks the channel, renders the message and calls the ' +
          "transport - templates are inlined into the same method that sends the request.",
        mid:
          'Channels are separated but the dispatcher still owns templating, or templates ' +
          'are shared across channels with per-channel branches inside them.',
        high:
          'Dispatch, templating and channel transports are each owned by their own type, ' +
          'and the dispatcher coordinates them rather than performing any of the three.',
      },
      COUPLING: {
        low:
          'Every dependency is on a concrete transport (a specific SMTP or SMS client). ' +
          'Channels cannot be swapped for a fake in tests.',
        mid:
          'A channel interface exists but templating is still concrete, or the ' +
          'preferences check reaches into a specific storage type.',
        high:
          'Channels, templates and preferences are each addressed through abstractions, ' +
          'and each is justified by a variation the problem actually has - not one added ' +
          'for symmetry.',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'Two or three channels are represented, but preferences are missing or ' +
          'templates are treated as strings without a rendering step.',
        high:
          'Every HIGH requirement has a home, including per-user preferences and ' +
          'per-channel templates. The assumptions field states what was excluded ' +
          '(delivery retries, tracking, batching).',
      },
      EXTENSIBILITY: {
        low:
          'A new channel would mean editing the dispatcher and the templating code, and ' +
          'no trade-off is acknowledged.',
        mid:
          'A new channel plugs in but a new event type still requires touching every ' +
          "existing channel's template.",
        high:
          'A new channel and a new event type are each additive, and the submission ' +
          'names what the extra indirection costs (an extra registration step, another ' +
          'template to author) as well as what it buys.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'Quiet hours',
      description: [
        "Users can now set 'quiet hours' (e.g. 22:00-07:00) during which non-urgent",
        'notifications should be held and delivered together the next morning. Some event',
        'types are marked urgent and bypass this.',
        '',
        'Would your design absorb this by adding a new step between dispatch and channel',
        "(a scheduler or a policy), or would you have to edit every channel's send? Name",
        'the classes that would have to change.',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
