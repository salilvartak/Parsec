// The document every visitor lands on. It doubles as a tour: it exercises every
// type the app renders (nested objects, arrays, numbers, booleans, null, an
// empty array, a deep branch for the flowchart) while being worth reading.
export const SAMPLE = {
  greeting: 'You pasted nothing, so here is a starter document. Delete it, it will not be offended.',
  status: 'success',
  code: 200,
  data: {
    app: {
      name: 'Parsec',
      tagline: 'A JSON viewer, because the browser tab you were using autoplayed an ad.',
      version: '1.0.0',
      isYetAnotherJsonViewer: true,
      butDoesItHaveAFlowchart: 'yes, that is the whole pitch',
      thingsItRefusesToDo: ['upload your data anywhere', 'ask you to sign in', 'send a newsletter'],
      openTabsRequiredToUnderstandYourApi: 7,
    },
    developer: {
      id: 'usr_8f2a1c',
      name: 'A Person Debugging At 2am',
      email: 'definitely.not.prod@example.com',
      caffeine: { unit: 'cups', today: 4, recommended: 2, regrets: null },
      lastWords: 'it works on my machine',
      confidence: 0.92,
      confidenceAfterOpeningTheResponse: 0.11,
      isCurrentlySquintingAtOneMissingComma: true,
    },
    theApiResponse: {
      id: 'ord_44210',
      status: 'fulfilled',
      documentation: {
        exists: true,
        accurate: false,
        lastUpdated: '2019-04-03T09:15:00Z',
        excuse: 'it is on the roadmap',
      },
      total: 214.5,
      currency: 'USD',
      items: [
        { sku: 'BLK-TEE-M', name: 'The Black Tee', qty: 2, price: 28, inStock: true },
        { sku: 'WHT-CAP-01', name: 'A Cap, White', qty: 1, price: 18.5, inStock: false },
        { sku: 'MYS-BOX-99', name: 'Field The Backend Added Without Telling Anyone', qty: 1, price: 0 },
      ],
      shipping: {
        carrier: 'UPS',
        trackingNumber: '1Z999AA10123456784',
        estimatedDelivery: 'sometime',
        actualDelivery: null,
        address: {
          line1: '221B Baker Street',
          city: 'Austin',
          state: 'TX',
          zip: '73301',
          notes: 'Leave the package. Do not leave feedback.',
        },
      },
    },
    metadata: null,
    stringifiedByAccident: '{"yes":"this is a string containing JSON","tryThe":"Unwrap button"}',
  },
  tips: [
    'Click a node in Flowchart to collapse it. Click again when you miss it.',
    'The Diff tab exists so you can prove it was not your change.',
    'JSONPath lives in the box marked $. Try $.data.theApiResponse.items[*].sku',
  ],
  knownIssues: [],
  warnings: ['This payload is fictional. Any resemblance to your production data is a coincidence and also a problem.'],
};

// Diff view defaults: the same payload before and after "a tiny backend change
// that definitely will not break anything".
export const DIFF_SAMPLE_A = {
  id: 'ord_44210',
  label: 'what the docs promised',
  status: 'processing',
  total: 196.0,
  currency: 'USD',
  items: [{ sku: 'BLK-TEE-M', qty: 2, price: 28.0 }],
  shipping: { carrier: 'USPS', trackingNumber: null },
  breakingChanges: 'none',
};
export const DIFF_SAMPLE_B = {
  id: 'ord_44210',
  label: 'what the endpoint actually returned',
  status: 'fulfilled',
  total: 214.5,
  currency: 'usd',
  items: [
    { sku: 'BLK-TEE-M', qty: 2, price: 28.0 },
    { sku: 'WHT-CAP-01', qty: 1, price: 18.5 },
  ],
  shipping: { carrier: 'UPS', trackingNumber: '1Z999AA10123456784' },
  breakingChanges: 'still none, per the changelog',
  surpriseField: 'shipped on a Friday',
};

// Seed for the Markdown viewer — also a mini feature tour.
export const MARKDOWN_SAMPLE = `# Markdown Viewer

Type on the left, read on the right. It renders **live**, escapes raw HTML, and
will not run your \`<script>\` tags — paste one and watch it turn into text.

## What it handles

- **Bold**, *italic*, ~~strikethrough~~ and \`inline code\`
- [Links](https://example.com) (open in a new tab, sanitized)
- Task lists:
  - [x] Render markdown
  - [x] Not get XSS'd
  - [ ] Achieve inbox zero

> Blockquotes, for when you are quoting someone wiser than the changelog.

### A table, because someone always asks

| Feature   | Status | Notes                    |
|-----------|:------:|--------------------------|
| Headings  |   ✓    | h1 through h6            |
| Code      |   ✓    | fenced + inline          |
| Tables    |   ✓    | you are looking at one   |

### And a code block

\`\`\`js
function greet(name) {
  return \`hello, \${name}\`; // template literals survive
}
\`\`\`

---

Delete all this and paste your own README.
`;
