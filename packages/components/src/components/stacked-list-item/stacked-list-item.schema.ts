import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    accesskey: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    autocapitalize: {
      enum: ['characters', 'off', 'on', 'none', 'sentences', 'words', null],
    },
    autofocus: {
      enum: [false, true, null],
    },
    contenteditable: {
      enum: [false, true, 'true', 'false', 'inherit', 'plaintext-only', null],
    },
    contextmenu: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    dir: {
      enum: ['ltr', 'rtl', 'auto', null],
    },
    draggable: {
      enum: [false, true, 'true', 'false', null],
    },
    elementtiming: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    enterkeyhint: {
      enum: ['enter', 'done', 'go', 'next', 'previous', 'search', 'send', null],
    },
    hidden: {
      enum: [false, true, '', 'until-found', null],
    },
    id: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    lang: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    part: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    placeholder: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    slot: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    spellcheck: {
      enum: [false, true, 'true', 'false', null],
    },
    style: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    translate: {
      enum: ['', 'yes', 'no', null],
    },
    inert: {
      enum: [false, true, null],
    },
    popover: {
      enum: ['', 'auto', 'manual', 'hint', null],
    },
    writingsuggestions: {
      enum: [false, true, 'true', 'false', null],
    },
    radiogroup: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    about: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    datatype: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    prefix: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    property: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    resource: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    typeof: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    vocab: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    autosave: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    color: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    itemprop: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    itemscope: {
      enum: [false, true, null],
    },
    itemtype: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    itemid: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    itemref: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    results: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    security: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    unselectable: {
      enum: ['off', 'on', null],
    },
    inputmode: {
      enum: ['none', 'search', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', null],
      description:
        'Hints at the type of data that might be entered by the user while editing the element or its contents',
    },
    is: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Specify that a standard HTML element should behave like a defined custom built-in element',
    },
    'bind:innerHTML': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Elements with the contenteditable attribute support `innerHTML`, `textContent` and `innerText` bindings.',
    },
    'bind:textContent': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Elements with the contenteditable attribute support `innerHTML`, `textContent` and `innerText` bindings.',
    },
    'bind:innerText': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Elements with the contenteditable attribute support `innerHTML`, `textContent` and `innerText` bindings.',
    },
    'bind:focused': {
      enum: [false, true, null],
    },
    'bind:offsetWidth': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    'bind:offsetHeight': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    'aria-activedescendant': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application.',
    },
    'aria-atomic': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute.',
    },
    'aria-autocomplete': {
      enum: ['none', 'inline', 'list', 'both', null],
      description:
        "Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be\npresented if they are made.",
    },
    'aria-busy': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user.',
    },
    'aria-checked': {
      enum: [false, true, 'true', 'false', 'mixed', null],
      description:
        'Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.',
    },
    'aria-colcount': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines the total number of columns in a table, grid, or treegrid.',
    },
    'aria-colindex': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        "Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.",
    },
    'aria-colspan': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.',
    },
    'aria-controls': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Identifies the element (or elements) whose contents or presence are controlled by the current element.',
    },
    'aria-current': {
      enum: [false, true, 'true', 'false', 'page', 'step', 'location', 'date', 'time', null],
      description:
        'Indicates the element that represents the current item within a container or set of related elements.',
    },
    'aria-describedby': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description: 'Identifies the element (or elements) that describes the object.',
    },
    'aria-details': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Identifies the element that provides a detailed, extended description for the object.',
    },
    'aria-disabled': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.',
    },
    'aria-dropeffect': {
      enum: ['copy', 'none', 'execute', 'link', 'move', 'popup', null],
      description:
        'Indicates what functions can be performed when a dragged object is released on the drop target.',
    },
    'aria-errormessage': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description: 'Identifies the element that provides an error message for the object.',
    },
    'aria-expanded': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed.',
    },
    'aria-flowto': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        "Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,\nallows assistive technology to override the general default of reading in document source order.",
    },
    'aria-grabbed': {
      enum: [false, true, 'true', 'false', null],
      description: 'Indicates an element\'s "grabbed" state in a drag-and-drop operation.',
    },
    'aria-haspopup': {
      enum: [false, true, 'true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog', null],
      description:
        'Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element.',
    },
    'aria-hidden': {
      enum: [false, true, 'true', 'false', null],
      description: 'Indicates whether the element is exposed to an accessibility API.',
    },
    'aria-invalid': {
      enum: [false, true, 'true', 'false', 'grammar', 'spelling', null],
      description:
        'Indicates the entered value does not conform to the format expected by the application.',
    },
    'aria-keyshortcuts': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element.',
    },
    'aria-label': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines a string value that labels the current element.',
    },
    'aria-labelledby': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description: 'Identifies the element (or elements) that labels the current element.',
    },
    'aria-level': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines the hierarchical level of an element within a structure.',
    },
    'aria-live': {
      enum: ['off', 'assertive', 'polite', null],
      description:
        'Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region.',
    },
    'aria-modal': {
      enum: [false, true, 'true', 'false', null],
      description: 'Indicates whether an element is modal when displayed.',
    },
    'aria-multiline': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates whether a text box accepts multiple lines of input or only a single line.',
    },
    'aria-multiselectable': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates that the user may select more than one item from the current selectable descendants.',
    },
    'aria-orientation': {
      enum: ['horizontal', 'vertical', null],
      description:
        "Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous.",
    },
    'aria-owns': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship\nbetween DOM elements where the DOM hierarchy cannot be used to represent the relationship.',
    },
    'aria-placeholder': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.\nA hint could be a sample value or a brief description of the expected format.',
    },
    'aria-posinset': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        "Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.",
    },
    'aria-pressed': {
      enum: [false, true, 'true', 'false', 'mixed', null],
      description: 'Indicates the current "pressed" state of toggle buttons.',
    },
    'aria-readonly': {
      enum: [false, true, 'true', 'false', null],
      description: 'Indicates that the element is not editable, but is otherwise operable.',
    },
    'aria-relevant': {
      enum: [
        'text',
        'additions',
        'additions removals',
        'additions text',
        'all',
        'removals',
        'removals additions',
        'removals text',
        'text additions',
        'text removals',
        null,
      ],
      description:
        'Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.',
    },
    'aria-required': {
      enum: [false, true, 'true', 'false', null],
      description:
        'Indicates that user input is required on the element before a form may be submitted.',
    },
    'aria-roledescription': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Defines a human-readable, author-localized description for the role of an element.',
    },
    'aria-rowcount': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines the total number of rows in a table, grid, or treegrid.',
    },
    'aria-rowindex': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        "Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.",
    },
    'aria-rowspan': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.',
    },
    'aria-selected': {
      enum: [false, true, 'true', 'false', null],
      description: 'Indicates the current "selected" state of various widgets.',
    },
    'aria-setsize': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.',
    },
    'aria-sort': {
      enum: ['none', 'ascending', 'descending', 'other', null],
      description:
        'Indicates if items in a table or grid are sorted in ascending or descending order.',
    },
    'aria-valuemax': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines the maximum allowed value for a range widget.',
    },
    'aria-valuemin': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines the minimum allowed value for a range widget.',
    },
    'aria-valuenow': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Defines the current value for a range widget.',
    },
    'aria-valuetext': {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Defines the human readable text alternative of aria-valuenow for a range widget.',
    },
    'bind:contentRect': {
      anyOf: [
        {
          type: 'object',
        },
        {
          type: 'null',
        },
      ],
    },
    'bind:contentBoxSize': {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
          },
        },
        {
          type: 'null',
        },
      ],
    },
    'bind:borderBoxSize': {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
          },
        },
        {
          type: 'null',
        },
      ],
    },
    'bind:devicePixelContentBoxSize': {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
          },
        },
        {
          type: 'null',
        },
      ],
    },
    'bind:clientWidth': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    'bind:clientHeight': {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    xmlns: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    density: {
      enum: ['comfortable', 'condensed'],
      description: 'Density token surfaced as `data-cinder-density`. Default `comfortable`.',
    },
    class: {
      type: 'string',
      description: 'Merged with `cinder-stacked-list-item`.',
    },
    href: {
      type: 'string',
    },
    rel: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    hreflang: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'description',
        reason: 'function-or-snippet',
      },
      {
        name: 'inlist',
        reason: 'unknown-shape',
      },
      {
        name: 'leading',
        reason: 'function-or-snippet',
      },
      {
        name: 'meta',
        reason: 'function-or-snippet',
      },
      {
        name: 'target',
        reason: 'unknown-shape',
      },
      {
        name: 'title',
        reason: 'function-or-snippet',
      },
      {
        name: 'trailing',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
