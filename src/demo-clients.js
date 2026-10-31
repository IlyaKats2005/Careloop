// Public receiving addresses for the four fictional demo clients.
// Wallet recovery keys are kept outside the app and repository.
export const DEMO_CLIENTS=[
  {
    "id": "alex",
    "displayName": "Alex Morgan",
    "recipientAddress": "addr_test1qrzg8gp2ywkjdnew4f2kj5fhp0c0lkkdp40s46q09vdkj8mrac26jmmgp6vjm2gkqdjxs0v938maxswnje98y5re85as488ff3",
    "initiallyEnrolled": true
  },
  {
    "id": "maya",
    "displayName": "Maya Chen",
    "recipientAddress": "addr_test1qpr2srz9fh2zuzsx7dhp5nkhsdy59j7fm9hq54cqt78qsnagf8mz9e3strmylhx8w76raqyjdatjxg6qdmrpyjh2actqekk2np",
    "initiallyEnrolled": true
  },
  {
    "id": "noah",
    "displayName": "Noah Bennett",
    "recipientAddress": "addr_test1qpch0pltwy6enynfwd0xhfr2ae93qm52725v9cfmyts43psl4s3gqwl0xvcjw64s9yfqfkp88ryjnk8e2na9f92t48mqus2hlh",
    "initiallyEnrolled": true
  },
  {
    "id": "sam",
    "displayName": "Sam Rivera",
    "recipientAddress": "addr_test1qz0rrhhsm2e3qe30lqsymv6j9cvxeczg7rgxarc9nw9fjh6zvh99tz9lcwlvwyy95kgrym77qk6capvgk4atrhx4s0hqgkagu7",
    "initiallyEnrolled": false
  }
];
export const demoParticipantKey=(workspaceId,clientId)=>'demo:'+workspaceId+(clientId==='alex'?'':':'+clientId);
