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
    tabindex: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    title: {
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
      enum: ['none', 'list', 'inline', 'both', null],
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
      enum: ['none', 'link', 'copy', 'execute', 'move', 'popup', null],
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
      enum: [false, true, 'true', 'false', 'dialog', 'grid', 'listbox', 'menu', 'tree', null],
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
    items: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
    variant: {
      enum: ['default', 'striped', 'two-column', 'narrow'],
      description:
        'Controls the visual layout:\n- `default`: stacked rows with visible terms.\n- `striped`: alternating row backgrounds.\n- `two-column`: term and definition share a row; collapses to stacked at narrow widths.\n- `narrow`: `<dt>` is visually hidden via `.cinder-sr-only`. Only appropriate when\n  surrounding context already labels the value. NOT a general compact mode.',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['items'],
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'inlist',
        reason: 'unknown-shape',
      },
      {
        name: 'on:abort',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:animationend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:animationiteration',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:animationstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:auxclick',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:beforeinput',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:beforematch',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:beforetoggle',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:blur',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:cancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:canplay',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:canplaythrough',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:change',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:click',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:close',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:compositionend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:compositionstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:compositionupdate',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:contentvisibilityautostatechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:contextmenu',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:copy',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:cuechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:cut',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dblclick',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:drag',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dragend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dragenter',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dragexit',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dragleave',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dragover',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:dragstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:drop',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:durationchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:emptied',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:encrypted',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:ended',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:error',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:focus',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:focusin',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:focusout',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:formdata',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:fullscreenchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:fullscreenerror',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:gamepadconnected',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:gamepaddisconnected',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:gotpointercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:input',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:introend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:introstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:invalid',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:keydown',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:keypress',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:keyup',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:load',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:loadeddata',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:loadedmetadata',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:loadstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:lostpointercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:message',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:messageerror',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mousedown',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mouseenter',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mouseleave',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mousemove',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mouseout',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mouseover',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:mouseup',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:outroend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:outrostart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:paste',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pause',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:play',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:playing',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointercancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointerdown',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointerenter',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointerleave',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointermove',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointerout',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointerover',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:pointerup',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:progress',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:ratechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:reset',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:resize',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:scroll',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:scrollend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:seeked',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:seeking',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:select',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:selectionchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:selectstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:stalled',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:submit',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:suspend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:timeupdate',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:toggle',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:touchcancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:touchend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:touchmove',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:touchstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:transitioncancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:transitionend',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:transitionrun',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:transitionstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:visibilitychange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:volumechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:waiting',
        reason: 'function-or-snippet',
      },
      {
        name: 'on:wheel',
        reason: 'function-or-snippet',
      },
      {
        name: 'onabort',
        reason: 'function-or-snippet',
      },
      {
        name: 'onabortcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onanimationend',
        reason: 'function-or-snippet',
      },
      {
        name: 'onanimationendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onanimationiteration',
        reason: 'function-or-snippet',
      },
      {
        name: 'onanimationiterationcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onanimationstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'onanimationstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onauxclick',
        reason: 'function-or-snippet',
      },
      {
        name: 'onauxclickcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onbeforeinput',
        reason: 'function-or-snippet',
      },
      {
        name: 'onbeforeinputcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onbeforematch',
        reason: 'function-or-snippet',
      },
      {
        name: 'onbeforematchcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onbeforetoggle',
        reason: 'function-or-snippet',
      },
      {
        name: 'onbeforetogglecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onblur',
        reason: 'function-or-snippet',
      },
      {
        name: 'onblurcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncancelcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncanplay',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncanplaycapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncanplaythrough',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncanplaythroughcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onchangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onclick',
        reason: 'function-or-snippet',
      },
      {
        name: 'onclickcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onclose',
        reason: 'function-or-snippet',
      },
      {
        name: 'onclosecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncompositionend',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncompositionendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncompositionstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncompositionstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncompositionupdate',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncompositionupdatecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncontentvisibilityautostatechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncontentvisibilityautostatechangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncontextmenu',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncontextmenucapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncopy',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncopycapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncuechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncuechangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncut',
        reason: 'function-or-snippet',
      },
      {
        name: 'oncutcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondblclick',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondblclickcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondrag',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragend',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragenter',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragentercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragexit',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragexitcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragleave',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragleavecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragover',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragovercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondragstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondrop',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondropcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondurationchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondurationchangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onemptied',
        reason: 'function-or-snippet',
      },
      {
        name: 'onemptiedcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onencrypted',
        reason: 'function-or-snippet',
      },
      {
        name: 'onencryptedcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onended',
        reason: 'function-or-snippet',
      },
      {
        name: 'onendedcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onerror',
        reason: 'function-or-snippet',
      },
      {
        name: 'onerrorcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfocus',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfocuscapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfocusin',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfocusincapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfocusout',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfocusoutcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onformdata',
        reason: 'function-or-snippet',
      },
      {
        name: 'onformdatacapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfullscreenchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfullscreenchangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfullscreenerror',
        reason: 'function-or-snippet',
      },
      {
        name: 'onfullscreenerrorcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ongamepadconnected',
        reason: 'function-or-snippet',
      },
      {
        name: 'ongamepaddisconnected',
        reason: 'function-or-snippet',
      },
      {
        name: 'ongotpointercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ongotpointercapturecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oninput',
        reason: 'function-or-snippet',
      },
      {
        name: 'oninputcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onintroend',
        reason: 'function-or-snippet',
      },
      {
        name: 'onintroendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onintrostart',
        reason: 'function-or-snippet',
      },
      {
        name: 'onintrostartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'oninvalid',
        reason: 'function-or-snippet',
      },
      {
        name: 'oninvalidcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onkeydown',
        reason: 'function-or-snippet',
      },
      {
        name: 'onkeydowncapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onkeypress',
        reason: 'function-or-snippet',
      },
      {
        name: 'onkeypresscapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onkeyup',
        reason: 'function-or-snippet',
      },
      {
        name: 'onkeyupcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onload',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadeddata',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadeddatacapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadedmetadata',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadedmetadatacapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'onloadstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onlostpointercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onlostpointercapturecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmessage',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmessagecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmessageerror',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmessageerrorcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmousedown',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmousedowncapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseenter',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseleave',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmousemove',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmousemovecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseout',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseoutcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseover',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseovercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseup',
        reason: 'function-or-snippet',
      },
      {
        name: 'onmouseupcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onoutroend',
        reason: 'function-or-snippet',
      },
      {
        name: 'onoutroendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onoutrostart',
        reason: 'function-or-snippet',
      },
      {
        name: 'onoutrostartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpaste',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpastecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpause',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpausecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onplay',
        reason: 'function-or-snippet',
      },
      {
        name: 'onplaycapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onplaying',
        reason: 'function-or-snippet',
      },
      {
        name: 'onplayingcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointercancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointercancelcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerdown',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerdowncapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerenter',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerentercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerleave',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerleavecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointermove',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointermovecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerout',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointeroutcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerover',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerovercapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerup',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpointerupcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onprogress',
        reason: 'function-or-snippet',
      },
      {
        name: 'onprogresscapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onratechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onratechangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onreset',
        reason: 'function-or-snippet',
      },
      {
        name: 'onresetcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onresize',
        reason: 'function-or-snippet',
      },
      {
        name: 'onresizecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onscroll',
        reason: 'function-or-snippet',
      },
      {
        name: 'onscrollcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onscrollend',
        reason: 'function-or-snippet',
      },
      {
        name: 'onscrollendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onseeked',
        reason: 'function-or-snippet',
      },
      {
        name: 'onseekedcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onseeking',
        reason: 'function-or-snippet',
      },
      {
        name: 'onseekingcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselect',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselectcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselectionchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselectionchangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselectstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselectstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onstalled',
        reason: 'function-or-snippet',
      },
      {
        name: 'onstalledcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onsubmit',
        reason: 'function-or-snippet',
      },
      {
        name: 'onsubmitcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onsuspend',
        reason: 'function-or-snippet',
      },
      {
        name: 'onsuspendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontimeupdate',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontimeupdatecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontoggle',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontogglecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchcancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchcancelcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchend',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchmove',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchmovecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontouchstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitioncancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitioncancelcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitionend',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitionendcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitionrun',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitionruncapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitionstart',
        reason: 'function-or-snippet',
      },
      {
        name: 'ontransitionstartcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onvisibilitychange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onvisibilitychangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onvolumechange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onvolumechangecapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onwaiting',
        reason: 'function-or-snippet',
      },
      {
        name: 'onwaitingcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'onwheel',
        reason: 'function-or-snippet',
      },
      {
        name: 'onwheelcapture',
        reason: 'function-or-snippet',
      },
      {
        name: 'role',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
